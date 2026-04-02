const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DealCommission = sequelize.define('DealCommission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  dealId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Deals',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Groups',
      key: 'id'
    },
    comment: 'Nullable for individual sales'
  },
  roleInDeal: {
    type: DataTypes.ENUM('seller_agent', 'buyer_agent', 'co_agent', 'team_leader'),
    allowNull: false,
    comment: 'Role of user in this specific deal'
  },
  percentage: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: 'Percentage of total commission this user receives'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Calculated commission amount'
  },
  salePrice: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Property sale price'
  },
  totalCommission: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Total gross commission'
  },
  companyAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Company portion of commission'
  },
  companyPercentage: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Company percentage split'
  },
  agentAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Agent portion of commission (same as amount)'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'paid'),
    defaultValue: 'pending'
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = DealCommission;
