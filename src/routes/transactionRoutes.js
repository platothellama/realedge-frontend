const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
// QA 2026-09-18: finance-only surface (only the finance page consumes it,
// gated to Super Admin/Admin/Accountant in the frontend).
router.use(restrictTo('Super Admin', 'Admin', 'Accountant'));

router.get('/', transactionController.getTransactions);
router.get('/summary', transactionController.getFinancialSummary);
router.post('/', transactionController.createTransaction);
router.put('/:id', transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;
