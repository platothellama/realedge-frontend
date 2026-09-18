const { Property, PriceHistory, User, Group, Lead, Seller, Deal, Project } = require('../models/associations');
const { Op } = require('sequelize');
const commissionService = require('../services/commissionService');

// QA hardening 2026-09-18: only benign seller columns (mirrors sellerRoutes).
const SELLER_FIELDS = ['name', 'email', 'phone', 'address', 'city', 'country', 'notes'];
const pickSeller = (body) => {
  const out = {};
  for (const f of SELLER_FIELDS) {
    if (body && body[f] !== undefined) out[f] = body[f];
  }
  // Empty-string email fails Sequelize isEmail (allowNull only skips null).
  // The listing form sends email:"" when left blank — normalize to null
  // (= "no email") so Seller.create doesn't throw Validation isEmail.
  if (typeof out.email === 'string') {
    out.email = out.email.trim() || null;
  }
  return out;
};

// Master bedrooms must be a whole number >= 0 and never exceed total bedrooms.
const validateBedroomCounts = (bedrooms, masterBedrooms) => {
  const coerce = (v, fallback) => {
    if (v === undefined || v === null || v === '') return fallback;
    const n = Number(v);
    return n;
  };
  const b = coerce(bedrooms, 0);
  const m = coerce(masterBedrooms, 0);
  if (bedrooms !== undefined && bedrooms !== null && bedrooms !== '') {
    if (!Number.isInteger(b) || b < 0) return 'Bedrooms must be a whole number >= 0';
  }
  if (masterBedrooms !== undefined && masterBedrooms !== null && masterBedrooms !== '') {
    if (!Number.isInteger(m) || m < 0) return 'Master bedrooms must be a whole number >= 0';
  }
  if (Number.isInteger(b) && Number.isInteger(m) && m > b) {
    return 'Master bedrooms cannot exceed total bedrooms';
  }
  return null;
};

// Balconies must be a whole number >= 0 when provided.
const validateBalconies = (balconies) => {
  if (balconies === undefined || balconies === null || balconies === '') return null;
  const n = Number(balconies);
  if (!Number.isInteger(n) || n < 0) return 'Balconies must be a whole number >= 0';
  return null;
};

// Terrace / cellar sizes only apply when the flag is set (frontend enables
// the size input only then). Sizes must be numbers >= 0; without the flag
// the size is normalized to NULL so no stale 0 is stored.
const validateOutdoorSize = (value, label) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return `${label} must be a number >= 0`;
  return null;
};
const normalizeOutdoorSizes = (body, effective = {}) => {
  const hasTerrace = body.hasTerrace !== undefined ? !!body.hasTerrace : !!effective.hasTerrace;
  const hasCellar = body.hasCellar !== undefined ? !!body.hasCellar : !!effective.hasCellar;
  if (!hasTerrace) {
    body.terraceSize = null;
  } else if (body.terraceSize === '' || body.terraceSize === undefined) {
    if (body.hasTerrace !== undefined && body.terraceSize === '') body.terraceSize = null;
  }
  if (!hasCellar) {
    body.cellarSize = null;
  } else if (body.cellarSize === '' || body.cellarSize === undefined) {
    if (body.hasCellar !== undefined && body.cellarSize === '') body.cellarSize = null;
  }
};

// Optional project grouping: accepts `projectId` (UUID or ''/null to ungroup)
// and `newProject` ({ name, ... }) for on-the-fly creation from the listing form.
const resolveProjectId = async (body) => {
  if (body.newProject && body.newProject.name && String(body.newProject.name).trim()) {
    const allowed = ['name', 'developer', 'description', 'address', 'city', 'country', 'status', 'coverImage'];
    const data = {};
    for (const f of allowed) {
      if (body.newProject[f] !== undefined) data[f] = body.newProject[f];
    }
    const project = await Project.create(data);
    return project.id;
  }
  if (body.projectId === undefined) return undefined; // leave untouched on update
  const pid = body.projectId;
  if (pid === null || pid === '' || pid === 'unassigned') return null;
  const project = await Project.findByPk(pid, { attributes: ['id'] });
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 400;
    throw err;
  }
  return project.id;
};

