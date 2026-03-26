const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DocumentSignature = sequelize.define('DocumentSignature', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  signerType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  signerName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  signerEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'viewed', 'signed', 'expired'),
    defaultValue: 'pending'
  },
  signedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  signedIpAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  signedUserAgent: {
    type: DataTypes.STRING,
    allowNull: true
  },
  signatureHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  documentHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = DocumentSignature;
