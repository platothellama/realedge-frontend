const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentPlan = sequelize.define('PaymentPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  dealId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'The deal this payment plan belongs to'
  },
  planName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g., "Standard Plan", "Custom Plan", "3 Installments"'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Total amount to be paid'
  },
  currency: {
    type: DataTypes.ENUM('USD', 'LBP'),
    defaultValue: 'USD'
  },
  numberOfInstallments: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Number of installments (1 for full payment)'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'First payment due date'
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last payment due date'
  },
  installmentAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Amount per installment'
  },
  status: {
    type: DataTypes.ENUM('Active', 'Completed', 'Cancelled', 'Defaulted'),
    defaultValue: 'Active'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdByUserId: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = PaymentPlan;