const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ListingMethodHistory = sequelize.define('ListingMethodHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  listingMethodId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  note: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = ListingMethodHistory;
