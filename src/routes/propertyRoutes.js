const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public upload route for images (placed BEFORE any dynamic routes)
router.post('/upload', protect, upload.single('image'), (req, res) => {
  console.log('--- Upload Route Hit ---');
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
  }
  const protocol = req.protocol;
  const host = req.get('host');
  const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  console.log('File uploaded:', imageUrl);
  res.status(200).json({ status: 'success', url: imageUrl });
});

router.use(protect);

router.get('/', propertyController.getAllProperties);
router.get('/:id', propertyController.getPropertyById);

router.post('/', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'), propertyController.createProperty);
router.post('/:id/negotiate', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'), propertyController.addNegotiation);
router.put('/:id', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'), propertyController.updateProperty);
router.delete('/:id', restrictTo('Super Admin', 'Admin', 'Office Manager'), propertyController.deleteProperty);

module.exports = router;
