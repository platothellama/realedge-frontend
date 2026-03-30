const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserGroup = sequelize.define('UserGroup', {
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
    allowNull: false,
    references: {
      model: 'Groups',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.ENUM('team_leader', 'senior_agent', 'agent', 'trainee'),
    defaultValue: 'agent'
  },
  commissionSplit: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Optional override percentage for this user in this group (0-100)'
  }
}, {
  timestamps: true,
  primaryKey: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'groupId']
    }
  ]
});

module.exports = UserGroup;
