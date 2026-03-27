const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('Contract', 'Property Paper', 'Client ID', 'Permit', 'Other'),
    defaultValue: 'Other'
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Pending Signature', 'Signed', 'Expired', 'Archived'),
    defaultValue: 'Draft'
  },
  currentVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  dealId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  uploadedByUserId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  isDigitalSignatureEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  signedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  signedByUserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'User associated with this document'
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Group associated with this document'
  }
}, {
  timestamps: true
});

module.exports = Document;
