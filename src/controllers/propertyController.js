const { Property, PriceHistory, User, Group, Lead } = require('../models/associations');

exports.getAllProperties = async (req, res) => {
  try {
    const properties = await Property.findAll({
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
    res.status(200).json(properties);
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
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] }
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
    const property = await Property.create(req.body);
    
    // Create initial price history entry
    await PriceHistory.create({
      propertyId: property.id,
      price: property.price,
      note: 'Initial listing price'
    });

    const result = await Property.findByPk(property.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] }
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

    const oldPrice = parseFloat(property.price);
    const newPrice = parseFloat(req.body.price);

    await property.update(req.body);

    // Track price change if updated
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
        { model: Group, as: 'assignedGroup', attributes: ['id', 'name'] }
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
    
    // Cleanup price history
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

    // Add negotiation history
    await PriceHistory.create({
      propertyId: property.id,
      price: price || property.price,
      note: note || 'Negotiation update',
      leadId: leadId || null
    });

    // Optionally update the property listed price
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
