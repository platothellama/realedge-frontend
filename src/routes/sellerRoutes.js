const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  Seller, 
  Property, 
  Deal, 
  Invoice, 
  Lead, 
  User, 
  Group,
  Commission,
  Transaction,
  Visit,
  Document
} = require('../models/associations');

router.use(protect);

// QA hardening 2026-09-18: Seller has only benign columns; never accept
// anything else (id overwrite, timestamps, or future sensitive columns).
const SELLER_FIELDS = ['name', 'email', 'phone', 'address', 'city', 'country', 'notes'];
const pickSeller = (body) => {
  const out = {};
  for (const f of SELLER_FIELDS) {
    if (body && body[f] !== undefined) out[f] = body[f];
  }
  // Empty-string email fails Sequelize isEmail (allowNull only skips null).
  // Normalize "" / whitespace to null (= "no email", allows clearing).
  if (typeof out.email === 'string') {
    out.email = out.email.trim() || null;
  }
  return out;
};

router.get('/', async (req, res) => {
  try {
    const sellers = await Seller.findAll({
      include: [
        {
          model: Property,
          as: 'properties',
          attributes: ['id', 'title', 'price', 'status', 'type', 'city']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(sellers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sellers', ...require('../utils/http').safeError(error) });
  }
});

router.get('/:id/stats', async (req, res) => {
  try {
    const sellerId = req.params.id;
    
    const properties = await Property.findAll({ where: { sellerId } });
    const deals = await Deal.findAll({ where: { sellerId } });
    const invoices = await Invoice.findAll({ where: { sellerId } });
    
    const closedDeals = deals.filter(d => d.dealStage === 'Closed');
    
    const totalPropertyValue = properties.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
    const totalDealValue = closedDeals.reduce((sum, d) => sum + (parseFloat(d.finalPrice) || 0), 0);
    const totalCommission = closedDeals.reduce((sum, d) => sum + (parseFloat(d.commission) || 0), 0);
    const totalInvoiced = invoices.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    
    res.status(200).json({
      propertiesCount: properties.length,
      dealsCount: deals.length,
      closedDealsCount: closedDeals.length,
      invoicesCount: invoices.length,
      totalPropertyValue,
      totalDealValue,
      totalCommission,
      totalInvoiced,
      totalPaid,
      outstandingAmount: totalInvoiced - totalPaid
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching seller stats', ...require('../utils/http').safeError(error) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const seller = await Seller.findByPk(req.params.id, {
      include: [
        {
          model: Property,
          as: 'properties',
          attributes: ['id', 'title', 'price', 'status', 'type', 'city', 'address', 'listingType', 'bedrooms', 'bathrooms', 'area', 'photos', 'createdAt']
        },
        {
          model: Deal,
          as: 'deals',
          include: [
            { model: Property, as: 'property', attributes: ['id', 'title', 'price'] },
            { model: Lead, as: 'lead', attributes: ['id', 'name', 'email', 'phone'] },
            { model: User, as: 'agent', attributes: ['id', 'name', 'email'] },
            { model: Group, as: 'dealGroup', attributes: ['id', 'name'] }
          ]
        },
        {
          model: Invoice,
          as: 'invoices',
          include: [
            { model: User, as: 'creator', attributes: ['id', 'name'] },
            { model: Property, as: 'property', attributes: ['id', 'title'] },
            { model: Deal, as: 'deal', attributes: ['id', 'title'] }
          ]
        }
      ]
    });
    
    if (!seller) return res.status(404).json({ message: 'Seller not found' });
    res.status(200).json(seller);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching seller', ...require('../utils/http').safeError(error) });
  }
});

router.post('/', async (req, res) => {
  try {
    const seller = await Seller.create(pickSeller(req.body));
    res.status(201).json(seller);
  } catch (error) {
    res.status(400).json({ message: 'Error creating seller', ...require('../utils/http').safeError(error) });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const seller = await Seller.findByPk(req.params.id);
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    await seller.update(pickSeller(req.body));
    res.status(200).json(seller);
  } catch (error) {
    res.status(400).json({ message: 'Error updating seller', ...require('../utils/http').safeError(error) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const seller = await Seller.findByPk(req.params.id);
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    // AUDIT-2026-09: a seller with live properties must not vanish, or
    // properties dangle with sellerId pointing nowhere (verified live:
    // seller delete succeeded while a property still referenced it).
    const linkedProperties = await Property.count({ where: { sellerId: seller.id } });
    if (linkedProperties > 0) {
      return res.status(409).json({
        message: `Cannot delete: this seller has ${linkedProperties} linked propertie(s). Reassign or remove them first.`
      });
    }

    await seller.destroy();
    res.status(200).json({ message: 'Seller deleted successfully' });
  } catch (error) {
    console.error(`seller delete failed for ${req.params.id}:`, error.message);
    // Never leak SQL/FK internals (table + constraint names) to the client.
    const safe = process.env.NODE_ENV === 'production'
      ? 'Could not delete this seller.'
      : 'Error deleting seller';
    res.status(500).json({ message: safe });
  }
});

module.exports = router;
