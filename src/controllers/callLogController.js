const { CallLog, Lead, Property, User } = require('../models/associations');

exports.getCallLogs = async (req, res) => {
  try {
    const { agentId, leadId, direction, status } = req.query;
    let where = {};
    if (agentId) where.agentId = agentId;
    if (leadId) where.leadId = leadId;
    if (direction) where.direction = direction;
    if (status) where.status = status;

    const callLogs = await CallLog.findAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] },
        { model: Property, as: 'property', attributes: ['id', 'title'] },
        { model: User, as: 'agent', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(callLogs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching call logs', error: error.message });
  }
};

exports.createCallLog = async (req, res) => {
  try {
    const callLog = await CallLog.create({
      ...req.body,
      agentId: req.user.id
    });
    res.status(201).json(callLog);
  } catch (error) {
    res.status(400).json({ message: 'Error creating call log', error: error.message });
  }
};

exports.updateCallLog = async (req, res) => {
  try {
    const callLog = await CallLog.findByPk(req.params.id);
    if (!callLog) return res.status(404).json({ message: 'Call log not found' });

    await callLog.update(req.body);
    res.status(200).json(callLog);
  } catch (error) {
    res.status(400).json({ message: 'Error updating call log', error: error.message });
  }
};

exports.deleteCallLog = async (req, res) => {
  try {
    const callLog = await CallLog.findByPk(req.params.id);
    if (!callLog) return res.status(404).json({ message: 'Call log not found' });

    await callLog.destroy();
    res.status(200).json({ message: 'Call log deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting call log', error: error.message });
  }
};

exports.getCallStats = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalCalls, todayCalls, totalDuration, inboundCalls, outboundCalls, byOutcome] = await Promise.all([
      CallLog.count(),
      CallLog.count({ where: { createdAt: { [Op.gte]: today } } }),
      CallLog.sum('duration'),
      CallLog.count({ where: { direction: 'inbound' } }),
      CallLog.count({ where: { direction: 'outbound' } }),
      CallLog.findAll({
        attributes: ['outcome', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
        group: ['outcome']
      })
    ]);

    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    res.status(200).json({
      totalCalls,
      todayCalls,
      totalDuration: Math.round(totalDuration / 60),
      avgDuration,
      inboundCalls,
      outboundCalls,
      byOutcome: byOutcome.map(o => ({ outcome: o.outcome, count: Number(o.dataValues.count) }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching call stats', error: error.message });
  }
};
