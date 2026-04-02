const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Lead = sequelize.define('Lead', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  source: {
    type: DataTypes.ENUM('Website', 'Facebook', 'Google Ads', 'Referral', 'Walk-in'),
    defaultValue: 'Website'
  },
  status: {
    type: DataTypes.ENUM('New Lead', 'Contacted', 'Visit Scheduled', 'Negotiation', 'Closed Deal', 'Lost Lead'),
    defaultValue: 'New Lead'
  },
  interestedIn: {
    type: DataTypes.STRING, // Could be a Property ID or type
    allowNull: true
  },
  budget: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  nationality: {
    type: DataTypes.STRING,
    allowNull: true
  },
  preferredAreas: {
    type: DataTypes.STRING,
    allowNull: true
  },
  propertyPreferences: {
    type: DataTypes.STRING,
    allowNull: true
  },
  score: {
    type: DataTypes.INTEGER, // AI powered scoring
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  assignedToUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Groups',
      key: 'id'
    }
  },
  agentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  job: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referenceType: {
    type: DataTypes.ENUM('lead', 'user', 'text'),
    allowNull: true
  },
  referenceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  referenceText: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['phone'] },
    { fields: ['status'] },
    { fields: ['assignedToUserId'] },
    { fields: ['groupId'] },
    { fields: ['agentId'] }
  ]
});

module.exports = Lead;
