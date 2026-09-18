const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/commissionController');
const { protect, canManageFinance } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', commissionController.getCommissions);
router.get('/stats', commissionController.getCommissionStats);
router.post('/calculate', commissionController.calculateCommission);
router.post('/', commissionController.createCommission);
// QA hardening 2026-09-18: only finance roles may mark commissions paid/approved.
router.patch('/:id/status', canManageFinance, commissionController.updateCommissionStatus);

module.exports = router;
