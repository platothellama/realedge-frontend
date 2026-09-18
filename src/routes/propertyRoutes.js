const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Property media upload (placed BEFORE any dynamic routes)
// Accepts photos (image), videos (video) and documents (file/document).
// Stores file in Supabase Storage (persistent) and returns a public URL.
// Frontend uploads one file per request and merges the returned URL into
// the property payload (photos / videos / documents) on create/edit.
const propertyMediaUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]);
router.post('/upload', protect, (req, res, next) => {
  propertyMediaUpload(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Images/documents max 10MB, videos max 100MB.'
        : (err.message || 'Upload failed');
      return res.status(400).json({ status: 'fail', message });
    }
    next();
  });
}, async (req, res) => {
  console.log('--- Upload Route Hit ---');
  const file =
    (req.files && (req.files.image?.[0] || req.files.video?.[0] || req.files.file?.[0] || req.files.document?.[0])) ||
    req.file;
  if (!file) {
    return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
  }
  const kind = file.fieldname === 'video' ? 'video'
    : (file.fieldname === 'file' || file.fieldname === 'document') ? 'document'
    : 'image';
  // Per-kind size caps (multer ceiling is 100MB for videos).
  const TEN_MB = 10 * 1024 * 1024;
  if ((kind === 'image' || kind === 'document') && file.size > TEN_MB) {
    return res.status(400).json({ status: 'fail', message: 'File too large. Images/documents max 10MB.' });
  }
  // PHASE 1: image content must match its extension.
  try {
    upload.assertFileMagic(file.buffer, file.originalname);
  } catch (magicErr) {
    return res.status(400).json({ status: 'fail', message: magicErr.message });
  }
  try {
    const { uploadBuffer } = require('../services/supabaseStorageService');
    const folder = kind === 'video' ? 'properties/videos'
      : kind === 'document' ? 'properties/documents'
      : 'properties';
    const { url, path: storagePath } = await uploadBuffer(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder
    );
    console.log('File uploaded:', url);
    res.status(200).json({ status: 'success', url, path: storagePath, kind });
  } catch (err) {
    console.error('Property media upload failed:', err.message);
    // PHASE 1: never leak storage internals to the client in production.
    const message = process.env.NODE_ENV === 'production' ? 'Upload failed' : `Upload failed: ${err.message}`;
    res.status(500).json({ status: 'fail', message });
  }
});

router.use(protect);

router.get('/', propertyController.getAllProperties);
router.get('/features', propertyController.getUniqueFeatures);
router.get('/:id', propertyController.getPropertyById);

router.post('/', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'), propertyController.createProperty);
router.post('/:id/negotiate', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'), propertyController.addNegotiation);
router.put('/:id', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'), propertyController.updateProperty);
router.delete('/:id', restrictTo('Super Admin', 'Admin', 'Office Manager'), propertyController.deleteProperty);

module.exports = router;
