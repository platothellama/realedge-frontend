const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
// QA 2026-09-18: finance-only surface (mirrors the frontend route gate).
// Previously any authenticated role could read/mutate anyone's expenses.
router.use(restrictTo('Super Admin', 'Admin', 'Accountant'));

router.get('/', expenseController.getExpenses);
// PHASE 1: static paths before parametric ones (see invoiceRoutes).
router.get('/stats', expenseController.getExpenseStats);
router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
// PHASE 2 (D19): expense approval is Accountant/Admin-only.
router.patch('/:id/approve', restrictTo('Super Admin', 'Admin', 'Accountant'), expenseController.approveExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
