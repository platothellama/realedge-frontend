const { connectDB, sequelize } = require('../config/database');
require('../models/associations');
const { Property, PriceHistory, User, Group, Document, Deal, Visit } = require('../models/associations');
const { v4: uuidv4 } = require('uuid');

const lebaneseCities = [
  'Beirut', 'Mount Lebanon', 'Tripoli', 'Sidon', 'Tyre', 'Byblos', 'Jounieh', 
  'Baalbek', 'Zahlé', 'Aley', 'Chouf', 'Keserwan', 'Bcharreh', 'Nabatieh'
];

const neighborhoods = {
  'Beirut': ['Achrafieh', 'Hamra', 'Gemmayze', 'Mar Mikhael', 'Downtown', 'Rue de Bras', 'Badaro', 'Furn El Chebbak', 'Borj Hammoud', 'Dekwaneh', 'Sin El Fil', 'Hazmieh', 'Ramlet Baida', 'Raouche', 'Jnah', 'Bachoura', 'Mazraa', 'Ras Maska'],
  'Mount Lebanon': ['Broummana', 'Daychounieh', 'Ain Saadeh', 'Jounieh Bay', 'Kaslik', 'Jbeil', 'Fatqa', 'Amchit', 'Dbayeh', 'Antelias', 'Bekfayya', 'Baabdat', 'Deir el Qamar', 'Beiteddine', 'Saoufar'],
  'Tripoli': ['Al-Mina', 'Abou Samra', 'Qobbeh', 'Ezzahouni', 'Tripoli Old City', 'Mansouri'],
  'Sidon': ['Sidon Old City', 'Miye ou Miye', 'Bourj ech Chemali', 'Haret Saida'],
  'Tyre': ['Tyre Old City', 'Maachouk', 'Tyr Al-Mina'],
  'Byblos': ['Byblos Old Port', 'Jbeil City', 'Ouadi Kaffa'],
  'Jounieh': ['Jounieh Center', 'Haret Sakhr', 'Adonis', 'Tabarja', 'Safra', 'Ghosta', 'Ajaltoun'],
  'Zahlé': ['Zahlé Center', 'Hay Boueb', 'Er-Riz', 'Kfar Dora'],
  'Aley': ['Aley Center', 'Bhamdoun', 'Souk El Gharb', 'Kaifou'],
  'Chouf': ['Beiteddine', 'Degan', 'Ainbal', 'Jaj'],
  'Keserwan': ['Ftneh', 'Balloune', 'Rayfoun', 'Dlebta', 'Mayrouba'],
  'Bcharreh': ['Bcharreh Center', 'Eddbeh', 'Hasrun', 'Qozhaya'],
  'Nabatieh': ['Nabatieh Center', 'Houla', 'Qantara', 'Jezzine']
};

const propertyTypes = ['Apartment', 'House', 'Villa', 'Office', 'Land', 'Commercial'];

const featuresList = [
  'Balcony', 'Sea View', 'Mountain View', 'Garden', 'Swimming Pool', 'Parking', 
  'Elevator', 'Central Heating', 'Air Conditioning', 'Furnished', 'Generator',
  'Security', 'CCTV', 'Pet Friendly', 'Storage', 'Terrace', 'Dublex', 'Penthouse',
  'Maid\'s Room', 'Caretaker Room', 'Wine Cellar', 'Gym', 'Jacuzzi', 'Sauna',
  'Smart Home', 'Solar Panels', 'Backup Water Tank', 'Underground Parking'
];

