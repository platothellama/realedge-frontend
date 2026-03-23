const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { connectDB, sequelize } = require('./config/database');
const propertyRoutes = require('./routes/propertyRoutes');
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
const teamRoutes = require('./routes/teamRoutes');
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
const upload = require('./middleware/uploadMiddleware');
const { protect } = require('./middleware/authMiddleware');
require('./models/associations');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/properties', propertyRoutes);
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
app.use('/api/teams', teamRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/buyer-preferences', buyerPreferenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/features', featureFlagRoutes);
app.use('/api/payments', paymentRoutes);

// Direct Upload Route (Fallback)
app.post('/api/properties/upload', protect, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
  }
  const protocol = req.protocol;
  const host = req.get('host');
  const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.status(200).json({ status: 'success', url: imageUrl });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Express Server is running' });
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../public');
  app.use(express.static(frontendPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Start Server
const startServer = async () => {
  // Connect to Database
  await connectDB();
  
  // Sync Models
  try {
    await sequelize.sync({ alter: true });
    console.log('📦 Database models synced.');
  } catch (err) {
    console.error('❌ Database sync error:', err.message);
  }

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

  app.listen(PORT, () => {
    console.log(`🚀 Server is flying on http://localhost:${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  });
};

startServer();
