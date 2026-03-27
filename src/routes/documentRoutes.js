const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const rateLimit = require('express-rate-limit');

const signingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many signing attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(protect);

router.get('/', documentController.getDocuments);
router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.post('/:id/version', upload.single('file'), documentController.addVersion);
router.post('/:id/sign', documentController.signDocument);
router.post('/:id/generate-signing-link', documentController.generateSigningLink);
router.post('/sign/:id/:token', signingRateLimiter, documentController.signDocumentByToken);
router.get('/:id/audit-trail', documentController.getSignatureAuditTrail);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
