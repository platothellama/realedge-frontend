const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Campaign = sequelize.define('Campaign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('email', 'sms', 'drip', 'followup', 'nurture'),
    defaultValue: 'email'
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'paused', 'completed'),
    defaultValue: 'draft'
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  template: {
    type: DataTypes.JSON,
    allowNull: true
  },
  triggerType: {
    type: DataTypes.ENUM('manual', 'lead_created', 'lead_status', 'property_view', 'inquiry', 'scheduled'),
    defaultValue: 'manual'
  },
  triggerValue: {
    type: DataTypes.STRING,
    allowNull: true
  },
  delayDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  targetAudience: {
    type: DataTypes.JSON,
    allowNull: true
  },
  stats: {
    type: DataTypes.JSON,
    defaultValue: { sent: 0, opened: 0, clicked: 0, replied: 0 }
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Campaign;
