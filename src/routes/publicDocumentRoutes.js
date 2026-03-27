const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const rateLimit = require('express-rate-limit');

const signingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many signing attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/:documentId/:token', documentController.getPublicSigningData);
router.post('/:documentId/:token', signingRateLimiter, documentController.processPublicSignature);
router.get('/:documentId/compliance-disclosures', documentController.getComplianceDisclosures);
router.post('/:documentId/:token/verify-email', documentController.verifySignerEmail);

module.exports = router;
