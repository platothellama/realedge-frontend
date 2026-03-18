const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EmailTracking = sequelize.define('EmailTracking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  leadId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  campaignId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  agentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recipientEmail: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed'),
    defaultValue: 'sent'
  },
  sentAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  clickedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  repliedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  openCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  clickCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  links: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  timestamps: true
});

module.exports = EmailTracking;
