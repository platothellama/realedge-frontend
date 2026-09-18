const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

router.use(protect);

// QA hardening 2026-09-18: per-USER AI quota (was per-IP: one heavy user
// behind shared NAT ate everyone's budget, and one user could fan out across
// IPs). Runs after protect so req.user is available.
const aiUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id ? `ai:${req.user.id}` : `ai:ip:${req.ip}`),
  message: { status: 'fail', message: 'AI quota exceeded for now, please try again later.' }
});
router.use(aiUserLimiter);

// QA hardening 2026-09-18: bound free-text AI inputs (cost/abuse/injection
// surface). Legit clients send ≤2k chars; anything over 5k is rejected.
// GETs carry no body and pass straight through.
const MAX_AI_STRING = 5000;
const hasOversizeString = (val, depth = 0) => {
  if (typeof val === 'string') return val.length > MAX_AI_STRING;
  if (Array.isArray(val) && depth < 3) return val.some((v) => hasOversizeString(v, depth + 1));
  if (val && typeof val === 'object' && depth < 3) {
    return Object.values(val).some((v) => hasOversizeString(v, depth + 1));
  }
  return false;
};
router.use((req, res, next) => {
  if (req.method !== 'POST' || !req.body) return next();
  if (hasOversizeString(req.body)) {
    return res.status(400).json({ status: 'fail', message: 'Input too long. Please shorten your request.' });
  }
  next();
});

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
