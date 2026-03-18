const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PriceHistory = sequelize.define('PriceHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  changeDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  note: {
    type: DataTypes.STRING,
    allowNull: true
  },
  leadId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = PriceHistory;
