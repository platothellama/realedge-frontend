const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WebsiteVisitor = sequelize.define('WebsiteVisitor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  leadId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referrer: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.JSON,
    allowNull: true
  },
  deviceType: {
    type: DataTypes.ENUM('desktop', 'mobile', 'tablet'),
    defaultValue: 'desktop'
  },
  browser: {
    type: DataTypes.STRING,
    allowNull: true
  },
  os: {
    type: DataTypes.STRING,
    allowNull: true
  },
  firstVisit: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  lastVisit: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  visitCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  totalDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true
});

const WebsiteVisit = sequelize.define('WebsiteVisit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  visitorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  page: {
    type: DataTypes.STRING,
    allowNull: false
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  exitedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true
});

module.exports = { WebsiteVisitor, WebsiteVisit };
