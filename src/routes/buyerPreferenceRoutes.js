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
router.post('/generate-embeddings', buyerPreferenceController.generatePropertyEmbeddings);
router.post('/explain-match', buyerPreferenceController.explainMatch);
router.post('/clear-cache', buyerPreferenceController.clearEmbeddingCache);

module.exports = router;