exports.getAllProperties = async (req, res) => {
  try {
    // QA hardening 2026-09-18: clamp pagination (previously ?limit=1000000 = DoS).
    const rawPage = parseInt(req.query.page);
    const rawLimit = parseInt(req.query.limit);
    const page = Number.isFinite(rawPage) ? Math.min(Math.max(rawPage, 1), 1000) : 1;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 12;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status;
    const type = req.query.type;
    const listingType = req.query.listingType;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const minBedrooms = req.query.minBedrooms ? parseInt(req.query.minBedrooms) : null;
    const maxBedrooms = req.query.maxBedrooms ? parseInt(req.query.maxBedrooms) : null;
    const minBathrooms = req.query.minBathrooms ? parseInt(req.query.minBathrooms) : null;
    const minBalconies = req.query.minBalconies ? parseInt(req.query.minBalconies) : null;
    const minArea = req.query.minArea ? parseFloat(req.query.minArea) : null;
    const maxArea = req.query.maxArea ? parseFloat(req.query.maxArea) : null;
    const city = req.query.city;
    const projectId = req.query.projectId;

    const where = {};
    
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (status && status !== 'All') {
      if (status === 'Non-Available') {
        where.status = {
          [Op.ne]: 'Available'
        };
      } else {
        where.status = status;
      }
    }
    
    if (type && type !== 'All') {
      where.type = type;
    }
    
    if (listingType && listingType !== 'All') {
      where.listingType = listingType;
    }
    
    if (minPrice) {
      where.price = { ...where.price, [Op.gte]: minPrice };
    }
    
    if (maxPrice) {
      where.price = { ...where.price, [Op.lte]: maxPrice };
    }
    
    if (minBedrooms) {
      where.bedrooms = { ...where.bedrooms, [Op.gte]: minBedrooms };
    }
    
    if (maxBedrooms) {
      where.bedrooms = { ...where.bedrooms, [Op.lte]: maxBedrooms };
    }
    
    if (minBathrooms) {
      where.bathrooms = { [Op.gte]: minBathrooms };
    }

    if (Number.isInteger(minBalconies)) {
      where.balconies = { [Op.gte]: minBalconies };
    }
    
    if (minArea) {
      where.area = { [Op.gte]: minArea };
    }
    
    if (maxArea) {
      where.area = { ...where.area, [Op.lte]: maxArea };
    }
    
    if (city) {
      where.city = { [Op.like]: `%${city}%` };
    }

    if (projectId && projectId !== 'All') {
      if (projectId === 'unassigned') {
        where.projectId = null;
      } else {
        where.projectId = projectId;
      }
    }

    const { count, rows } = await Property.findAndCountAll({
      where,
      include: [        { 
          model: PriceHistory, 
          as: 'priceHistoryEntries',
          include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'email'] }]
        },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Project, as: 'project', attributes: ['id', 'name', 'developer', 'city'] }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      // QA 2026-09-18: hasMany includes multiply rows; count must count
      // properties, otherwise totalItems/totalPages inflate.
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      data: rows,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching properties', ...require('../utils/http').safeError(error) });
  }
};

exports.getPropertyById = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id, {
      include: [
        { 
          model: PriceHistory, 
          as: 'priceHistoryEntries',
          include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'email'] }]
        },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Project, as: 'project', attributes: ['id', 'name', 'developer', 'city', 'address', 'status'] }
      ]
    });
    if (!property) return res.status(404).json({ message: 'Property not found' });
    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching property', ...require('../utils/http').safeError(error) });
  }
};

