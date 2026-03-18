const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BuyerPreference = sequelize.define('BuyerPreference', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  agentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  clientId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  clientName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  clientEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  clientPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  budgetMin: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  budgetMax: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  propertyType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bedrooms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  bathrooms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  minArea: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  maxArea: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  preferredLocations: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  purchaseType: {
    type: DataTypes.ENUM('buy', 'rent'),
    defaultValue: 'buy'
  },
  parkingRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  balconyRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  furnishedRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  floorPreference: {
    type: DataTypes.STRING,
    allowNull: true
  },
  viewType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  distanceToSchool: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  distanceToTransport: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  additionalFeatures: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'matched', 'archived'),
    defaultValue: 'active'
  },
  matchCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastMatchedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = BuyerPreference;
