const { Commission, Deal, Property, User, Group } = require('../models/associations');

exports.getCommissions = async (req, res) => {
  try {
    const { status, agentId, groupId } = req.query;
    let where = {};
    if (status) where.status = status;
    if (agentId) where.agentId = agentId;
    if (groupId) where.groupId = groupId;

    const commissions = await Commission.findAll({
      where,
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title'] },
        { model: Property, as: 'property', attributes: ['id', 'title'] },
        { model: User, as: 'agent', attributes: ['id', 'name', 'photo'] },
        { model: User, as: 'agent2', attributes: ['id', 'name', 'photo'] },
        { model: Group, as: 'group', attributes: ['id', 'name', 'commissionSplit'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(commissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching commissions', error: error.message });
  }
};

exports.calculateCommission = async (req, res) => {
  try {
    const { 
      dealId, 
      agentSharePercentage = 60, 
      agent2Id, 
      agent2SharePercentage = 0,
      groupId,
      companySharePercentage = 40 
    } = req.body;

    const deal = await Deal.findByPk(dealId, {
      include: [
        { model: Property, as: 'property' },
        { model: Group, as: 'group' }
      ]
    });
    
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    const salePrice = deal.finalPrice;
    const commissionPercentage = deal.commission || 2;
    const grossCommission = salePrice * (commissionPercentage / 100);

    let splitType = 'single';
    let agentCommission = 0;
    let agent2Commission = 0;
    let groupCommission = 0;
    let officeCommission = 0;

    if (agent2Id && agent2SharePercentage > 0) {
      splitType = 'multi_agent';
      agentCommission = grossCommission * (agentSharePercentage / 100);
      agent2Commission = grossCommission * (agent2SharePercentage / 100);
      officeCommission = grossCommission - agentCommission - agent2Commission;
    } else if (groupId) {
      splitType = 'group';
      const group = await Group.findByPk(groupId);
      const groupSplit = group?.commissionSplit || 60;
      const agentPortion = agentSharePercentage * (groupSplit / 100);
      agentCommission = grossCommission * (agentPortion / 100);
      groupCommission = grossCommission * ((100 - groupSplit) / 100);
      officeCommission = grossCommission - agentCommission - groupCommission;
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
      groupId: groupId || null,
      groupCommission: groupCommission || 0,
      companySharePercentage,
      officeCommission
    });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating commission', error: error.message });
  }
};

exports.createCommission = async (req, res) => {
  try {
    const { 
      dealId, 
      agentId, 
      salePrice, 
      commissionPercentage, 
      agentSharePercentage = 60,
      agent2Id,
      agent2SharePercentage = 0,
      groupId,
      companySharePercentage = 40
    } = req.body;

    const grossCommission = salePrice * (commissionPercentage / 100);
    let splitType = 'single';
    let agentCommission = 0;
    let agent2Commission = 0;
    let groupCommission = 0;
    let officeCommission = 0;

    if (agent2Id && agent2SharePercentage > 0) {
      splitType = 'multi_agent';
      agentCommission = grossCommission * (agentSharePercentage / 100);
      agent2Commission = grossCommission * (agent2SharePercentage / 100);
      officeCommission = grossCommission - agentCommission - agent2Commission;
    } else if (groupId) {
      splitType = 'group';
      const group = await Group.findByPk(groupId);
      const groupSplit = group?.commissionSplit || 60;
      const agentPortion = agentSharePercentage * (groupSplit / 100);
      agentCommission = grossCommission * (agentPortion / 100);
      groupCommission = grossCommission * ((100 - groupSplit) / 100);
      officeCommission = grossCommission - agentCommission - groupCommission;
    } else {
      agentCommission = grossCommission * (agentSharePercentage / 100);
      officeCommission = grossCommission - agentCommission;
    }

    const commission = await Commission.create({
      dealId,
      agentId,
      propertyId: req.body.propertyId,
      groupId,
      salePrice,
      commissionPercentage,
      grossCommission,
      splitType,
      agentSharePercentage,
      agentCommission,
      agent2Id: agent2Id || null,
      agent2SharePercentage: agent2SharePercentage || 0,
      agent2Commission: agent2Commission || 0,
      teamSharePercentage: groupId ? 100 - (group?.commissionSplit || 60) : 0,
      teamCommission: groupCommission || 0,
      groupSharePercentage: groupId ? 100 - (group?.commissionSplit || 60) : 0,
      groupCommission: groupCommission || 0,
      companySharePercentage,
      officeCommission,
      status: 'pending'
    });

    res.status(201).json(commission);
  } catch (error) {
    res.status(400).json({ message: 'Error creating commission', error: error.message });
  }
};

exports.updateCommissionStatus = async (req, res) => {
  try {
    const commission = await Commission.findByPk(req.params.id);
    if (!commission) return res.status(404).json({ message: 'Commission not found' });

    const { status, paidAmount } = req.body;
    
    if (status === 'paid' && paidAmount) {
      await commission.update({
        status,
        paidAmount: commission.paidAmount + paidAmount,
        paidAt: new Date()
      });
    } else {
      await commission.update({ status });
    }

    res.status(200).json(commission);
  } catch (error) {
    res.status(400).json({ message: 'Error updating commission', error: error.message });
  }
};

exports.getCommissionStats = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    const [totalPending, totalApproved, totalPaid, pendingCount, approvedCount, paidCount, officeTotal, groupTotal] = await Promise.all([
      Commission.sum('agentCommission', { where: { status: 'pending' } }),
      Commission.sum('agentCommission', { where: { status: 'approved' } }),
      Commission.sum('agentCommission', { where: { status: { [Op.in]: ['paid', 'disbursed'] } } }),
      Commission.count({ where: { status: 'pending' } }),
      Commission.count({ where: { status: 'approved' } }),
      Commission.count({ where: { status: { [Op.in]: ['paid', 'disbursed'] } } }),
      Commission.sum('officeCommission', { where: { status: { [Op.in]: ['paid', 'disbursed'] } } }),
      Commission.sum('groupCommission', { where: { status: { [Op.in]: ['paid', 'disbursed'] } } })
    ]);

    const byAgent = await Commission.findAll({
      where: { status: { [Op.in]: ['paid', 'disbursed'] } },
      include: [{ model: User, as: 'agent', attributes: ['id', 'name'] }],
      attributes: ['agentId', [require('sequelize').fn('SUM', require('sequelize').col('agentCommission')), 'total']],
      group: ['agentId', 'agent.id']
    });

    const byStatus = await Commission.findAll({
      attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'], [require('sequelize').fn('SUM', require('sequelize').col('grossCommission')), 'total']],
      group: ['status']
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const thisMonthPaid = await Commission.sum('agentCommission', { 
      where: { 
        status: { [Op.in]: ['paid', 'disbursed'] },
        paidAt: { [Op.gte]: thisMonth }
      }
    }) || 0;

    res.status(200).json({
      totalPending: totalPending || 0,
      totalApproved: totalApproved || 0,
      totalPaid: totalPaid || 0,
      officeTotal: officeTotal || 0,
      groupTotal: groupTotal || 0,
      pendingCount: pendingCount || 0,
      approvedCount: approvedCount || 0,
      paidCount: paidCount || 0,
      thisMonthPaid,
      byAgent: byAgent.map(a => ({ agentId: a.agentId, agentName: a.agent?.name, total: Number(a.dataValues.total) })),
      byStatus: byStatus.map(s => ({ status: s.status, count: Number(s.dataValues.count), total: Number(s.dataValues.total) }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching commission stats', error: error.message });
  }
};
