const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Visit = sequelize.define('Visit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  visitDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Scheduled', 'Completed', 'Cancelled', 'No Show'),
    defaultValue: 'Scheduled'
  },
  clientName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  clientEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  clientPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  brokerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  googleEventId: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Visit;
