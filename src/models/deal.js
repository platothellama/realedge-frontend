const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Deal = sequelize.define('Deal', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  buyerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sellerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  commission: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0
  },
  dealStage: {
    type: DataTypes.ENUM('Negotiation', 'Reserved', 'Contract Signed', 'Payment', 'Closed'),
    defaultValue: 'Negotiation'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  brokerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  finalPrice: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  buyerLeadId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Deal;
