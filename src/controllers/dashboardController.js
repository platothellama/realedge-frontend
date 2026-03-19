const { Property, Lead, Deal, User, Commission, Expense, Invoice } = require('../models/associations');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

exports.getStats = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let leadWhere = {};
    let dealWhere = {};
    let propertyWhere = {};
    let commissionWhere = {};
    let expenseWhere = {};

    if (userRole && userRole !== 'Super Admin' && userRole !== 'Admin') {
      leadWhere = { assignedToUserId: userId };
      dealWhere = { brokerId: userId };
      propertyWhere = { assignedToUserId: userId };
      commissionWhere = { agentId: userId };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProperties,
      totalLeads,
      totalDeals,
      totalUsers,
      recentProperties,
      recentLeads,
      recentDeals,
      hotLeads,
      pendingCommissions,
      thisMonthRevenue,
      propertyStatusCounts,
      propertyTypeCounts,
      leadSourceCounts,
      leadStatusCounts
    ] = await Promise.all([
      Property.count({ where: propertyWhere }),
      Lead.count({ where: leadWhere }),
      Deal.count({ where: dealWhere }),
      User.count({ where: { active: true } }),
      Property.findAll({
        where: propertyWhere,
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'title', 'price', 'createdAt', 'type', 'city']
      }),
      Lead.findAll({
        where: leadWhere,
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'name', 'source', 'createdAt', 'phone']
      }),
      Deal.findAll({
        where: dealWhere,
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'title', 'dealStage', 'commission', 'createdAt']
      }),
      Lead.count({ where: { ...leadWhere, status: 'Hot' } }),
      Commission.sum('agentCommission', { where: { ...commissionWhere, status: 'pending' } }),
      Deal.sum('commission', {
        where: {
          ...dealWhere,
          dealStage: 'Closed',
          closedAt: { [Op.gte]: startOfMonth }
        }
      }),
      Property.findAll({
        where: propertyWhere,
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
        group: ['status']
      }),
      Property.findAll({
        where: propertyWhere,
        attributes: ['type', [sequelize.fn('COUNT', sequelize.col('type')), 'count']],
        group: ['type']
      }),
      Lead.findAll({
        where: leadWhere,
        attributes: ['source', [sequelize.fn('COUNT', sequelize.col('source')), 'count']],
        group: ['source']
      }),
      Lead.findAll({
        where: leadWhere,
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
        group: ['status']
      })
    ]);

    const totalRevenue = await Deal.sum('commission', { where: { ...dealWhere, dealStage: 'Closed' } }) || 0;
    const totalExpenses = await Expense.sum('amount', { where: expenseWhere }) || 0;

    const monthlyStats = await Deal.findAll({
      where: {
        ...dealWhere,
        dealStage: 'Closed',
        closedAt: { [Op.ne]: null }
      },
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('closedAt'), '%Y-%m'), 'month'],
        [sequelize.fn('SUM', sequelize.col('commission')), 'revenue']
      ],
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('closedAt'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('closedAt'), '%Y-%m'), 'DESC']],
      limit: 6,
      raw: true
    });

    const topAgents = await User.findAll({
      where: { role: { [Op.in]: ['Broker', 'Agent'] }, active: true },
      attributes: ['id', 'name', 'photo', 'role'],
      order: [['createdAt', 'ASC']],
      limit: 5
    });

    const stats = {
      overview: {
        totalProperties,
        totalLeads,
        totalDeals,
        totalUsers,
        hotLeads,
        totalRevenue,
        pendingCommissions: pendingCommissions || 0,
        thisMonthRevenue: thisMonthRevenue || 0,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses
      },
      charts: {
        propertyByStatus: propertyStatusCounts.map(p => ({
          label: p.status || 'Unknown',
          value: parseInt(p.count),
          color: getStatusColor(p.status)
        })),
        propertyByType: propertyTypeCounts.map(p => ({
          label: p.type || 'Unknown',
          value: parseInt(p.count),
          color: getTypeColor(p.type)
        })),
        leadBySource: leadSourceCounts.map(l => ({
          label: l.source || 'Other',
          value: parseInt(l.count),
          color: getSourceColor(l.source)
        })),
        leadByStatus: leadStatusCounts.map(l => ({
          label: l.status || 'Unknown',
          value: parseInt(l.count),
          color: getLeadStatusColor(l.status)
        })),
        monthlyRevenue: monthlyStats.reverse().map(m => ({
          label: m.month,
          value: parseFloat(m.revenue) || 0
        }))
      },
      recent: {
        properties: recentProperties,
        leads: recentLeads,
        deals: recentDeals
      },
      topAgents
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

function getStatusColor(status) {
  const colors = {
    'Available': '#10b981',
    'Reserved': '#f59e0b',
    'Sold': '#ef4444',
    'Rented': '#3b82f6'
  };
  return colors[status] || '#64748b';
}

function getTypeColor(type) {
  const colors = {
    'Apartment': '#3b82f6',
    'House': '#10b981',
    'Villa': '#8b5cf6',
    'Office': '#f59e0b',
    'Land': '#ef4444',
    'Commercial': '#06b6d4'
  };
  return colors[type] || '#64748b';
}

function getSourceColor(source) {
  const colors = {
    'Website': '#3b82f6',
    'Facebook': '#1877f2',
    'Instagram': '#e4405f',
    'Google Ads': '#4285f4',
    'Referral': '#10b981',
    'Walk-in': '#f59e0b',
    'Phone': '#8b5cf6'
  };
  return colors[source] || '#64748b';
}

function getLeadStatusColor(status) {
  const colors = {
    'New': '#3b82f6',
    'Contacted': '#8b5cf6',
    'Qualified': '#10b981',
    'Hot': '#ef4444',
    'Negotiation': '#f59e0b',
    'Visit Scheduled': '#06b6d4',
    'Closed Won': '#10b981',
    'Closed Lost': '#64748b'
  };
  return colors[status] || '#64748b';
}
