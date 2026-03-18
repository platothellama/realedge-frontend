const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TransactionWorkflow = sequelize.define('TransactionWorkflow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  dealId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  clientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  currentStage: {
    type: DataTypes.ENUM('offer_submitted', 'counter_offer', 'contract_pending', 'contract_signed', 'inspection', 'appraisal', 'mortgage_approval', 'closing', 'completed', 'cancelled'),
    defaultValue: 'offer_submitted'
  },
  stages: {
    type: DataTypes.JSON,
    defaultValue: [
      { name: 'Offer Submitted', status: 'pending', date: null },
      { name: 'Counter Offer', status: 'pending', date: null },
      { name: 'Contract Pending', status: 'pending', date: null },
      { name: 'Contract Signed', status: 'pending', date: null },
      { name: 'Inspection', status: 'pending', date: null },
      { name: 'Appraisal', status: 'pending', date: null },
      { name: 'Mortgage Approval', status: 'pending', date: null },
      { name: 'Closing', status: 'pending', date: null },
      { name: 'Completed', status: 'pending', date: null }
    ]
  },
  documents: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  tasks: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  closingDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  inspectorId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  appraiserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  lenderId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = TransactionWorkflow;
