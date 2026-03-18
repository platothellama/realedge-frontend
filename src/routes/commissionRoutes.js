const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/commissionController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', commissionController.getCommissions);
router.get('/stats', commissionController.getCommissionStats);
router.post('/calculate', commissionController.calculateCommission);
router.post('/', commissionController.createCommission);
router.patch('/:id/status', commissionController.updateCommissionStatus);

module.exports = router;
