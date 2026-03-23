const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/payments', paymentController.getAllPayments);
router.get('/payments/deal/:dealId', paymentController.getDealPaymentSummary);
router.get('/payments/:id', paymentController.getPaymentById);
router.post('/payments', paymentController.createPayment);
router.patch('/payments/:id', paymentController.updatePayment);
router.delete('/payments/:id', paymentController.deletePayment);

router.get('/cash-tracking', paymentController.getCashTracking);

router.get('/payment-plans', paymentController.getAllPaymentPlans);
router.get('/payment-plans/:id', paymentController.getPaymentPlanById);
router.post('/payment-plans', paymentController.createPaymentPlan);
router.patch('/payment-plans/:id', paymentController.updatePaymentPlan);
router.delete('/payment-plans/:id', paymentController.deletePaymentPlan);

module.exports = router;