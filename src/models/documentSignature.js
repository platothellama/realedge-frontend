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
  },
  agreedToTerms: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  agreedToPrivacyPolicy: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  privacyPolicyAcceptedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  termsAcceptedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  gdprConsent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'GDPR consent for EU users'
  },
  gdprConsentDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  gdprConsentIp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether signer email has been verified'
  },
  emailVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  signingOrder: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Order in multi-signer sequence'
  },
  signerRole: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Role of signer (Client, Agent, Owner, Witness)'
  },
  signatureReason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reason/purpose for signing'
  },
  signerIpAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  signerSessionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tamperCheckPassed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether document tamper check passed at signing time'
  },
  legalDisclosureAcknowledged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Acknowledgment of legal disclosures (ESIGN/eIDAS)'
  },
  legalDisclosureAcknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = DocumentSignature;
