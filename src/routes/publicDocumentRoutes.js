const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

router.get('/:documentId/:token', documentController.getPublicSigningData);
router.post('/:documentId/:token', documentController.processPublicSignature);

module.exports = router;
