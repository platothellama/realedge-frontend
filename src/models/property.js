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
    type: DataTypes.ENUM('Available', 'Sold', 'Rented', 'Reserved', 'Lost'),
    defaultValue: 'Available'
  },
  soldPrice: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Actual sale price when property is sold'
  },
  soldTo: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Name of buyer when property is sold'
  },
  soldAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when property was sold'
  },
  lostTo: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reason or competitor when property was lost'
  },
  lostAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when property was lost'
  },
  type: {
    type: DataTypes.ENUM('Apartment', 'House', 'Villa', 'Office', 'Land', 'Commercial'),
    defaultValue: 'Apartment'
  },
  bedrooms: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  bathrooms: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  area: {
    type: DataTypes.FLOAT,
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
  features: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  assignedToUserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  assignedToGroupId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  sellerId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Associated seller/owner of the property'
  },
  commissionPercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    allowNull: false,
    comment: 'Legacy field - use commissionType and commissionValue instead'
  },
  commissionType: {
    type: DataTypes.ENUM('percentage', 'fixed'),
    defaultValue: 'percentage',
    allowNull: true,
    comment: 'Type of commission: percentage of price or fixed amount'
  },
  commissionValue: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Commission value (percentage or fixed amount based on commissionType)'
  },
  commissionCurrency: {
    type: DataTypes.STRING(3),
    allowNull: true,
    defaultValue: 'USD',
    comment: 'Currency for fixed commission'
  },
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
  },
  listingType: {
    type: DataTypes.ENUM('Sale', 'Rent'),
    defaultValue: 'Sale'
  },
  condition: {
    type: DataTypes.ENUM('Used', 'New'),
    defaultValue: 'Used'
  },
  floor: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  hasTerrace: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  terraceSize: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Property;
