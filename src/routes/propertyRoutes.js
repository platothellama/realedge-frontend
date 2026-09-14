const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Property image upload (placed BEFORE any dynamic routes)
// Stores file in Supabase Storage (persistent) and returns a public URL.
router.post('/upload', protect, upload.single('image'), async (req, res) => {
  console.log('--- Upload Route Hit ---');
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
  }
  try {
    const { uploadBuffer } = require('../services/supabaseStorageService');
    const { url, path: storagePath } = await uploadBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'properties'
    );
    console.log('File uploaded:', url);
    res.status(200).json({ status: 'success', url, path: storagePath });
  } catch (err) {
    console.error('Property image upload failed:', err.message);
    res.status(500).json({ status: 'fail', message: 'Upload failed', error: err.message });
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
