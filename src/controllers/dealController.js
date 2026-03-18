const { Deal, Property, User, Lead } = require('../models/associations');

exports.getAllDeals = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    // Admin/Super Admin see all, others only see their own deals (where they are the broker)
    let whereClause = {};
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      whereClause = { brokerId: userId };
    }

    const deals = await Deal.findAll({
      where: whereClause,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'title', 'price', 'photos'] },
        { model: User, as: 'broker', attributes: ['id', 'name', 'photo'] },
        { model: Lead, as: 'buyerLead', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(deals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching deals', error: error.message });
  }
};

exports.getDealById = async (req, res) => {
  try {
    const deal = await Deal.findByPk(req.params.id, {
      include: [
        { model: Property, as: 'property' },
        { model: User, as: 'broker', attributes: ['id', 'name', 'photo'] },
        { model: Lead, as: 'buyerLead' }
      ]
    });

    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    // Permissions check
    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && deal.brokerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.status(200).json(deal);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching deal', error: error.message });
  }
};

exports.createDeal = async (req, res) => {
  try {
    const dealData = { ...req.body };
    
    // Auto-assign broker if not provided
    if (!dealData.brokerId) {
      dealData.brokerId = req.user.id;
    }

    // Fetch property to calculate automatic commission
    if (dealData.propertyId) {
      const property = await Property.findByPk(dealData.propertyId);
      if (property && property.commissionPercentage > 0) {
        const autoCommission = (Number(property.price) * property.commissionPercentage) / 100;
        
        // Only override if user is NOT admin OR if commission wasn't explicitly provided
        const userRole = req.user.role;
        const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';
        
        if (!isAdmin || !dealData.commission) {
          dealData.commission = autoCommission;
        }
      }
    }

    const deal = await Deal.create(dealData);
    res.status(201).json(deal);
  } catch (error) {
    res.status(400).json({ message: 'Error creating deal', error: error.message });
  }
};

exports.updateDeal = async (req, res) => {
  try {
    const deal = await Deal.findByPk(req.params.id);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    const userRole = req.user.role;
    const userId = req.user.id;

    // Check permissions
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && deal.brokerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updateData = { ...req.body };

    // COMMISSION RESTRICTION: Only Admin/Super Admin can edit commission
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      delete updateData.commission;
    }

    await deal.update(updateData);
    res.status(200).json(deal);
  } catch (error) {
    res.status(400).json({ message: 'Error updating deal', error: error.message });
  }
};

exports.deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findByPk(req.params.id);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    const userRole = req.user.role;
    const userId = req.user.id;

    if (userRole !== 'Super Admin' && userRole !== 'Admin' && deal.brokerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await deal.destroy();
    res.status(200).json({ message: 'Deal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting deal', error: error.message });
  }
};
