const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  companyCommission: {
    type: DataTypes.FLOAT,
    defaultValue: 10,
    allowNull: false,
    comment: 'Percentage of sale price the company takes from property commission'
  }
}, {
  timestamps: true
});

module.exports = Group;
