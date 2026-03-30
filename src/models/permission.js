const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  permKey: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'permKey',
    comment: 'e.g., create_property, view_finance, manage_agents'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Group permissions by category (e.g., properties, deals, finance)'
  }
}, {
  timestamps: true,
  tableName: 'Permissions'
});

module.exports = Permission;
