const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  roleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Roles',
      key: 'id'
    }
  },
  permissionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Permissions',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['roleId', 'permissionId']
    }
  ]
});

module.exports = RolePermission;
