const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', expenseController.getExpenses);
router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
router.patch('/:id/approve', expenseController.approveExpense);
router.delete('/:id', expenseController.deleteExpense);
router.get('/stats', expenseController.getExpenseStats);

module.exports = router;
