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
    allowNull: false,
    comment: 'Amount in USD for统一计算'
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
    defaultValue: 'Confirmed',
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