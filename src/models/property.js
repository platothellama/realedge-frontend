const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Property = sequelize.define('Property', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Available', 'Sold', 'Rented', 'Reserved'),
    defaultValue: 'Available'
  },
  type: {
    type: DataTypes.ENUM('Apartment', 'House', 'Villa', 'Office', 'Land', 'Commercial'),
    defaultValue: 'Apartment'
  },
  
  // Property Details
  bedrooms: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  bathrooms: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  area: {
    type: DataTypes.FLOAT, // Square meters/feet
    defaultValue: 0
  },
  lotSize: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  yearBuilt: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  parkingSpaces: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  // Location
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },

  // Media (JSON arrays)
  photos: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  videos: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  tours360: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  documents: {
    type: DataTypes.JSON,
    defaultValue: []
  },

  // Assignments
  assignedToUserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  assignedToGroupId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  commissionPercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    allowNull: false
  },
  
  // Analytics
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  inquiries: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  daysOnMarket: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  pricePerSqm: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  marketValue: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  }
}, {
  // Property Features (additional)
  features: {
    type: DataTypes.JSON, 
    defaultValue: []
  }
}, {
  timestamps: true
});

module.exports = Property;
