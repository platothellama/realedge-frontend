const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SystemSetting = sequelize.define('SystemSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sKey: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'sKey',
    comment: 'Setting key (e.g., company_commission_split, default_agent_split)'
  },
  value: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Setting value (e.g., { company: 40, team: 60 })'
  },
  type: {
    type: DataTypes.ENUM('commission', 'general', 'feature'),
    defaultValue: 'general'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isEditable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  tableName: 'SystemSettings'
});

module.exports = SystemSetting;
