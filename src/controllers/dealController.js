const { Deal, Property, User, Lead, Seller, Group, DealCommission } = require('../models/associations');
const { Op } = require('sequelize');
const commissionService = require('../services/commissionService');

exports.getAllDeals = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    // Admin/Super Admin see all, others only see their own deals (where they are the broker or group member)
    let whereClause = {};
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      // Non-admins see deals where they are the broker OR belong to the group
      whereClause = {
        [Op.or]: [
          { brokerId: userId },
          { groupId: userId } // This would need additional logic to check group membership
        ]
      };
    }

    const deals = await Deal.findAll({
      where: whereClause,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'title', 'price', 'photos'] },
        { model: User, as: 'broker', attributes: ['id', 'name', 'photo'] },
        { model: Lead, as: 'buyerLead', attributes: ['id', 'name', 'email'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Group, as: 'dealGroup', attributes: ['id', 'name'] }
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
        { model: Lead, as: 'buyerLead' },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Group, as: 'dealGroup', attributes: ['id', 'name'] }
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
    const { newSeller, sellerId, ...dealData } = req.body;
    
    // Check if property is already sold
    if (dealData.propertyId) {
      const property = await Property.findByPk(dealData.propertyId);
      if (property && property.status === 'Sold') {
        return res.status(400).json({ message: 'Property is already sold and cannot be resold' });
      }
    }
    
    // Handle seller: either use existing sellerId or create new seller
    let finalSellerId = sellerId;
    
    if (newSeller && newSeller.name) {
      const existingSeller = await Seller.findOne({ where: { email: newSeller.email } });
      if (existingSeller) {
        finalSellerId = existingSeller.id;
      } else {
        const seller = await Seller.create(newSeller);
        finalSellerId = seller.id;
      }
    }
    
    if (finalSellerId) {
      dealData.sellerId = finalSellerId;
    }
    
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
    const deal = await Deal.findByPk(req.params.id, {
      include: [{ model: Property, as: 'property' }]
    });
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    const userRole = req.user.role;
    const userId = req.user.id;

    // Check permissions
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && deal.brokerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { newSeller, sellerId, ...updateData } = req.body;

    // Handle seller: either use existing sellerId or create new seller
    let finalSellerId = sellerId;
    
    if (newSeller && newSeller.name) {
      const existingSeller = await Seller.findOne({ where: { email: newSeller.email } });
      if (existingSeller) {
        finalSellerId = existingSeller.id;
      } else {
        const seller = await Seller.create(newSeller);
        finalSellerId = seller.id;
      }
    }
    
    if (finalSellerId) {
      updateData.sellerId = finalSellerId;
    }

    // COMMISSION RESTRICTION: Only Admin/Super Admin can edit commission
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      delete updateData.commission;
    }

    await deal.update(updateData);

    // Property locking: when deal reaches Reserved stage
    if (updateData.dealStage === 'Reserved' && deal.property) {
      await deal.property.update({ status: 'Reserved' });
    }

    // Auto-generate commission when deal is Closed
    if (updateData.dealStage === 'Closed') {
      if (deal.property && deal.property.status === 'Sold') {
        return res.status(400).json({ message: 'Property is already sold' });
      }

      if (deal.property) {
        const propertyUpdate = { status: 'Sold', soldAt: new Date() };
        
        const soldPrice = updateData.finalPrice || deal.finalPrice || deal.property.price;
        propertyUpdate.soldPrice = soldPrice;
        
        try {
          console.log('Calculating commission for deal:', deal.id, 'finalPrice:', soldPrice);
          const commissionResult = await commissionService.calculateDealCommission(deal.id);
          console.log('Commission calculated successfully:', commissionResult);
        } catch (commissionError) {
          console.error('Failed to auto-generate commission:', commissionError);
        }
        
        await deal.property.update(propertyUpdate);
      }
    }

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

exports.calculateDealCommission = async (req, res) => {
  try {
    const { id: dealId } = req.params;

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ status: 'fail', message: 'Deal not found' });
    }

    const result = await commissionService.calculateDealCommission(dealId);

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    res.status(400).json({ 
      status: 'error', 
      message: 'Error calculating commission', 
      error: error.message 
    });
  }
};

exports.getDealCommissions = async (req, res) => {
  try {
    const { id: dealId } = req.params;

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ status: 'fail', message: 'Deal not found' });
    }

    const commissions = await commissionService.getDealCommissions(dealId);

    res.status(200).json({
      status: 'success',
      data: commissions
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Error fetching commissions', 
      error: error.message 
    });
  }
};

exports.autoGenerateCommission = async (req, res) => {
  const transaction = await require('../config/database').sequelize.transaction();
  
  try {
    const { id: dealId } = req.params;
    const { finalPrice } = req.body;

    const deal = await Deal.findByPk(dealId, {
      include: [{ model: Property, as: 'property' }]
    });

    if (!deal) {
      return res.status(404).json({ status: 'fail', message: 'Deal not found' });
    }

    if (deal.dealStage !== 'Closed') {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Commission can only be generated for closed deals' 
      });
    }

    if (finalPrice) {
      await deal.update({ finalPrice }, { transaction });
    }

    const result = await commissionService.calculateDealCommission(dealId);

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Commission generated successfully',
      data: result
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ 
      status: 'error', 
      message: 'Error generating commission', 
      error: error.message 
    });
  }
};
