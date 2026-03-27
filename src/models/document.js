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
  visibility: {
    type: DataTypes.ENUM('internal', 'shareable'),
    defaultValue: 'shareable'
  },
  signerClient: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  signerAgent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  signerOwner: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  signatureStatus: {
    type: DataTypes.ENUM('pending', 'signed'),
    defaultValue: 'pending'
  },
  signingToken: {
    type: DataTypes.UUID,
    allowNull: true,
    unique: true
  },
  signingLinkExpiresAt: {
    type: DataTypes.DATE,
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
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'User associated with this document'
  },
  documentContentHash: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'SHA-256 hash of document content for tamper detection'
  },
  isTamberSealed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether document has tamper-evident seal'
  },
  signedBySignerId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Signer ID for multi-signer documents'
  },
  signatureOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Order of signing for multi-signer documents'
  },
  requiredSignerCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Number of required signers'
  },
  currentSignerIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Current signer index for sequential signing'
  },
  signingOrder: {
    type: DataTypes.ENUM('sequential', 'parallel'),
    defaultValue: 'sequential',
    comment: 'Signing order type'
  },
  retentionPeriodDays: {
    type: DataTypes.INTEGER,
    defaultValue: 2555,
    comment: 'Data retention period in days (default 7 years)'
  },
  retentionExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When document should be auto-deleted'
  },
  legalJurisdiction: {
    type: DataTypes.STRING,
    defaultValue: 'US',
    comment: 'Legal jurisdiction for e-signature compliance (US=ESIGN, EU=eIDAS)'
  },
  esignCompliance: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'ESIGN Act compliance flag'
  },
  eidasCompliance: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'eIDAS compliance flag for EU'
  }
}, {
  timestamps: true
});

module.exports = Document;