exports.createProperty = async (req, res) => {
  try {
    const bedroomError = validateBedroomCounts(req.body.bedrooms, req.body.masterBedrooms);
    if (bedroomError) return res.status(400).json({ message: bedroomError });
    const balconiesError = validateBalconies(req.body.balconies);
    if (balconiesError) return res.status(400).json({ message: balconiesError });
    const terraceError = validateOutdoorSize(req.body.hasTerrace ? req.body.terraceSize : null, 'Terrace size');
    if (terraceError) return res.status(400).json({ message: terraceError });
    const cellarError = validateOutdoorSize(req.body.hasCellar ? req.body.cellarSize : null, 'Cellar size');
    if (cellarError) return res.status(400).json({ message: cellarError });
    normalizeOutdoorSizes(req.body);
    const { newSeller, sellerId, newProject, projectId, ...propertyData } = req.body;

    // QA 2026-09-18: PK, timestamps, server-computed sale figures and
    // engagement/AI counters are never client-settable (previously a create
    // could forge soldPrice without any deal, or fake views/inquiries).
    for (const f of ['id', 'createdAt', 'updatedAt', 'soldPrice', 'views', 'inquiries', 'daysOnMarket', 'pricePerSqm', 'marketValue']) {
      delete propertyData[f];
    }
    delete propertyData.newProject;

    let finalSellerId = sellerId;

    if (newSeller && newSeller.name) {
      const picked = pickSeller(newSeller);
      // Only dedupe by email when one was actually provided; otherwise
      // WHERE email IS NULL/"" would merge unrelated no-email sellers.
      let existingSeller = null;
      if (picked.email) {
        existingSeller = await Seller.findOne({ where: { email: picked.email } });
      }
      if (existingSeller) {
        finalSellerId = existingSeller.id;
      } else {
        const seller = await Seller.create(picked);
        finalSellerId = seller.id;
      }
    }

    if (finalSellerId) {
      propertyData.sellerId = finalSellerId;
    }

    try {
      const resolved = await resolveProjectId({ projectId, newProject });
      if (resolved !== undefined) propertyData.projectId = resolved;
    } catch (projErr) {
      return res.status(projErr.statusCode || 400).json({ message: projErr.message || 'Invalid project' });
    }

    // QA hardening 2026-09-18: assignment UI is Super-Admin-only; non-admins
    // create self-owned listings (no filing under other agents/teams).
    const role = req.user?.role;
    if (role !== 'Super Admin' && role !== 'Admin') {
      propertyData.assignedToUserId = req.user.id;
      delete propertyData.assignedToGroupId;
    }

    // QA hardening 2026-09-18: listing + initial price history commit together.
    const { sequelize } = require('../config/database');
    const transaction = await sequelize.transaction();
    let property;
    try {
      property = await Property.create(propertyData, { transaction });

      await PriceHistory.create({
        propertyId: property.id,
        price: property.price,
        note: 'Initial listing price'
      }, { transaction });

      await transaction.commit();
    } catch (txError) {
      try { await transaction.rollback(); } catch (_) {}
      throw txError;
    }

    const result = await Property.findByPk(property.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Project, as: 'project', attributes: ['id', 'name', 'developer', 'city'] }
      ]
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Error creating property', ...require('../utils/http').safeError(error) });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    if (property.status === 'Sold') {
      return res.status(400).json({ message: 'Cannot modify a sold property' });
    }

    const { newSeller, sellerId, newProject, projectId, ...propertyData } = req.body;

    // Effective counts: fall back to stored values when only one side is patched.
    const effectiveBedrooms = propertyData.bedrooms !== undefined ? propertyData.bedrooms : property.bedrooms;
    const effectiveMaster = propertyData.masterBedrooms !== undefined ? propertyData.masterBedrooms : property.masterBedrooms;
    const bedroomError = validateBedroomCounts(effectiveBedrooms, effectiveMaster);
    if (bedroomError) return res.status(400).json({ message: bedroomError });
    const balconiesError = validateBalconies(
      propertyData.balconies !== undefined ? propertyData.balconies : undefined
    );
    if (balconiesError) return res.status(400).json({ message: balconiesError });
    const effectiveHasTerrace = propertyData.hasTerrace !== undefined ? !!propertyData.hasTerrace : !!property.hasTerrace;
    const effectiveHasCellar = propertyData.hasCellar !== undefined ? !!propertyData.hasCellar : !!property.hasCellar;
    const terraceError = validateOutdoorSize(
      effectiveHasTerrace ? (propertyData.terraceSize !== undefined ? propertyData.terraceSize : property.terraceSize) : null,
      'Terrace size'
    );
    if (terraceError) return res.status(400).json({ message: terraceError });
    const cellarError = validateOutdoorSize(
      effectiveHasCellar ? (propertyData.cellarSize !== undefined ? propertyData.cellarSize : property.cellarSize) : null,
      'Cellar size'
    );
    if (cellarError) return res.status(400).json({ message: cellarError });
    normalizeOutdoorSizes(propertyData, { hasTerrace: effectiveHasTerrace, hasCellar: effectiveHasCellar });

    // QA 2026-09-18: same server-managed fields as create (the Sold flip
    // below recomputes soldPrice/soldAt/soldTo from the closed deal).
    for (const f of ['id', 'createdAt', 'updatedAt', 'soldPrice', 'views', 'inquiries', 'daysOnMarket', 'pricePerSqm', 'marketValue']) {
      delete propertyData[f];
    }
    delete propertyData.newProject;

    try {
      const resolved = await resolveProjectId({ projectId, newProject });
      if (resolved !== undefined) propertyData.projectId = resolved;
    } catch (projErr) {
      return res.status(projErr.statusCode || 400).json({ message: projErr.message || 'Invalid project' });
    }

    let finalSellerId = sellerId;

    if (newSeller && newSeller.name) {
      const picked = pickSeller(newSeller);
      // Only dedupe by email when one was actually provided; otherwise
      // WHERE email IS NULL/"" would merge unrelated no-email sellers.
      let existingSeller = null;
      if (picked.email) {
        existingSeller = await Seller.findOne({ where: { email: picked.email } });
      }
      if (existingSeller) {
        finalSellerId = existingSeller.id;
      } else {
        const seller = await Seller.create(picked);
        finalSellerId = seller.id;
      }
    }

    if (finalSellerId !== undefined) {
      propertyData.sellerId = finalSellerId;
    }

    // QA hardening 2026-09-18: assignment changes are admin-only (stripping
    // the keys preserves existing values for everyone else).
    const updaterRole = req.user?.role;
    if (updaterRole !== 'Super Admin' && updaterRole !== 'Admin') {
      delete propertyData.assignedToUserId;
      delete propertyData.assignedToGroupId;
    }

    const oldPrice = parseFloat(property.price);
    const newPrice = parseFloat(req.body.price);
    const newStatus = req.body.status;
    const isStatusChangedToSold = newStatus === 'Sold' && property.status !== 'Sold';

    // QA hardening 2026-09-18: all row mutations commit in ONE transaction
    // (previously the Sold flip / price history / deal backfill could
    // partially apply). Commission calculation keeps its own transaction in
    // the service and runs after commit.
    const { sequelize } = require('../config/database');
    const transaction = await sequelize.transaction();
    let closedDeal = null;
    try {
      await property.update(propertyData, { transaction });

      if (newPrice && oldPrice !== newPrice) {
        await PriceHistory.create({
          propertyId: property.id,
          price: newPrice,
          note: `Price updated from ${oldPrice} to ${newPrice}`
        }, { transaction });
      }

      if (isStatusChangedToSold) {
        const propertyUpdate = { soldAt: new Date() };

        closedDeal = await Deal.findOne({
          where: {
            propertyId: property.id,
            dealStage: 'Closed'
          },
          transaction
        });

        if (closedDeal) {
          const dealFinalPrice = closedDeal.finalPrice || property.price;
          await closedDeal.update({ finalPrice: dealFinalPrice }, { transaction });
          propertyUpdate.soldPrice = dealFinalPrice;
          if (closedDeal.buyerName) {
            propertyUpdate.soldTo = closedDeal.buyerName;
          }
        } else {
          propertyUpdate.soldPrice = property.price;
          if (req.body.soldTo) {
            propertyUpdate.soldTo = req.body.soldTo;
          }
        }

        await property.update(propertyUpdate, { transaction });
      }

      await transaction.commit();
    } catch (txError) {
      try { await transaction.rollback(); } catch (_) {}
      throw txError;
    }

    if (isStatusChangedToSold) {
      try {
        console.log('Calculating commission for property:', property.id, 'price:', property.price);
        const commissionResult = await commissionService.calculatePropertyCommissionDirect(property.id, closedDeal?.id);
        console.log('Commission calculated successfully:', commissionResult);
      } catch (commissionError) {
        console.error('Failed to auto-generate commission:', commissionError);
      }
    }

    const result = await Property.findByPk(property.id, {
      include: [
        { 
          model: PriceHistory, 
          as: 'priceHistoryEntries',
          include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'email'] }]
        },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Project, as: 'project', attributes: ['id', 'name', 'developer', 'city'] }
      ]
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Error updating property', ...require('../utils/http').safeError(error) });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    // AUDIT-2026-09: a property referenced by deals is sales history — it
    // must not vanish (void-only philosophy). Previously this fell through
    // to a raw FK 500 that leaked table/constraint names to the client.
    const { Deal } = require('../models/associations');
    const linkedDeals = await Deal.count({ where: { propertyId: property.id } });
    if (linkedDeals > 0) {
      return res.status(409).json({
        message: `Cannot delete: this property has ${linkedDeals} linked deal(s). Remove or reassign the deals first.`
      });
    }

    await PriceHistory.destroy({ where: { propertyId: property.id } });
    await property.destroy();

    res.status(200).json({ message: 'Property and history deleted successfully' });
  } catch (error) {
    console.error(`deleteProperty failed for ${req.params.id}:`, error.message);
    // Never leak SQL/FK internals (table + constraint names) to the client.
    const safe = process.env.NODE_ENV === 'production'
      ? 'Could not delete this property.'
      : 'Error deleting property';
    res.status(500).json({ message: safe });
  }
};

