const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  dealId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'The deal this payment belongs to'
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Optional: link to invoice'
  },
  installmentNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Installment number (1, 2, 3, etc.)'
  },
  payerName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Who made the payment'
  },
  payerPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Payer phone number'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Amount paid'
  },
  currency: {
    type: DataTypes.ENUM('USD', 'LBP'),
    defaultValue: 'USD',
    comment: 'Payment currency'
  },
  exchangeRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 1,
    comment: 'Exchange rate to USD if payment in LBP'
  },
  amountInUSD: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    // PHASE 2 (D11): nullable — LBP rows held pending a valid rate carry
    // NULL until the rate is supplied, and are excluded from all sums.
    comment: 'Amount in USD for reporting (NULL while rate held)'
  },
  rateDate: {
    // PHASE 2 (D10): FX rate date (payment-date rule). Never restate history.
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date of the exchange rate used (payment-date rule)'
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When payment was made'
  },
  paymentMethod: {
    type: DataTypes.ENUM('Cash', 'Bank Transfer', 'Check', 'Western Union', 'Money Transfer', 'Other'),
    allowNull: false,
    defaultValue: 'Cash',
    comment: 'How payment was received'
  },
  referenceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Transaction/transfer reference number'
  },
  bankName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Bank name for transfers'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Additional notes'
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Confirmed', 'Rejected', 'Refunded'),
    // PHASE 2 (D12/D25): safe default Pending (was fail-open Confirmed).
    defaultValue: 'Pending',
    comment: 'Payment status'
  },
  recordedByUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'User who recorded this payment'
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['dealId'] },
    { fields: ['invoiceId'] },
    { fields: ['paymentDate'] }
  ]
});

module.exports = Payment;