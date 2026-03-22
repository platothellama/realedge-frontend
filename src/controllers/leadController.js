const { Lead, PriceHistory, Property, User, Visit } = require('../models/associations');

exports.getAllLeads = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const userRole = req.user.role;
    const userId = req.user.id;

    // Filter logic: Admin/Super Admin see all, others see only assigned leads
    let whereClause = {};
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      whereClause = { assignedToUserId: userId };
    }

    const leads = await Lead.findAll({
      where: whereClause,
      include: [
        {
          model: PriceHistory, 
          as: 'negotiations',
          include: [{ model: Property, attributes: ['id', 'title'] }]
        },
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'photo']
        },
        {
          model: Visit,
          as: 'visits',
          include: [{ model: Property, as: 'property', attributes: ['id', 'title', 'address', 'city'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        {
          model: PriceHistory, 
          as: 'negotiations',
          include: [{ model: Property, attributes: ['id', 'title'] }]
        },
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'photo']
        },
        {
          model: Visit,
          as: 'visits',
          include: [{ model: Property, as: 'property', attributes: ['id', 'title', 'address', 'city'] }]
        }
      ]
    });
    
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Check permissions
    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && lead.assignedToUserId !== userId) {
      return res.status(403).json({ message: 'Access denied: This lead is not assigned to you' });
    }

    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lead', error: error.message });
  }
};

exports.createLead = async (req, res) => {
  try {
    const leadData = { ...req.body };
    
    // Auto-assign to current user if no assignment specified
    if (!leadData.assignedToUserId) {
      leadData.assignedToUserId = req.user.id;
    }

    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'A lead with this email or phone already exists.' });
    }
    res.status(400).json({ message: 'Error creating lead', error: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Check permissions
    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && lead.assignedToUserId !== userId) {
      return res.status(403).json({ message: 'Access denied: You cannot update a lead that is not assigned to you' });
    }

    await lead.update(req.body);
    res.status(200).json(lead);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'A lead with this email or phone already exists.' });
    }
    res.status(400).json({ message: 'Error updating lead', error: error.message });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Check permissions
    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && lead.assignedToUserId !== userId) {
      return res.status(403).json({ message: 'Access denied: You cannot delete a lead that is not assigned to you' });
    }

    await lead.destroy();
    res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting lead', error: error.message });
  }
};
