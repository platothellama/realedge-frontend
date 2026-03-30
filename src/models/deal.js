const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Seller = require('./seller');

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
    allowNull: true
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
  sellerId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Associated seller/owner'
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Group (team) associated with this deal'
  }
}, {
  timestamps: true
});

Deal.belongsTo(Seller, { foreignKey: 'sellerId', as: 'seller' });
Seller.hasMany(Deal, { foreignKey: 'sellerId', as: 'deals' });

const Group = require('./group');
Deal.belongsTo(Group, { foreignKey: 'groupId', as: 'dealGroup' });
Group.hasMany(Deal, { foreignKey: 'groupId', as: 'deals' });

module.exports = Deal;
