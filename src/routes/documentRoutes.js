const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', documentController.getDocuments);
router.post('/upload', upload.array('files', 10), documentController.uploadDocument);
router.post('/:id/version', upload.single('file'), documentController.addVersion);
router.post('/:id/sign', documentController.signDocument);
router.post('/:id/signature-link', documentController.generateSignatureLink);
router.get('/:id/certificate', documentController.getSignatureCertificate);
router.put('/:id', documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
