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
    type: DataTypes.ENUM(
      'Title Deed',
      'Floor Plan',
      'Property Photos',
      'Ownership Proof',
      'Reservation Form',
      'Sales Agreement',
      'Contract',
      'Payment Receipt',
      'ID / Passport',
      'Proof of Funds',
      'Other'
    ),
    defaultValue: 'Other'
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Pending Signature', 'Signed', 'Expired', 'Archived'),
    defaultValue: 'Draft'
  },
  visibility: {
    type: DataTypes.ENUM('internal', 'shareable'),
    defaultValue: 'internal'
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
  sellerId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  teamUserId: {
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
  signers: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  signatureTokens: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  signedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  signedByUserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  signatureHash: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Document;
