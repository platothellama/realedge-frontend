const express = require('express');
const router = express.Router();
const commissionSettingsController = require('../controllers/commissionSettingsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
router.use(restrictTo('Super Admin', 'Admin', 'Accountant'));

router.get('/', commissionSettingsController.getAllSettings);
router.get('/settings', commissionSettingsController.getCommissionSettings);
router.put('/settings', commissionSettingsController.updateCommissionSettings);
router.put('/settings/:key', commissionSettingsController.updateSetting);

router.get('/summary', commissionSettingsController.getCommissionsSummary);

router.post('/commissions/:id/approve', commissionSettingsController.approveCommission);
router.post('/commissions/:id/paid', commissionSettingsController.markCommissionPaid);

module.exports = router;
