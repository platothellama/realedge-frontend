const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

router.get('/sign/:documentId/:token', documentController.getPublicSigningData);
router.post('/sign/:documentId/:token', documentController.processPublicSignature);

module.exports = router;
