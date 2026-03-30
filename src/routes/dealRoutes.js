const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', dealController.getAllDeals);
router.get('/:id', dealController.getDealById);
router.post('/', dealController.createDeal);
router.patch('/:id', dealController.updateDeal);
router.delete('/:id', dealController.deleteDeal);

router.post('/:id/calculate-commission', dealController.calculateDealCommission);
router.post('/:id/generate-commission', dealController.autoGenerateCommission);
router.get('/:id/commissions', dealController.getDealCommissions);

module.exports = router;
