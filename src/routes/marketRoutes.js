const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/analysis', marketController.getMarketAnalysis);
router.get('/trends', marketController.getMarketTrends);
router.get('/location', marketController.getLocationInsights);
router.get('/intelligence', marketController.getMarketIntelligence);
router.post('/analyze', marketController.analyzeProperty);

module.exports = router;
