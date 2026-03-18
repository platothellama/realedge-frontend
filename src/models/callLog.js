const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CallLog = sequelize.define('CallLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  leadId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  agentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  direction: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('no_answer', 'busy', 'failed', 'completed', 'voicemail'),
    defaultValue: 'completed'
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recordingUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  outcome: {
    type: DataTypes.ENUM('interested', 'not_interested', 'callback', 'wrong_number', 'no_answer'),
    defaultValue: 'interested'
  }
}, {
  timestamps: true
});

module.exports = CallLog;
