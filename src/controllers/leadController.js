const { Lead, PriceHistory, Property, User, Visit, Deal, Task, Group } = require('../models/associations');

exports.convertToDeal = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name'] }
      ]
    });
    
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && lead.assignedToUserId !== userId) {
      return res.status(403).json({ message: 'Access denied: This lead is not assigned to you' });
    }

    const { propertyId, finalPrice, sellerName } = req.body;
    if (!propertyId) {
      return res.status(400).json({ message: 'Property ID is required to convert to deal' });
    }

    const property = await Property.findByPk(propertyId);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (property.status === 'Sold') {
      return res.status(400).json({ message: 'Property is already sold and cannot be resold' });
    }

    // PHASE 2 (D2/D3/D4): store the commission PERCENTAGE (no silent
    // default, no amount). Basis is the final/negotiated price; money is
    // resolved by commissionService at generate time.
    let commission = 0;
    if (property.commissionType === 'percentage' && property.commissionValue != null) {
      commission = Number(property.commissionValue);
    } else if (property.commissionPercentage) {
      commission = Number(property.commissionPercentage);
    }
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      return res.status(400).json({ message: 'Property commission percentage must be between 0 and 100' });
    }

    const deal = await Deal.create({
      title: `${lead.name} - ${property.title}`,
      buyerName: lead.name,
      sellerName: sellerName || 'Not specified',
      propertyId: propertyId,
      brokerId: lead.assignedToUserId || userId,
      buyerLeadId: lead.id,
      finalPrice: finalPrice || property.price,
      commission: commission,
      dealStage: 'Negotiation'
    });

    await lead.update({ status: 'Closed Deal' });

    res.status(201).json({ 
      message: 'Lead converted to deal successfully', 
      deal: deal 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error converting lead to deal', error: error.message });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const userRole = req.user.role;
    const userId = req.user.id;

    // Filter logic (PHASE 2 D18/D19): Admin/Super Admin/Accountant see all;
    // others see assigned leads plus leads of groups they belong to.
    const { Op: OpLead } = require('sequelize');
    let whereClause = {};
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && userRole !== 'Accountant') {
      let memberGroupIds = [];
      try {
        const { UserGroup: UG } = require('../models/associations');
        memberGroupIds = (await UG.findAll({ where: { userId }, attributes: ['groupId'] })).map(m => m.groupId);
      } catch (_) {}
      const or = [{ assignedToUserId: userId }];
      if (memberGroupIds.length > 0) or.push({ groupId: { [OpLead.in]: memberGroupIds } });
      whereClause = { [OpLead.or]: or };
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
        },
        {
          model: Deal,
          as: 'deals',
          include: [{ model: Property, as: 'property', attributes: ['id', 'title', 'address', 'city'] }]
        },
        {
          model: Task,
          as: 'tasks'
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
        },
        {
          model: Deal,
          as: 'deals',
          include: [{ model: Property, as: 'property', attributes: ['id', 'title', 'address', 'city'] }]
        },
        {
          model: Task,
          as: 'tasks'
        },
        {
          model: Group,
          as: 'group'
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
