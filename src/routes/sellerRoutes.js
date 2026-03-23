const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { Seller, Property, Deal } = require('../models/associations');

router.use(protect);

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
    res.status(500).json({ message: 'Error fetching sellers', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const seller = await Seller.findByPk(req.params.id, {
      include: [
        {
          model: Property,
          as: 'properties',
          attributes: ['id', 'title', 'price', 'status', 'type', 'city', 'address']
        },
        {
          model: Deal,
          as: 'deals',
          attributes: ['id', 'title', 'finalPrice', 'dealStage', 'closedAt']
        }
      ]
    });
    
    if (!seller) return res.status(404).json({ message: 'Seller not found' });
    res.status(200).json(seller);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching seller', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const seller = await Seller.create(req.body);
    res.status(201).json(seller);
  } catch (error) {
    res.status(400).json({ message: 'Error creating seller', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const seller = await Seller.findByPk(req.params.id);
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    await seller.update(req.body);
    res.status(200).json(seller);
  } catch (error) {
    res.status(400).json({ message: 'Error updating seller', error: error.message });
  }
});

module.exports = router;