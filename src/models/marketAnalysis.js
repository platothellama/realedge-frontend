const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MarketAnalysis = sequelize.define('MarketAnalysis', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false
  },
  propertyType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  avgPricePerSqm: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  avgDaysOnMarket: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalListings: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalSales: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  priceTrend: {
    type: DataTypes.ENUM('Rising', 'Stable', 'Falling'),
    defaultValue: 'Stable'
  },
  demandLevel: {
    type: DataTypes.ENUM('Very Low', 'Low', 'Medium', 'High', 'Very High'),
    defaultValue: 'Medium'
  },
  supplyLevel: {
    type: DataTypes.ENUM('Very Low', 'Low', 'Medium', 'High', 'Very High'),
    defaultValue: 'Medium'
  },
  rentalYield: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  marketValue: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  pricePrediction30Days: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  pricePrediction90Days: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  comparableProperties: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  analysisDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true
});

module.exports = MarketAnalysis;
