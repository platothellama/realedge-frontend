const { Property, PriceHistory, User, Group, Document, DocumentVersion, Deal, Visit } = require('../models/associations');
const { v4: uuidv4 } = require('uuid');

const seedProperties = async () => {
  try {
    // Delete in correct order to handle foreign keys
    await Visit.destroy({ where: {} });
    await PriceHistory.destroy({ where: {} });
    await Document.destroy({ where: {} });
    await Deal.destroy({ where: {} });
    await Property.destroy({ where: {} });

    const users = await User.findAll();
    const groups = await Group.findAll();

    const getRandomElement = (arr) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;

    const properties = [
      {
        id: uuidv4(),
        title: 'Billionaire\'s Row Penthouse',
        description: 'Ultra-exclusive penthouse featuring 360-degree city views, private elevator, and a 50ft infinity pool overlooking the skyline. Designed by world-renowned architects.',
        price: 15500000.00,
        status: 'Available',
        type: 'Apartment',
        bedrooms: 5,
        bathrooms: 6,
        area: 1200,
        lotSize: 0,
        yearBuilt: 2023,
        parkingSpaces: 4,
        address: '157 West 57th St',
        city: 'New York',
        country: 'USA',
        lat: 40.7653,
        lng: -73.9790,
        photos: [
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1600585154340-be6199fbfd0b?auto=format&fit=crop&w=1200&q=80'
        ],
        videos: ['https://example.com/tour-penthouse'],
        tours360: ['https://example.com/360-penthouse'],
        features: ['Smart Home', 'Wine Cellar', 'Private Gym', 'Concierge'],
        views: 1250,
        inquiries: 45,
        daysOnMarket: 25,
        pricePerSqm: 12917,
        marketValue: 16000000
      },
      {
        id: uuidv4(),
        title: 'Modern Minimalist Villa',
        description: 'A masterpiece of contemporary architecture. Floor-to-ceiling glass walls, cantilevered terraces, and a seamless indoor-outdoor living experience.',
        price: 5250000.00,
        status: 'Reserved',
        type: 'Villa',
        bedrooms: 4,
        bathrooms: 4,
        area: 650,
        lotSize: 2000,
        yearBuilt: 2022,
        parkingSpaces: 3,
        address: 'Malibu Heights Dr',
        city: 'Malibu',
        country: 'USA',
        lat: 34.0259,
        lng: -118.7798,
        photos: [
          'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1600607687940-497f6c690a17?auto=format&fit=crop&w=1200&q=80'
        ],
        videos: [],
        tours360: [],
        features: ['Eco-friendly', 'Solar Panels', 'Infinity Pool'],
        views: 890,
        inquiries: 32,
        daysOnMarket: 45,
        pricePerSqm: 8077,
        marketValue: 5500000
      },
      {
        id: uuidv4(),
        title: 'Historic European Estate',
        description: 'Restored 18th-century manor house in the heart of the countryside. Manicured gardens, guest house, and original architectural details preserved throughout.',
        price: 3800000.00,
        status: 'Available',
        type: 'House',
        bedrooms: 7,
        bathrooms: 5,
        area: 950,
        lotSize: 50000,
        yearBuilt: 1785,
        parkingSpaces: 6,
        address: 'Route de Châteaux',
        city: 'Provence',
        country: 'France',
        lat: 43.9352,
        lng: 4.8055,
        photos: [
          'https://images.unsplash.com/photo-1500313830540-7b6650a7c934?auto=format&fit=crop&w=1200&q=80'
        ],
        videos: [],
        tours360: [],
        features: ['Gated', 'Guest House', 'Stables'],
        views: 150,
        inquiries: 3,
        daysOnMarket: 75,
        pricePerSqm: 4000,
        marketValue: 4200000
      }
    ];

    for (const propData of properties) {
      if (Math.random() > 0.5) {
        propData.assignedToUserId = getRandomElement(users)?.id;
      } else {
        propData.assignedToGroupId = getRandomElement(groups)?.id;
      }

      const property = await Property.create(propData);
      
      // Seed some negotiation history for the first property
      if (propData.title.includes('Billionaire')) {
        await PriceHistory.create({
          propertyId: property.id,
          price: 16500000.00,
          changeDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          note: 'Starting Listing Price'
        });
        await PriceHistory.create({
          propertyId: property.id,
          price: 16000000.00,
          changeDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
          note: 'Negotiation: Client Offer 15.5M - Counter Offer 16M'
        });
        await PriceHistory.create({
          propertyId: property.id,
          price: 15500000.00,
          changeDate: new Date(),
          note: 'Market Adjustment / Final Negotiation'
        });
      } else {
        // Just initial price for others
        await PriceHistory.create({
          propertyId: property.id,
          price: propData.price,
          note: 'Initial Listing'
        });
      }
    }

    console.log('✅ Real Estate Listings and Negotiation History seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding properties:', error);
  }
};

module.exports = seedProperties;
