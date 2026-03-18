const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LoginLog = sequelize.define('LoginLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  ipAddress: {
    type: DataTypes.STRING
  },
  userAgent: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('Success', 'Failed'),
    defaultValue: 'Success'
  },
  failureReason: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  updatedAt: false
});

module.exports = LoginLog;
