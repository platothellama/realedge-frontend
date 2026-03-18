const { Property, Lead, Deal, User } = require('../models/associations');
const { sequelize } = require('../config/database');

exports.getStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let leadWhere = {};
    let dealWhere = {};
    let propertyWhere = {};

    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      leadWhere = { assignedToUserId: userId };
      dealWhere = { brokerId: userId };
      propertyWhere = { assignedToUserId: userId };
    }

    const [totalProperties, totalLeads, totalDeals, activeBrokers] = await Promise.all([
      Property.count({ where: propertyWhere }),
      Lead.count({ where: leadWhere }),
      Deal.count({ where: dealWhere }),
      User.count({ where: { role: ['Broker', 'Agent'], active: true } })
    ]);

    const stats = [
      { label: 'Total Listings', value: totalProperties.toLocaleString(), icon: 'home', color: '#6366f1' },
      { label: 'Active Brokers', value: activeBrokers.toLocaleString(), icon: 'people', color: '#10b981' },
      { label: 'Active Leads', value: totalLeads.toLocaleString(), icon: 'trending_up', color: '#f59e0b' },
      { label: 'Tracked Deals', value: totalDeals.toLocaleString(), icon: 'handshake', color: '#8b5cf6' },
    ];

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};