const descriptions = {
  'Apartment': [
    'Modern {bedrooms} bedroom apartment with stunning views, featuring high-end finishes and an open floor plan perfect for contemporary living.',
    'Spacious {bedrooms} bedroom apartment in the heart of {neighborhood}, recently renovated with premium materials throughout.',
    'Luxurious {bedrooms} bedroom apartment offering the ultimate urban lifestyle with panoramic city views and premium amenities.',
    'Elegant {bedrooms} bedroom apartment combining classic architecture with modern interiors in a prestigious {neighborhood} location.',
    'Bright and airy {bedrooms} bedroom apartment featuring large windows, hardwood floors, and a gourmet kitchen.'
  ],
  'Villa': [
    'Magnificent {bedrooms} bedroom villa with private garden and pool, offering the perfect blend of luxury and comfort.',
    'Stunning {bedrooms} bedroom villa perched on the hills with breathtaking sea views and expansive outdoor living spaces.',
    'Contemporary {bedrooms} bedroom villa showcasing architectural excellence with floor-to-ceiling windows and premium finishes.',
    'Prestigious {bedrooms} bedroom villa in an exclusive gated community, featuring landscaped gardens and a private pool.',
    'Exceptional {bedrooms} bedroom villa combining elegant interiors with spectacular outdoor areas perfect for entertaining.'
  ],
  'House': [
    'Charming {bedrooms} bedroom house with traditional Lebanese architecture and modern upgrades throughout.',
    'Spacious {bedrooms} bedroom family home in a quiet {neighborhood} neighborhood with generous outdoor space.',
    'Well-maintained {bedrooms} bedroom house featuring a large garden, covered terrace, and stunning mountain views.',
    'Beautiful {bedrooms} bedroom house offering privacy and tranquility in a sought-after {neighborhood} location.',
    'Classic {bedrooms} bedroom house with character, updated kitchen and bathrooms, and a wonderful backyard.'
  ],
  'Office': [
    'Prime commercial office space in the business district with modern infrastructure and excellent accessibility.',
    'Professional {type} space featuring open floor plan, private offices, meeting rooms, and state-of-the-art technology.',
    'Premium office space with natural light, flexible layout options, and premium building amenities.',
    'Modern commercial space ideal for corporate headquarters or creative agency with stylish common areas.',
    'Strategically located office space offering visibility and convenience with parking and public transport access.'
  ],
  'Land': [
    'Prime {area}m² land parcel with approved building permits and stunning views, ready for development.',
    'Exceptional {area}m² plot in a rapidly developing area, perfect for residential or commercial investment.',
    'Rare {area}m² land opportunity in {neighborhood}, offering excellent value and development potential.',
    'Strategic {area}m² land investment in a high-demand location with all utilities available.',
    'Prime {area}m² building lot with clear titles, level terrain, and beautiful surrounding landscapes.'
  ],
  'Commercial': [
    'Prime {type} space on a bustling commercial street, ideal for retail, restaurant, or showroom.',
    'Versatile commercial space featuring high ceilings, large storefront, and excellent foot traffic.',
    'Strategic {type} location in the heart of {neighborhood}\'s commercial district with parking.',
    'Modern commercial unit with professional finish, ideal for showroom, office, or retail.',
    'Prime commercial opportunity in a growing area, suitable for various business ventures.'
  ]
};

const unsplashImages = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6199fbfd0b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753151-384129cf4e3e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154084-4e5fe7c39198?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600047509358-9dc75507daeb?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753104-685f4f24cb4d?auto=format&fit=crop&w=1200&q=80'
];

const getRandomElement = (arr) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;

const getRandomElements = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const generatePrice = (type, bedrooms, area, city) => {
  const baseMultipliers = {
    'Villa': 3500,
    'House': 2000,
    'Apartment': 1800,
    'Office': 1500,
    'Commercial': 2500,
    'Land': 800
  };
  
  const cityMultipliers = {
    'Beirut': 2.0,
    'Jounieh': 1.4,
    'Mount Lebanon': 1.3,
    'Byblos': 1.2,
    'Tripoli': 0.6,
    'Sidon': 0.5,
    'Tyre': 0.5,
    'Zahlé': 0.7,
    'Aley': 1.0,
    'Baalbek': 0.4,
    'Bcharreh': 0.6,
    'Nabatieh': 0.5
  };
  
  const typeMultiplier = baseMultipliers[type] || 1500;
  const cityMultiplier = cityMultipliers[city] || 1.0;
  const bedroomBonus = bedrooms * 20000;
  
  let price = (area * typeMultiplier * cityMultiplier) + bedroomBonus + (Math.random() * 100000 - 50000);
  
  if (type === 'Villa' || type === 'Land') {
    price *= (1.5 + Math.random());
  }
  
  return Math.round(price / 1000) * 1000;
};

