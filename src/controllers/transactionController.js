const { Transaction, Property, Deal, User } = require('../models/associations');
const { Op } = require('sequelize');

exports.getTransactions = async (req, res) => {
  try {
    const { type, category, startDate, endDate } = req.query;
    let where = {};

    if (type) where.type = type;
    if (category) where.category = category;
    if (startDate && endDate) {
      where.date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const transactions = await Transaction.findAll({
      where,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'title'] },
        { model: Deal, as: 'deal', attributes: ['id', 'title'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] }
      ],
      order: [['date', 'DESC']]
    });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

exports.getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const where = { date: { [Op.between]: [start, end] } };

    // PHASE 2 (D25): finance summary counts completed only (cancelled/
    // pending excluded). Currency is USD-reporting (D10); LBP rows need a
    // converted amountInUSD equivalent in a follow-up migration — for now
    // completed USD rows are authoritative.
    const doneWhere = { status: 'completed' };
    const [income, expenses, incomeByCategory, expensesByCategory, monthlyData] = await Promise.all([
      Transaction.sum('amount', { where: { type: 'income', status: 'completed', ...where } }),
      Transaction.sum('amount', { where: { type: 'expense', status: 'completed', ...where } }),
      Transaction.findAll({
        where: { type: 'income', ...where },
        attributes: ['category', [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']],
        group: ['category']
      }),
      Transaction.findAll({
        where: { type: 'expense', ...where },
        attributes: ['category', [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']],
        group: ['category']
      }),
      Transaction.findAll({
        where,
        attributes: [
          'type',
          [require('sequelize').fn('MONTH', require('sequelize').col('date')), 'month'],
          [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']
        ],
        group: ['type', 'month']
      })
    ]);

    res.status(200).json({
      totalIncome: income || 0,
      totalExpenses: expenses || 0,
      netProfit: (income || 0) - (expenses || 0),
      incomeByCategory,
      expensesByCategory,
      monthlyData
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching financial summary', error: error.message });
  }
};

exports.createTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.create({
      ...req.body,
      userId: req.user.id
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ message: 'Error creating transaction', error: error.message });
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    await transaction.update(req.body);
    res.status(200).json(transaction);
  } catch (error) {
    res.status(400).json({ message: 'Error updating transaction', error: error.message });
  }
};

// PHASE 2 (D21): transactions are immutable — void via status cancelled,
// never hard-delete.
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    return res.status(403).json({ message: 'Transactions cannot be deleted (void-only). Set status to cancelled instead (D21).' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction', error: error.message });
  }
};
