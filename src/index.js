const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const { connectDB, sequelize, assertProdEnv } = require('./config/database');
const propertyRoutes = require('./routes/propertyRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const leadRoutes = require('./routes/leadRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const dealRoutes = require('./routes/dealRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const visitRoutes = require('./routes/visitRoutes');
const documentRoutes = require('./routes/documentRoutes');
const marketingRoutes = require('./routes/marketingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const taskRoutes = require('./routes/taskRoutes');
const commissionRoutes = require('./routes/commissionRoutes');
const marketRoutes = require('./routes/marketRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const aiRoutes = require('./routes/aiRoutes');
const buyerPreferenceRoutes = require('./routes/buyerPreferenceRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const websiteRoutes = require('./routes/websiteRoutes');
const trackRoutes = require('./routes/trackRoutes');
const adminRoutes = require('./routes/adminRoutes');
const featureFlagRoutes = require('./routes/featureFlagRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const publicDocumentRoutes = require('./routes/publicDocumentRoutes');
const commissionSettingsRoutes = require('./routes/commissionSettingsRoutes');
const upload = require('./middleware/uploadMiddleware');
const { protect } = require('./middleware/authMiddleware');
require('./models/associations');

const app = express();
const PORT = process.env.PORT || 8000;

// PHASE 1 (production hardening): secure defaults without changing API behavior.
app.set('trust proxy', 1); // Render/Heroku-style proxies: correct req.ip for throttling/logs.

// TEMP-DEV: allow all origins. TODO: re-lock to FRONTEND_URL allowlist before prod.
// app.use(cors()) reflects any Origin — do NOT ship this to production with credentials.
app.use(cors());

// Security headers. API serves JSON (plus the SPA bundle in production),
// so keep policies permissive for cross-origin reads:
// - CORP cross-origin: the deployed SPA fetches this API cross-origin.
// - COEP disabled: avoids blocking Supabase/Google Maps subresources on pages.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // SPA + signing pages load Maps/Supabase; tune per-page later.
}));

// Body limits. Chosen limit: 200kb JSON — the largest legitimate payloads are
// website sections/campaign content (few KB); file bytes travel as multipart,
// never JSON, so this cannot break uploads.
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// Minimal structured request log (stdout JSON). Redacts auth material and
// never logs bodies (may contain tokens/PII/payment data).
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const entry = {
      ts: new Date().toISOString(),
      method: req.method,
      path: (req.baseUrl || '') + (req.path || ''),
      status: res.statusCode,
      ms: Date.now() - start,
      ip: req.ip
    };
    // console.log keeps the existing log pipeline; no bodies/headers logged.
    console.log(JSON.stringify({ type: 'http', ...entry }));
  });
  next();
});

// Rate limiting: generous global guard + strict gates on sensitive routes.
// Limits are per-IP sliding windows; legitimate ERP usage (~100s of calls/day)
// is far below these ceilings.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please slow down.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many auth attempts, please try again later.' }
});
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'AI quota exceeded for now, please try again later.' }
});
app.use('/api/', apiLimiter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes (auth + admin + AI carry strict per-route throttles on top of apiLimiter)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/buyer-preferences', buyerPreferenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/admin', authLimiter, adminRoutes);
app.use('/api/features', featureFlagRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sign', publicDocumentRoutes);
app.use('/api/commission-settings', commissionSettingsRoutes);

// Direct Upload Route (Fallback) - Supabase persistent storage
app.post('/api/properties/upload', protect, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
  }
  // PHASE 1: image content must match its extension.
  try {
    upload.assertFileMagic(req.file.buffer, req.file.originalname);
  } catch (magicErr) {
    return res.status(400).json({ status: 'fail', message: magicErr.message });
  }
  try {
    const { uploadBuffer } = require('./services/supabaseStorageService');
    const { url, path: storagePath } = await uploadBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'properties'
    );
    res.status(200).json({ status: 'success', url, path: storagePath });
  } catch (err) {
    console.error('Property image upload failed:', err.message);
    // PHASE 1: never leak storage internals to the client in production.
    const message = process.env.NODE_ENV === 'production' ? 'Upload failed' : `Upload failed: ${err.message}`;
    res.status(500).json({ status: 'fail', message });
  }
});

// Health Check: liveness + DB reachability without leaking internals.
// 200 { db: 'up' } when the database answers, 503 { db: 'down' } otherwise
// (no error text, SQL state, hostnames, or credentials in the response).
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'OK', message: 'Express Server is running', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', message: 'Server running, database unavailable', db: 'down' });
  }
});

// API 404: JSON (not HTML) for unknown /api/* paths.
app.use('/api', (req, res) => {
  res.status(404).json({ status: 'fail', message: `Cannot ${req.method} ${req.path}` });
});

// Centralized error handler (must be the last app.use before the SPA fallback).
// - Multer/file errors and oversized bodies -> 400/413 with safe messages.
// - Production: generic message only (no stack, SQL, paths, or secrets).
// - Development: include message; full stack stays in server logs only.
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  console.error(JSON.stringify({
    type: 'error',
    ts: new Date().toISOString(),
    method: req.method,
    path: (req.baseUrl || '') + (req.path || ''),
    message: err && err.message ? err.message : 'Unknown error'
  }));
  if (res.headersSent) return next(err);
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ status: 'fail', message: 'Request body too large.' });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File too large. Maximum size is 10MB.'
      : 'File upload rejected.';
    return res.status(400).json({ status: 'fail', message });
  }
  if (err && err.message === 'CORS origin not allowed') {
    return res.status(403).json({ status: 'fail', message: 'Origin not allowed.' });
  }
  const status = (err && err.status) || 500;
  return res.status(status).json({
    status: 'error',
    message: isProd ? 'Internal server error.' : (err && err.message) || 'Internal server error.'
  });
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../public');
  app.use(express.static(frontendPath));
  
  // Express 5 compatible SPA fallback (regex; the legacy '*' pattern throws PathError on Express 5).
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Start Server
const startServer = async () => {
  // Fail fast on missing production secrets (PHASE 1). Throws before binding.
  assertProdEnv();

  // Connect to Database
  await connectDB();

  // Safe boot migration: creates missing tables/columns only,
  // never drops or alters existing data. Required because fresh
  // databases (and older ones predating new FK columns) otherwise
  // crash on first query (e.g. Expenses.createdByUserId).
  try {
    const bootMigrate = require('./seeders/bootMigrate');
    await bootMigrate();
  } catch (err) {
    console.log(`⚠️  Boot migration skipped: ${err.message}`);
  }
  
  // Run seeders
  // Seed component templates
  try {
    const seedComponentTemplates = require('./seeders/componentTemplatesSeeder');
    await seedComponentTemplates();
  } catch (err) {
    console.log('⚠️  Component templates seeding skipped');
  }

  // Seed feature flags
  try {
    const seedFeatureFlags = require('./seeders/featureFlagSeeder');
    await seedFeatureFlags();
  } catch (err) {
    console.log('⚠️  Feature flags seeding skipped');
  }

  // Seed permissions and roles
  try {
    const seedPermissions = require('./seeders/permissionSeeder');
    await seedPermissions();
  } catch (err) {
    console.log('⚠️  Permissions seeding skipped');
  }

  // Seed system settings
  try {
    const seedSystemSettings = require('./seeders/systemSettingsSeeder');
    await seedSystemSettings();
  } catch (err) {
    console.log('⚠️  System settings seeding skipped');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server is flying on http://localhost:${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  });
};

startServer();
