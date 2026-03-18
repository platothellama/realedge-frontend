const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Team = sequelize.define('Team', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  leaderId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  parentTeamId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  officeId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: '#6366f1'
  },
  commissionSplit: {
    type: DataTypes.FLOAT,
    defaultValue: 60
  },
  targetRevenue: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  timestamps: true
});

module.exports = Team;
