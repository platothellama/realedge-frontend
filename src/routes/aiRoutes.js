const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/property-valuation', aiController.propertyValuation);
router.post('/market-analysis', aiController.marketAnalysis);
router.post('/lead-scoring', aiController.leadScoring);
router.post('/generate-description', aiController.generatePropertyDescription);
router.post('/marketing-content', aiController.generateMarketingContent);
router.get('/predictive-analytics', aiController.predictiveAnalytics);
router.get('/insights', aiController.getAiInsights);
router.get('/lead-scores', aiController.getAllLeadScores);
router.get('/property-valuations', aiController.getAllPropertyValuations);

router.post('/match-properties', aiController.matchPropertiesToLead);
router.post('/generate-listing', aiController.generatePropertyListing);
router.post('/generate-communication', aiController.generateClientCommunication);
router.post('/generate-market-report', aiController.generateMarketReport);
router.post('/investment-recommendations', aiController.getInvestmentRecommendations);
router.post('/assistant', aiController.aiAssistant);

module.exports = router;