exports.addNegotiation = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    // QA hardening 2026-09-18: no repricing Sold stock, no junk math, no
    // dangling lead references (matches the updateProperty Sold guard).
    if (property.status === 'Sold') {
      return res.status(400).json({ message: 'Cannot negotiate on a sold property' });
    }

    const { price, note, leadId, updatePropertyPrice } = req.body;

    if (price !== undefined && price !== null && price !== '') {
      const p = Number(price);
      if (!Number.isFinite(p) || p <= 0) {
        return res.status(400).json({ message: 'Negotiation price must be a positive number' });
      }
    }

    if (leadId) {
      const lead = await Lead.findByPk(leadId, { attributes: ['id'] });
      if (!lead) return res.status(400).json({ message: 'Lead not found' });
    }

    await PriceHistory.create({
      propertyId: property.id,
      price: price || property.price,
      note: note || 'Negotiation update',
      leadId: leadId || null
    });

    if (updatePropertyPrice && price) {
      await property.update({ price });
    }

    const result = await Property.findByPk(property.id, {
      include: [
        { 
          model: PriceHistory, 
          as: 'priceHistoryEntries',
          include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'email'] }]
        },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] }
      ]
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Error adding negotiation', ...require('../utils/http').safeError(error) });
  }
};

exports.getUniqueFeatures = async (req, res) => {
  try {
    const properties = await Property.findAll({
      attributes: ['features'],
      where: {
        features: {
          [Op.ne]: null
        }
      }
    });

    const allFeatures = properties
      .map(p => p.features)
      .filter(f => Array.isArray(f))
      .flat();

    const uniqueFeatures = [...new Set(allFeatures)].sort();

    res.status(200).json(uniqueFeatures);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching features', ...require('../utils/http').safeError(error) });
  }
};
