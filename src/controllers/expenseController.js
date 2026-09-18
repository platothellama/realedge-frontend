const { Expense, Property } = require('../models/associations');
const { Op } = require('sequelize');

exports.getExpenses = async (req, res) => {
  try {
    const { category, status, startDate, endDate } = req.query;
    let where = {};

    if (category) where.category = category;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.date = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const expenses = await Expense.findAll({
      where,
      include: [{ model: Property, as: 'property', attributes: ['id', 'title'] }],
      order: [['date', 'DESC']]
    });

    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expenses', ...require('../utils/http').safeError(error) });
  }
};

exports.createExpense = async (req, res) => {
  try {
    // QA hardening 2026-09-18: expenses are born Pending; Approved/Paid must
    // come from the approve / mark-paid flows (self-approval at creation
    // bypassed the Accountant/Admin gate).
    const { status, id, createdByUserId, ...body } = req.body || {};
    // QA hardening 2026-09-18: amounts are finite positives (negative/NaN
    // expenses previously persisted and poisoned sums).
    if (body.amount !== undefined) {
      const amt = Number(body.amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: 'Expense amount must be a positive number' });
      }
      body.amount = amt;
    }
    const expense = await Expense.create({ ...body, status: 'Pending', createdByUserId: req.user ? req.user.id : null });
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Error creating expense', ...require('../utils/http').safeError(error) });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    // QA hardening 2026-09-18: 'Approved' must go through
    // PATCH /:id/approve (Accountant/Admin). Other transitions (e.g. the
    // mark-as-paid UI flow) stay on this endpoint.
    const { status, id, createdByUserId, ...updatable } = req.body || {};
    if (status === 'Approved') {
      return res.status(403).json({ message: 'Approval requires the approve endpoint (Accountant/Admin).' });
    }
    if (updatable.amount !== undefined) {
      const amt = Number(updatable.amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: 'Expense amount must be a positive number' });
      }
      updatable.amount = amt;
    }
    await expense.update(status === undefined ? updatable : { ...updatable, status });
    res.status(200).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Error updating expense', ...require('../utils/http').safeError(error) });
  }
};

exports.approveExpense = async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    await expense.update({ status: 'Approved' });
    res.status(200).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Error approving expense', ...require('../utils/http').safeError(error) });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    // PHASE 2 (D21): Paid/Approved expenses are immutable (void-only).
    // Pending/Rejected may be deleted.
    if (expense.status === 'Paid' || expense.status === 'Approved') {
      return res.status(403).json({ message: `${expense.status} expenses cannot be deleted (void-only, D21).` });
    }

    await expense.destroy();
    res.status(200).json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting expense', ...require('../utils/http').safeError(error) });
  }
};

exports.getExpenseStats = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    const totalExpenses = await Expense.sum('amount', { where: { status: 'Paid' } }) || 0;
    const pendingExpenses = await Expense.sum('amount', { where: { status: 'Pending' } }) || 0;
    const approvedExpenses = await Expense.sum('amount', { where: { status: 'Approved' } }) || 0;
    const rejectedExpenses = await Expense.sum('amount', { where: { status: 'Rejected' } }) || 0;
    
    const pendingCount = await Expense.count({ where: { status: 'Pending' } });
    const approvedCount = await Expense.count({ where: { status: 'Approved' } });
    const paidCount = await Expense.count({ where: { status: 'Paid' } });
    
    const byCategory = await Expense.findAll({
      attributes: ['category', [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total'], [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
      where: { status: 'Paid' },
      group: ['category']
    });

    const byStatus = await Expense.findAll({
      attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'], [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']],
      group: ['status']
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const thisMonthExpenses = await Expense.sum('amount', { where: { status: 'Paid', date: { [Op.gte]: thisMonth } } }) || 0;
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthExpenses = await Expense.sum('amount', { where: { status: 'Paid', date: { [Op.between]: [lastMonth, thisMonth] } } }) || 0;

    const monthlyExpenses = await Expense.findAll({
      attributes: [
        [require('sequelize').fn('MONTH', require('sequelize').col('date')), 'month'],
        [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']
      ],
      where: { status: 'Paid' },
      group: [require('sequelize').fn('MONTH', require('sequelize').col('date'))],
      order: [[require('sequelize').fn('MONTH', require('sequelize').col('date')), 'ASC']],
      limit: 6
    });

    res.status(200).json({
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      rejectedExpenses,
      pendingCount,
      approvedCount,
      paidCount,
      thisMonthExpenses,
      lastMonthExpenses,
      changePercent: lastMonthExpenses > 0 ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses * 100).toFixed(1) : 0,
      byCategory: byCategory.map(c => ({ category: c.category, total: Number(c.dataValues.total), count: Number(c.dataValues.count) })),
      byStatus: byStatus.map(s => ({ status: s.status, count: Number(s.dataValues.count), total: Number(s.dataValues.total) })),
      monthlyExpenses
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expense stats', ...require('../utils/http').safeError(error) });
  }
};
