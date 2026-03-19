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
    let invoiceWhere = {};

    if (userRole && userRole !== 'Super Admin' && userRole !== 'Admin') {
      leadWhere = { assignedToUserId: userId };
      dealWhere = { brokerId: userId };
      propertyWhere = { assignedToUserId: userId };
      commissionWhere = { agentId: userId };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

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
      propertyByStatus,
      propertyByType,
      leadBySource,
      leadByStatus
    ] = await Promise.all([
      Property.count({ where: propertyWhere }),
      Lead.count({ where: leadWhere }),
      Deal.count({ where: dealWhere }),
      User.count({ where: { active: true } }),
      Property.findAll({
        where: propertyWhere,
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'title', 'status', 'price', 'createdAt', 'type', 'city']
      }),
      Lead.findAll({
        where: leadWhere,
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'name', 'status', 'source', 'createdAt', 'phone']
      }),
      Deal.findAll({
        where: dealWhere,
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'title', 'dealStage', 'commission', 'createdAt', 'status']
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
      sequelize.query(`
        SELECT status, COUNT(*) as count 
        FROM Properties 
        ${userRole && userRole !== 'Super Admin' && userRole !== 'Admin' ? `WHERE assignedToUserId = '${userId}'` : ''}
        GROUP BY status
      `, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(`
        SELECT type, COUNT(*) as count 
        FROM Properties 
        ${userRole && userRole !== 'Super Admin' && userRole !== 'Admin' ? `WHERE assignedToUserId = '${userId}'` : ''}
        GROUP BY type
      `, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(`
        SELECT source, COUNT(*) as count 
        FROM Leads 
        ${userRole && userRole !== 'Super Admin' && userRole !== 'Admin' ? `WHERE assignedToUserId = '${userId}'` : ''}
        GROUP BY source
      `, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(`
        SELECT status, COUNT(*) as count 
        FROM Leads 
        ${userRole && userRole !== 'Super Admin' && userRole !== 'Admin' ? `WHERE assignedToUserId = '${userId}'` : ''}
        GROUP BY status
      `, { type: sequelize.QueryTypes.SELECT })
    ]);

    const totalRevenue = await Deal.sum('commission', { where: { ...dealWhere, dealStage: 'Closed' } }) || 0;
    const totalExpenses = await Expense.sum('amount', { where: expenseWhere }) || 0;

    const monthlyStats = await sequelize.query(`
      SELECT 
        DATE_FORMAT(closedAt, '%Y-%m') as month,
        SUM(commission) as revenue
      FROM Deals
      WHERE dealStage = 'Closed' AND closedAt IS NOT NULL
      ${userRole && userRole !== 'Super Admin' && userRole !== 'Admin' ? `AND brokerId = '${userId}'` : ''}
      GROUP BY DATE_FORMAT(closedAt, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `, { type: sequelize.QueryTypes.SELECT });

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
        propertyByStatus: propertyByStatus.map(p => ({
          label: p.status || 'Unknown',
          value: parseInt(p.count),
          color: getStatusColor(p.status)
        })),
        propertyByType: propertyByType.map(p => ({
          label: p.type || 'Unknown',
          value: parseInt(p.count),
          color: getTypeColor(p.type)
        })),
        leadBySource: leadBySource.map(l => ({
          label: l.source || 'Other',
          value: parseInt(l.count),
          color: getSourceColor(l.source)
        })),
        leadByStatus: leadByStatus.map(l => ({
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
