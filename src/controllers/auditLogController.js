const { AuditLog, User } = require('../models/associations');

exports.getAuditLogs = async (req, res) => {
  try {
    const { entityType, entityId, userId, action } = req.query;
    let where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const logs = await AuditLog.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 500
    });

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
  }
};

exports.createAuditLog = async (req, res) => {
  try {
    const log = await AuditLog.create({
      ...req.body,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json(log);
  } catch (error) {
    res.status(400).json({ message: 'Error creating audit log', error: error.message });
  }
};

exports.getAuditStats = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalLogs, todayLogs, byAction, byEntity] = await Promise.all([
      AuditLog.count(),
      AuditLog.count({ where: { createdAt: { [Op.gte]: today } } }),
      AuditLog.findAll({
        where: { createdAt: { [Op.gte]: weekAgo } },
        attributes: ['action', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
        group: ['action'],
        order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']],
        limit: 10
      }),
      AuditLog.findAll({
        where: { createdAt: { [Op.gte]: weekAgo } },
        attributes: ['entityType', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
        group: ['entityType'],
        order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']]
      })
    ]);

    res.status(200).json({
      totalLogs,
      todayLogs,
      byAction: byAction.map(a => ({ action: a.action, count: Number(a.dataValues.count) })),
      byEntity: byEntity.map(e => ({ entity: e.entityType, count: Number(e.dataValues.count) }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit stats', error: error.message });
  }
};
