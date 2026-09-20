const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Join table: a lead can be interested in MANY properties,
// and a property can have MANY interested leads.
const LeadProperty = sequelize.define('LeadProperty', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  leadId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Leads',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Properties',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['leadId'] },
    { fields: ['propertyId'] },
    { unique: true, fields: ['leadId', 'propertyId'] }
  ]
});

module.exports = LeadProperty;
