const { Property, PriceHistory, User, Group, Lead, Seller } = require('../models/associations');
const { Op } = require('sequelize');

exports.getAllProperties = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
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
    const minArea = req.query.minArea ? parseFloat(req.query.minArea) : null;
    const maxArea = req.query.maxArea ? parseFloat(req.query.maxArea) : null;
    const city = req.query.city;

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
    
    if (minArea) {
      where.area = { [Op.gte]: minArea };
    }
    
    if (maxArea) {
      where.area = { ...where.area, [Op.lte]: maxArea };
    }
    
    if (city) {
      where.city = { [Op.like]: `%${city}%` };
    }

    const { count, rows } = await Property.findAndCountAll({
      where,
      include: [
        { 
          model: PriceHistory, 
          as: 'priceHistoryEntries',
          include: [{ model: Lead, as: 'lead', attributes: ['id', 'name', 'email'] }]
        },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
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
    res.status(500).json({ message: 'Error fetching properties', error: error.message });
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
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] }
      ]
    });
    if (!property) return res.status(404).json({ message: 'Property not found' });
    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching property', error: error.message });
  }
};

exports.createProperty = async (req, res) => {
  try {
    const { newSeller, sellerId, ...propertyData } = req.body;

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
      propertyData.sellerId = finalSellerId;
    }

    const property = await Property.create(propertyData);
    
    await PriceHistory.create({
      propertyId: property.id,
      price: property.price,
      note: 'Initial listing price'
    });

    const result = await Property.findByPk(property.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] }
      ]
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Error creating property', error: error.message });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    if (property.status === 'Sold') {
      return res.status(400).json({ message: 'Cannot modify a sold property' });
    }

    const { newSeller, sellerId, ...propertyData } = req.body;

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

    if (finalSellerId !== undefined) {
      propertyData.sellerId = finalSellerId;
    }

    const oldPrice = parseFloat(property.price);
    const newPrice = parseFloat(req.body.price);

    await property.update(propertyData);

    if (newPrice && oldPrice !== newPrice) {
      await PriceHistory.create({
        propertyId: property.id,
        price: newPrice,
        note: `Price updated from ${oldPrice} to ${newPrice}`
      });
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
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] }
      ]
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: 'Error updating property', error: error.message });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    
    await PriceHistory.destroy({ where: { propertyId: property.id } });
    await property.destroy();
    
    res.status(200).json({ message: 'Property and history deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting property', error: error.message });
  }
};

exports.addNegotiation = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const { price, note, leadId, updatePropertyPrice } = req.body;

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
    res.status(400).json({ message: 'Error adding negotiation', error: error.message });
  }
};