const generateArea = (type) => {
  const ranges = {
    'Apartment': { min: 80, max: 400 },
    'House': { min: 200, max: 600 },
    'Villa': { min: 400, max: 1200 },
    'Office': { min: 50, max: 500 },
    'Commercial': { min: 100, max: 800 },
    'Land': { min: 500, max: 5000 }
  };
  
  const range = ranges[type] || { min: 100, max: 500 };
  return Math.floor(Math.random() * (range.max - range.min) + range.min);
};

const generateBedrooms = (type) => {
  const counts = {
    'Apartment': [1, 2, 3, 4, 5],
    'House': [2, 3, 4, 5, 6],
    'Villa': [3, 4, 5, 6, 7],
    'Office': [0, 0, 0, 0],
    'Commercial': [0, 0, 0],
    'Land': [0, 0]
  };
  return getRandomElement(counts[type] || [1, 2, 3]);
};

const generateBathrooms = (bedrooms) => {
  return Math.max(1, Math.floor(bedrooms * 0.7) + Math.floor(Math.random() * 2));
};

const generateDescription = (type, bedrooms, area, neighborhood) => {
  let template = getRandomElement(descriptions[type] || descriptions['Apartment']);
  return template
    .replace('{bedrooms}', bedrooms)
    .replace('{area}', area)
    .replace('{neighborhood}', neighborhood);
};

const generateTitle = (type, bedrooms, neighborhood) => {
  const adjectives = ['Stunning', 'Luxurious', 'Modern', 'Elegant', 'Spacious', 'Charming', 'Prime', 'Exceptional', 'Beautiful', 'Magnificent'];
  const prefix = type === 'Apartment' || type === 'Office' ? 'Beautiful' : 'Stunning';
  const suffix = type === 'Land' ? `${area}m²` : `${bedrooms} Bed`;
  return `${prefix} ${bedrooms > 0 ? bedrooms + ' ' : ''}${type} in ${neighborhood}`;
};

const generateFeatures = (type, bedrooms, hasPool = false) => {
  let features = [];
  
  if (type !== 'Land' && Math.random() > 0.3) {
    features.push('Balcony');
  }
  if (Math.random() > 0.5) {
    features.push(hasPool ? 'Swimming Pool' : getRandomElement(['Sea View', 'Mountain View']));
  }
  if (Math.random() > 0.4) {
    features.push('Parking');
  }
  if (Math.random() > 0.5) {
    features.push('Central Heating');
  }
  if (Math.random() > 0.5) {
    features.push('Air Conditioning');
  }
  if (Math.random() > 0.6) {
    features.push('Generator');
  }
  if (Math.random() > 0.7) {
    features.push('Security');
  }
  if (type !== 'Land' && Math.random() > 0.6) {
    features.push('Elevator');
  }
  if (type === 'Villa' || type === 'House') {
    if (Math.random() > 0.5) features.push('Garden');
    if (hasPool) features.push('Swimming Pool');
    if (Math.random() > 0.6) features.push('Maid\'s Room');
  }
  if (type === 'Apartment' && bedrooms >= 3) {
    if (Math.random() > 0.6) features.push('Duplex');
  }
  
  return [...new Set(features)];
};

