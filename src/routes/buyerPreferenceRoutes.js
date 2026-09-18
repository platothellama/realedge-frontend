const express = require('express');
const router = express.Router();
const buyerPreferenceController = require('../controllers/buyerPreferenceController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', buyerPreferenceController.getAllBuyerPreferences);
router.get('/leads', buyerPreferenceController.getAvailableLeads);
router.get('/models', buyerPreferenceController.getEmbeddingModels);
router.get('/:id', buyerPreferenceController.getBuyerPreferenceById);
router.post('/', buyerPreferenceController.createBuyerPreference);
router.put('/:id', buyerPreferenceController.updateBuyerPreference);
router.delete('/:id', restrictTo('Super Admin', 'Admin'), buyerPreferenceController.deleteBuyerPreference);

router.post('/:id/match', buyerPreferenceController.matchPropertiesToBuyer);
router.post('/:id/wizard-search', buyerPreferenceController.wizardSearch);
router.post('/search', buyerPreferenceController.naturalLanguageSearch);
// QA hardening 2026-09-18: embedding generation / cache nukes burn OpenAI
// budget for the whole inventory — privileged roles only (no UI calls these;
// programmatic use only).
const embedAdmin = restrictTo('Super Admin', 'Admin', 'Office Manager', 'Marketing');
router.post('/generate-embeddings', embedAdmin, buyerPreferenceController.generatePropertyEmbeddings);
router.post('/explain-match', buyerPreferenceController.explainMatch);
router.post('/clear-cache', embedAdmin, buyerPreferenceController.clearEmbeddingCache);

module.exports = router;
