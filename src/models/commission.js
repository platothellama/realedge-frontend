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
  teamId: {
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
  splitType: {
    type: DataTypes.ENUM('single', 'team', 'multi_agent'),
    defaultValue: 'single'
  },
  agentSharePercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 60
  },
  agentCommission: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  agent2Id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  agent2SharePercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  agent2Commission: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  teamSharePercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  teamCommission: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  companySharePercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 40
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
