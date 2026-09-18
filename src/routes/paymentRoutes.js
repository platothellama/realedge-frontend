const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// QA 2026-09-18: finance-only surface (mirrors the frontend route gate).
// Previously any authenticated role (incl. Client) could list/read/create
// any deal's payments and mutate payment plans.
router.use(protect);
router.use(restrictTo('Super Admin', 'Admin', 'Accountant'));

// NOTE: specific paths must be registered before '/:id' so they are not
// shadowed by the id param route.
router.get('/', paymentController.getAllPayments);
router.get('/deal/:dealId', paymentController.getDealPaymentSummary);
router.get('/cash-tracking', paymentController.getCashTracking);

router.get('/payment-plans', paymentController.getAllPaymentPlans);
router.get('/payment-plans/:id', paymentController.getPaymentPlanById);
router.post('/payment-plans', paymentController.createPaymentPlan);
router.patch('/payment-plans/:id', paymentController.updatePaymentPlan);
router.delete('/payment-plans/:id', paymentController.deletePaymentPlan);

router.get('/:id', paymentController.getPaymentById);
router.post('/', paymentController.createPayment);
router.patch('/:id', paymentController.updatePayment);
router.delete('/:id', paymentController.deletePayment);

module.exports = router;