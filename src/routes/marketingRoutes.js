const express = require('express');
const router = express.Router();
const marketingController = require('../controllers/marketingController');
const campaignController = require('../controllers/campaignController');
const callLogController = require('../controllers/callLogController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

router.use(protect);

// QA hardening 2026-09-18: content generation burns GPT budget per call —
// same throttle as /api/ai (which this route previously bypassed).
const marketingAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // QA hardening 2026-09-18: per-user quota (runs after protect).
  keyGenerator: (req) => (req.user && req.user.id ? `mkt:${req.user.id}` : `mkt:ip:${req.ip}`),
  message: { status: 'fail', message: 'AI quota exceeded for now, please try again later.' }
});

// Marketing content generation
router.post('/generate', marketingAiLimiter, marketingController.generateMarketingContent);

// Campaigns
router.get('/campaigns', campaignController.getCampaigns);
router.post('/campaigns', campaignController.createCampaign);
router.put('/campaigns/:id', campaignController.updateCampaign);
router.delete('/campaigns/:id', campaignController.deleteCampaign);
// QA hardening 2026-09-18: bulk email to all leads must not be sendable by
// every role (spam/reputation damage on misclick or compromised Agent/Client).
router.post('/campaigns/:id/send', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Marketing'), campaignController.sendCampaign);
router.get('/campaigns/stats', campaignController.getCampaignStats);

// Call Logs
router.get('/calls', callLogController.getCallLogs);
router.post('/calls', callLogController.createCallLog);
router.put('/calls/:id', callLogController.updateCallLog);
router.delete('/calls/:id', callLogController.deleteCallLog);
router.get('/calls/stats', callLogController.getCallStats);

module.exports = router;
