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

    // QA hardening 2026-09-18: idempotency — a converted lead cannot spawn
    // duplicate deals (double-click / retry previously created two).
    if (lead.status === 'Closed Deal') {
      return res.status(409).json({ message: 'This lead has already been converted to a deal' });
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

    // QA hardening 2026-09-18: deal + lead-status flip in ONE transaction
    // (previously a crash between the two left either an orphan deal or a
    // convertible lead that spawns duplicates on retry).
    const { sequelize } = require('../config/database');
    const transaction = await sequelize.transaction();
    let deal;
    try {
      deal = await Deal.create({
        title: `${lead.name} - ${property.title}`,
        buyerName: lead.name,
        sellerName: sellerName || 'Not specified',
        propertyId: propertyId,
        brokerId: lead.assignedToUserId || userId,
        buyerLeadId: lead.id,
        finalPrice: finalPrice || property.price,
        commission: commission,
        dealStage: 'Negotiation'
      }, { transaction });

      await lead.update({ status: 'Closed Deal' }, { transaction });
      await transaction.commit();
    } catch (txError) {
      try { await transaction.rollback(); } catch (_) {}
      throw txError;
    }

    res.status(201).json({ 
      message: 'Lead converted to deal successfully', 
      deal: deal 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error converting lead to deal', ...require('../utils/http').safeError(error) });
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

    // QA 2026-09-18: bounded list. Explicit ?page/?limit returns a
    // {data, pagination} envelope; legacy callers (no params) keep the raw
    // array, capped so one request cannot load an unbounded table+joins.
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 0, 0), 1000);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 200);
    const findOpts = {
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
    };
    if (page > 0 && limit > 0) {
      findOpts.limit = limit;
      findOpts.offset = (page - 1) * limit;
      // distinct: hasMany includes multiply rows; count must count leads.
      findOpts.distinct = true;
      const { count, rows } = await Lead.findAndCountAll(findOpts);
      return res.status(200).json({
        data: rows,
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
      });
    }
    findOpts.limit = 2000;
    const leads = await Lead.findAll(findOpts);
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads', ...require('../utils/http').safeError(error) });
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
    res.status(500).json({ message: 'Error fetching lead', ...require('../utils/http').safeError(error) });
  }
};

exports.createLead = async (req, res) => {
  try {
    // QA hardening 2026-09-18: leads are born New Lead, owned by their
    // creator (assignment UI is Super-Admin-only); score is AI-managed.
    const { assignedToUserId, status, score, id, createdAt, updatedAt, ...body } = req.body || {};
    const leadData = { ...body };
    const role = req.user?.role;
    if (role !== 'Super Admin' && role !== 'Admin') {
      leadData.assignedToUserId = req.user.id;
    } else if (assignedToUserId) {
      leadData.assignedToUserId = assignedToUserId;
    } else {
      leadData.assignedToUserId = req.user.id;
    }
    leadData.status = 'New Lead';

    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'A lead with this email or phone already exists.' });
    }
    res.status(400).json({ message: 'Error creating lead', ...require('../utils/http').safeError(error) });
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

    // QA hardening 2026-09-18: non-admins cannot reassign leads away or
    // forge the AI-managed score (status workflow stays via this endpoint).
    const updateData = { ...(req.body || {}) };
    for (const f of ['id', 'createdAt', 'updatedAt']) {
      delete updateData[f];
    }
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      delete updateData.assignedToUserId;
    }
    delete updateData.score;
    await lead.update(updateData);
    res.status(200).json(lead);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'A lead with this email or phone already exists.' });
    }
    res.status(400).json({ message: 'Error updating lead', ...require('../utils/http').safeError(error) });
  }
};

const LEAD_SOURCES = ['Website', 'Facebook', 'Google Ads', 'Referral', 'Walk-in'];
const LEAD_STATUSES = ['New Lead', 'Contacted', 'Visit Scheduled', 'Negotiation', 'Closed Deal', 'Lost Lead'];
const MAX_BULK_ROWS = 500;

/**
 * QA hardening 2026-09-18: server-side bulk import (replaces N parallel
 * single creates). Every row validated like createLead; the batch commits in
 * one transaction; per-row results reported honestly.
 */
exports.bulkCreateLeads = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.leads) ? req.body.leads : null;
    if (!rows) {
      return res.status(400).json({ message: 'leads must be an array' });
    }
    if (rows.length === 0) {
      return res.status(400).json({ message: 'No leads provided' });
    }
    if (rows.length > MAX_BULK_ROWS) {
      return res.status(400).json({ message: `Too many rows (max ${MAX_BULK_ROWS})` });
    }

    const role = req.user?.role;
    const privileged = role === 'Super Admin' || role === 'Admin';
    const valid = [];
    const skipped = [];
    rows.forEach((r, i) => {
      const name = (r?.name || '').trim();
      const email = (r?.email || '').trim();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped.push({ index: i, reason: 'name and valid email required' });
        return;
      }
      const budget = r?.budget === undefined || r?.budget === null || r?.budget === '' ? 0 : Number(r.budget);
      if (!Number.isFinite(budget) || budget < 0) {
        skipped.push({ index: i, reason: 'budget must be a non-negative number' });
        return;
      }
      valid.push({
        name,
        email,
        phone: (r?.phone || '').trim() || null,
        source: LEAD_SOURCES.includes(r?.source) ? r.source : 'Website',
        status: 'New Lead',
        budget,
        assignedToUserId: privileged && r?.assignedToUserId ? r.assignedToUserId : req.user.id
      });
    });

    let created = [];
    if (valid.length > 0) {
      const { sequelize } = require('../config/database');
      const transaction = await sequelize.transaction();
      try {
        created = await Lead.bulkCreate(valid, { transaction, validate: true });
        await transaction.commit();
      } catch (txError) {
        try { await transaction.rollback(); } catch (_) {}
        throw txError;
      }
    }

    res.status(201).json({
      created: created.length,
      skipped: skipped.length,
      skippedRows: skipped,
      leads: created
    });
  } catch (error) {
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'One or more leads duplicate an existing email or phone.' });
    }
    res.status(400).json({ message: 'Error importing leads', ...require('../utils/http').safeError(error) });
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

    // AUDIT-2026-09: a lead with live deals/visits must not vanish, or
    // deals/visits dangle with leadId/buyerLeadId pointing nowhere
    // (same 409 pattern as property/seller delete guards).
    const { Op } = require('sequelize');
    const linkedDeals = await Deal.count({
      where: { [Op.or]: [{ leadId: lead.id }, { buyerLeadId: lead.id }] }
    });
    if (linkedDeals > 0) {
      return res.status(409).json({
        message: `Cannot delete: this lead has ${linkedDeals} linked deal(s). Close or reassign them first.`
      });
    }
    const linkedVisits = await Visit.count({ where: { leadId: lead.id } });
    if (linkedVisits > 0) {
      return res.status(409).json({
        message: `Cannot delete: this lead has ${linkedVisits} linked visit(s). Cancel or reassign them first.`
      });
    }

    await lead.destroy();
    res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting lead', ...require('../utils/http').safeError(error) });
  }
};