const seedProperties = async (count = 100) => {
  try {
    console.log(`🌱 Seeding ${count} Lebanese properties...`);
    
    await Visit.destroy({ where: {} });
    await PriceHistory.destroy({ where: {} });
    await Document.destroy({ where: {} });
    await Deal.destroy({ where: {} });
    await Property.destroy({ where: {} });
    
    const users = await User.findAll();
    const groups = await Group.findAll();
    
    const properties = [];
    
    for (let i = 0; i < count; i++) {
      const city = getRandomElement(lebaneseCities);
      const cityNeighborhoods = neighborhoods[city] || ['Central'];
      const neighborhood = getRandomElement(cityNeighborhoods);
      const type = getRandomElement(propertyTypes);
      const bedrooms = generateBedrooms(type);
      const bathrooms = type !== 'Land' && type !== 'Office' ? generateBathrooms(bedrooms) : 0;
      const area = generateArea(type);
      const price = generatePrice(type, bedrooms, area, city);
      const status = getRandomElement(['Available', 'Available', 'Available', 'Reserved', 'Sold', 'Rented']);
      const yearBuilt = type === 'Land' ? null : (1970 + Math.floor(Math.random() * 55));
      const parkingSpaces = type === 'Land' ? 0 : (Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : 0);
      const hasPool = type !== 'Office' && type !== 'Land' && Math.random() > 0.7;
      const features = generateFeatures(type, bedrooms, hasPool);
      const numPhotos = 2 + Math.floor(Math.random() * 4);
      
      const property = {
        id: uuidv4(),
        title: `${getRandomElement(['Stunning', 'Luxurious', 'Modern', 'Elegant', 'Spacious', 'Charming', 'Prime', 'Beautiful'])} ${bedrooms > 0 ? bedrooms + 'BR ' : ''}${type}${type !== 'Land' ? ' in ' + neighborhood : ''}`,
        description: generateDescription(type, bedrooms, area, neighborhood),
        price: price,
        status: status,
        type: type,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        area: area,
        lotSize: type === 'Villa' || type === 'House' ? area * (2 + Math.random() * 2) : 0,
        yearBuilt: yearBuilt,
        parkingSpaces: parkingSpaces,
        address: `${Math.floor(Math.random() * 200) + 1}, ${neighborhood}`,
        city: city,
        country: 'Lebanon',
        lat: 33.8886 + (Math.random() - 0.5) * 0.2,
        lng: 35.4955 + (Math.random() - 0.5) * 0.2,
        photos: getRandomElements(unsplashImages, numPhotos),
        videos: Math.random() > 0.8 ? ['https://example.com/video-' + i] : [],
        tours360: Math.random() > 0.9 ? ['https://example.com/tour-' + i] : [],
        features: features,
        views: Math.floor(Math.random() * 500) + 10,
        inquiries: Math.floor(Math.random() * 50),
        daysOnMarket: Math.floor(Math.random() * 180),
        pricePerSqm: Math.round(price / area),
        marketValue: Math.round(price * (0.95 + Math.random() * 0.15)),
        commissionPercentage: type === 'Land' ? 5 : (type === 'Commercial' ? 4 : 3)
      };
      
      if (Math.random() > 0.3) {
        if (Math.random() > 0.5 && users.length > 0) {
          property.assignedToUserId = getRandomElement(users)?.id;
        } else if (groups.length > 0) {
          property.assignedToGroupId = getRandomElement(groups)?.id;
        }
      }
      
      properties.push(property);
    }
    
    console.log(`📦 Creating ${properties.length} properties...`);
    
    for (const propData of properties) {
      const property = await Property.create(propData);
      
      await PriceHistory.create({
        propertyId: property.id,
        price: propData.price,
        note: 'Initial Listing'
      });
      
      if (Math.random() > 0.85 && propData.status !== 'Available') {
        const originalPrice = propData.price * (0.9 + Math.random() * 0.15);
        await PriceHistory.create({
          propertyId: property.id,
          price: Math.round(originalPrice / 1000) * 1000,
          changeDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          note: 'Previous Listing Price'
        });
      }
    }
    
    console.log(`✅ Successfully seeded ${count} Lebanese properties!`);
    console.log(`📊 Breakdown by city:`);
    const byCity = properties.reduce((acc, p) => {
      acc[p.city] = (acc[p.city] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byCity).forEach(([city, count]) => {
      console.log(`   ${city}: ${count}`);
    });
    
    console.log(`📊 Breakdown by type:`);
    const byType = properties.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding properties:', error);
    throw error;
  }
};

module.exports = seedProperties;

if (require.main === module) {
  const run = async () => {
    try {
      console.log('🔌 Connecting to database...');
      await connectDB();
      console.log('🌱 Seeding 100 Lebanese properties...');
      await seedProperties(100);
      process.exit(0);
    } catch (error) {
      console.error('💥 Failed to seed properties:', error);
      process.exit(1);
    }
  };
  run();
}
