const express = require('express');
const router = express.Router();
const marketingController = require('../controllers/marketingController');
const campaignController = require('../controllers/campaignController');
const callLogController = require('../controllers/callLogController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Marketing content generation
router.post('/generate', marketingController.generateMarketingContent);

// Campaigns
router.get('/campaigns', campaignController.getCampaigns);
router.post('/campaigns', campaignController.createCampaign);
router.put('/campaigns/:id', campaignController.updateCampaign);
router.delete('/campaigns/:id', campaignController.deleteCampaign);
router.post('/campaigns/:id/send', campaignController.sendCampaign);
router.get('/campaigns/stats', campaignController.getCampaignStats);

// Call Logs
router.get('/calls', callLogController.getCallLogs);
router.post('/calls', callLogController.createCallLog);
router.put('/calls/:id', callLogController.updateCallLog);
router.delete('/calls/:id', callLogController.deleteCallLog);
router.get('/calls/stats', callLogController.getCallStats);

module.exports = router;
