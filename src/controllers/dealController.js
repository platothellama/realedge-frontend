const { Deal, Property, User, Lead, Seller, Group, DealCommission } = require('../models/associations');
const { Op } = require('sequelize');
const commissionService = require('../services/commissionService');

exports.getAllDeals = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    // PHASE 2 (D18/D19): Admin/Super Admin/Accountant see all; others see
    // own deals plus deals of groups they belong to (team visibility).
    let whereClause = {};
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && userRole !== 'Accountant') {
      let memberGroupIds = [];
      try {
        const { UserGroup } = require('../models/associations');
        const memberships = await UserGroup.findAll({ where: { userId }, attributes: ['groupId'] });
        memberGroupIds = memberships.map(m => m.groupId);
      } catch (_) { /* fall back to broker-only on lookup failure */ }
      const or = [{ brokerId: userId }];
      if (memberGroupIds.length > 0) or.push({ groupId: { [Op.in]: memberGroupIds } });
      whereClause = { [Op.or]: or };
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

    // Permissions check (PHASE 2 D18/D19: broker, team member, Accountant, Admin)
    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && userRole !== 'Accountant' && deal.brokerId !== userId) {
      let isMember = false;
      try {
        if (deal.groupId) {
          const { UserGroup } = require('../models/associations');
          isMember = !!(await UserGroup.findOne({ where: { userId, groupId: deal.groupId } }));
        }
      } catch (_) {}
      if (!isMember) return res.status(403).json({ message: 'Access denied' });
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
    
    if (!dealData.sellerName && dealData.propertyId) {
      const propertyWithSeller = await Property.findByPk(dealData.propertyId, {
        include: [{ model: Seller, as: 'seller' }]
      });
      if (propertyWithSeller?.seller) {
        dealData.sellerName = propertyWithSeller.seller.name;
        if (!dealData.sellerId) {
          dealData.sellerId = propertyWithSeller.seller.id;
        }
      } else {
        return res.status(400).json({ 
          message: 'Cannot create deal: Property has no seller assigned. Please assign a seller to this property first.' 
        });
      }
    }
    
    // Auto-assign broker if not provided
    if (!dealData.brokerId) {
      dealData.brokerId = req.user.id;
    }

    // PHASE 2 (D2/D3/D4): Deal.commission stores the commission PERCENTAGE
    // (0-100, no silent default). Gross money = finalPrice x % / 100 (D8).
    // Basis is the final/negotiated price; the service precedence
    // (fixed > % > fallback) is the single rule for money amounts.
    if (dealData.commission !== undefined && dealData.commission !== null && dealData.commission !== '') {
      const pct = Number(dealData.commission);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: 'Deal.commission must be a percentage between 0 and 100' });
      }
      dealData.commission = pct;
    } else if (dealData.propertyId) {
      const property = await Property.findByPk(dealData.propertyId);
      if (property) {
        if (property.commissionType === 'fixed' && property.commissionValue != null) {
          // Fixed-amount listing: no % to store; money resolved by the
          // service at generate time. Store 0% marker (D4 precedence).
          dealData.commission = 0;
        } else if (property.commissionType === 'percentage' && property.commissionValue != null) {
          dealData.commission = Number(property.commissionValue);
        } else if (property.commissionPercentage) {
          dealData.commission = Number(property.commissionPercentage);
        } else {
          dealData.commission = 0;
        }
      }
    }

    // PHASE 2 (D9): stamp closedAt when created already Closed.
    if (dealData.dealStage === 'Closed' && !dealData.closedAt) {
      dealData.closedAt = new Date();
    }

    const deal = await Deal.create(dealData);

    // Auto-generate commission and mark property as Sold when deal is created with Closed stage
    if (dealData.dealStage === 'Closed' && deal.propertyId) {
      const property = await Property.findByPk(deal.propertyId);
      if (property && property.status !== 'Sold') {
        const propertyUpdate = { status: 'Sold', soldAt: new Date() };
        
        const soldPrice = dealData.finalPrice || deal.finalPrice || property.price;
        propertyUpdate.soldPrice = soldPrice;
        
        if (dealData.buyerName) {
          propertyUpdate.soldTo = dealData.buyerName;
        }
        
        try {
          console.log('Calculating commission for new deal:', deal.id, 'finalPrice:', soldPrice);
          const commissionResult = await commissionService.calculateDealCommission(deal.id);
          console.log('Commission calculated successfully:', commissionResult);
        } catch (commissionError) {
          console.error('Failed to auto-generate commission:', commissionError);
        }
        
        await property.update(propertyUpdate);
      }
    }

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

    // COMMISSION RESTRICTION (D19): Only Admin/Super Admin can edit commission (%)
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      delete updateData.commission;
    } else if (updateData.commission !== undefined && updateData.commission !== null && updateData.commission !== '') {
      const pct = Number(updateData.commission);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: 'Deal.commission must be a percentage between 0 and 100' });
      }
      updateData.commission = pct;
    }

    // PHASE 2 (D9): stamp closedAt on transition to Closed (never overwrite).
    if (updateData.dealStage === 'Closed' && !deal.closedAt && !updateData.closedAt) {
      updateData.closedAt = new Date();
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
        
        if (deal.buyerName) {
          propertyUpdate.soldTo = deal.buyerName;
        }
        
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

    // PHASE 2 (D21): Closed deals are immutable — void via status, never
    // hard-delete (10y retention). Open deals may be deleted.
    if (deal.dealStage === 'Closed') {
      return res.status(403).json({ message: 'Closed deals cannot be deleted (void-only). Reopen via status change approved by a manager.' });
    }

    // AUDIT-2026-09: DealCommissions are derived rows (recalc already wipes
    // them per deal). Remove them in the same transaction so deleting an
    // open deal cannot fail on the dealId FK — previously a raw FK 500.
    const { sequelize } = require('../config/database');
    const transaction = await sequelize.transaction();
    try {
      await DealCommission.destroy({ where: { dealId: deal.id }, transaction });
      await deal.destroy({ transaction });
      await transaction.commit();
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
    res.status(200).json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error(`deleteDeal failed for ${req.params.id}:`, error.message);
    // Never leak SQL/FK internals (table + constraint names) to the client.
    const safe = process.env.NODE_ENV === 'production'
      ? 'Could not delete this deal.'
      : 'Error deleting deal';
    res.status(500).json({ message: safe });
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
  // NOTE: validate first; never hold an open transaction across early
  // returns (leaked transactions exhaust the pool and hang requests).
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

    const transaction = await require('../config/database').sequelize.transaction();
    try {
      if (finalPrice) {
        await deal.update({ finalPrice }, { transaction });
      }
      await transaction.commit();
    } catch (txError) {
      try { await transaction.rollback(); } catch (_) {}
      throw txError;
    }

    const result = await commissionService.calculateDealCommission(dealId);

    res.status(200).json({
      status: 'success',
      message: 'Commission generated successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error generating commission',
      error: error.message
    });
  }
};
