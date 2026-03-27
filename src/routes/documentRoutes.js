const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', documentController.getDocuments);
router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.post('/:id/version', upload.single('file'), documentController.addVersion);
router.post('/:id/sign', documentController.signDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
