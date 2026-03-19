const express = require('express');
const router = express.Router();
const seedProperties = require('../seeders/propertySeeder');

router.post('/seed-properties', async (req, res) => {
  try {
    console.log('🌱 Seeding properties from admin API...');
    await seedProperties(100);
    res.status(200).json({ status: 'success', message: '100 properties seeded successfully' });
  } catch (error) {
    console.error('❌ Error seeding properties:', error);
    res.status(500).json({ status: 'error', message: 'Failed to seed properties', error: error.message });
  }
});

module.exports = router;
