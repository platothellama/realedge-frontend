const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Commission = sequelize.define('Commission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  dealId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  agentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  salePrice: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  commissionPercentage: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  grossCommission: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  agentSharePercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 60
  },
  agentCommission: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  officeCommission: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'paid', 'disbursed'),
    defaultValue: 'pending'
  },
  paidAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  calculatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  paranoid: true
});

module.exports = Commission;
