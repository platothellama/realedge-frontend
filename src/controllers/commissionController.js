const { Commission, Deal, Property, User } = require('../models/associations');

exports.getCommissions = async (req, res) => {
  try {
    const { status, agentId } = req.query;
    const { Op } = require('sequelize');

    // QA hardening 2026-09-18: non-finance callers see only their own rows
    // (previously anyone's pay enumerable via ?agentId=).
    const role = req.user?.role;
    const finance = role === 'Super Admin' || role === 'Admin' || role === 'Accountant';
    let where = {};
    if (status) where.status = status;
    if (finance) {
      if (agentId) where.agentId = agentId;
    } else {
      where[Op.or] = [{ agentId: req.user.id }, { agent2Id: req.user.id }];
    }

    const commissions = await Commission.findAll({
      where,
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title'] },
        { model: Property, as: 'property', attributes: ['id', 'title'] },
        { model: User, as: 'agent', attributes: ['id', 'name', 'photo'] },
        { model: User, as: 'agent2', attributes: ['id', 'name', 'photo'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(commissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching commissions', ...require('../utils/http').safeError(error) });
  }
};

// PHASE 2 (D1): legacy Commission is FROZEN read-only. DealCommission is
// canonical. Reads (getCommissions, getCommissionStats, status updates for
// historical rows) remain; new calculations/creations are gone (410).
exports.calculateCommission = async (req, res) => {
  return res.status(410).json({ message: 'Legacy commission calculation removed. Use DealCommission via /api/deals/:id/calculate|generate-commission (D1).' });
  try {
    const { 
      dealId, 
      agentSharePercentage = 60, 
      agent2Id, 
      agent2SharePercentage = 0,
      companySharePercentage = 40 
    } = req.body;

    const deal = await Deal.findByPk(dealId, {
      include: [
        { model: Property, as: 'property' }
      ]
    });
    
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    const salePrice = deal.finalPrice;
    const commissionPercentage = deal.commission || 2;
    const grossCommission = salePrice * (commissionPercentage / 100);

    let splitType = 'single';
    let agentCommission = 0;
    let agent2Commission = 0;
    let officeCommission = 0;

    if (agent2Id && agent2SharePercentage > 0) {
      splitType = 'multi_agent';
      agentCommission = grossCommission * (agentSharePercentage / 100);
      agent2Commission = grossCommission * (agent2SharePercentage / 100);
      officeCommission = grossCommission - agentCommission - agent2Commission;
    } else {
      agentCommission = grossCommission * (agentSharePercentage / 100);
      officeCommission = grossCommission - agentCommission;
    }

    res.status(200).json({
      salePrice,
      commissionPercentage,
      grossCommission,
      splitType,
      agentSharePercentage,
      agentCommission,
      agent2Id: agent2Id || null,
      agent2SharePercentage: agent2SharePercentage || 0,
      agent2Commission: agent2Commission || 0,
      companySharePercentage,
      officeCommission
    });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating commission', ...require('../utils/http').safeError(error) });
  }
};

exports.createCommission = async (req, res) => {
  return res.status(410).json({ message: 'Legacy commission creation removed. Use DealCommission via /api/deals/:id/calculate|generate-commission (D1).' });
  try {
    const { 
      dealId, 
      agentId, 
      salePrice, 
      commissionPercentage, 
      agentSharePercentage = 60,
      agent2Id,
      agent2SharePercentage = 0,
      companySharePercentage = 40
    } = req.body;

    const grossCommission = salePrice * (commissionPercentage / 100);
    let splitType = 'single';
    let agentCommission = 0;
    let agent2Commission = 0;
    let officeCommission = 0;

    if (agent2Id && agent2SharePercentage > 0) {
      splitType = 'multi_agent';
      agentCommission = grossCommission * (agentSharePercentage / 100);
      agent2Commission = grossCommission * (agent2SharePercentage / 100);
      officeCommission = grossCommission - agentCommission - agent2Commission;
    } else {
      agentCommission = grossCommission * (agentSharePercentage / 100);
      officeCommission = grossCommission - agentCommission;
    }

    const commission = await Commission.create({
      dealId,
      agentId,
      propertyId: req.body.propertyId,
      salePrice,
      commissionPercentage,
      grossCommission,
      splitType,
      agentSharePercentage,
      agentCommission,
      agent2Id: agent2Id || null,
      agent2SharePercentage: agent2SharePercentage || 0,
      agent2Commission: agent2Commission || 0,
      companySharePercentage,
      officeCommission,
      status: 'pending'
    });

    res.status(201).json(commission);
  } catch (error) {
    res.status(400).json({ message: 'Error creating commission', ...require('../utils/http').safeError(error) });
  }
};

exports.updateCommissionStatus = async (req, res) => {
  try {
    const commission = await Commission.findByPk(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Commission not found' });

    const { status, paidAmount } = req.body;

    // QA hardening 2026-09-18: reject unknown statuses (legacy ENUM:
    // pending | approved | paid | disbursed) instead of persisting garbage.
    const allowedStatuses = ['pending', 'approved', 'paid', 'disbursed'];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
    }
    if (paidAmount !== undefined && (typeof paidAmount !== 'number' || !(paidAmount > 0))) {
      return res.status(400).json({ message: 'paidAmount must be a positive number' });
    }
    
    if (status === 'paid' && paidAmount) {
      // QA hardening 2026-09-18: cumulative partial pays cannot exceed the
      // agent's share (previously unbounded accumulation).
      const cap = Number(commission.agentCommission);
      const running = Number(commission.paidAmount || 0) + paidAmount;
      if (Number.isFinite(cap) && cap > 0 && running - cap > 0) {
        return res.status(400).json({ message: `Overpayment rejected: cumulative ${running} exceeds share ${cap}` });
      }
      await commission.update({
        status,
        paidAmount: running,
        paidAt: new Date()
      });
    } else {
      await commission.update({ status });
    }

    res.status(200).json(commission);
  } catch (error) {
    res.status(400).json({ message: 'Error updating commission', ...require('../utils/http').safeError(error) });
  }
};

exports.getCommissionStats = async (req, res) => {
  try {
    const { Op } = require('sequelize');

    // QA hardening 2026-09-18: stats scoped like the list (own rows unless
    // finance). The company-wide byAgent/byStatus breakdowns stay
    // finance-only (they enumerate everyone's pay).
    const role = req.user?.role;
    const finance = role === 'Super Admin' || role === 'Admin' || role === 'Accountant';
    const scope = finance ? {} : { [Op.or]: [{ agentId: req.user.id }, { agent2Id: req.user.id }] };

    const [totalPending, totalApproved, totalPaid, pendingCount, approvedCount, paidCount, officeTotal] = await Promise.all([
      Commission.sum('agentCommission', { where: { ...scope, status: 'pending' } }),
      Commission.sum('agentCommission', { where: { ...scope, status: 'approved' } }),
      Commission.sum('agentCommission', { where: { ...scope, status: { [Op.in]: ['paid', 'disbursed'] } } }),
      Commission.count({ where: { ...scope, status: 'pending' } }),
      Commission.count({ where: { ...scope, status: 'approved' } }),
      Commission.count({ where: { ...scope, status: { [Op.in]: ['paid', 'disbursed'] } } }),
      Commission.sum('officeCommission', { where: { ...scope, status: { [Op.in]: ['paid', 'disbursed'] } } })
    ]);

    const byAgent = finance ? await Commission.findAll({
      where: { status: { [Op.in]: ['paid', 'disbursed'] } },
      include: [{ model: User, as: 'agent', attributes: ['id', 'name'] }],
      attributes: ['agentId', [require('sequelize').fn('SUM', require('sequelize').col('agentCommission')), 'total']],
      group: ['agentId', 'agent.id']
    }) : [];

    const byStatus = finance ? await Commission.findAll({
      attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'], [require('sequelize').fn('SUM', require('sequelize').col('grossCommission')), 'total']],
      group: ['status']
    }) : [];

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthPaid = await Commission.sum('agentCommission', {
      where: {
        ...scope,
        status: { [Op.in]: ['paid', 'disbursed'] },
        paidAt: { [Op.gte]: thisMonth }
      }
    }) || 0;

    res.status(200).json({
      totalPending: totalPending || 0,
      totalApproved: totalApproved || 0,
      totalPaid: totalPaid || 0,
      officeTotal: officeTotal || 0,
      pendingCount: pendingCount || 0,
      approvedCount: approvedCount || 0,
      paidCount: paidCount || 0,
      thisMonthPaid,
      byAgent: byAgent.map(a => ({ agentId: a.agentId, agentName: a.agent?.name, total: Number(a.dataValues.total) })),
      byStatus: byStatus.map(s => ({ status: s.status, count: Number(s.dataValues.count), total: Number(s.dataValues.total) }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching commission stats', ...require('../utils/http').safeError(error) });
  }
};
