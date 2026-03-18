const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM('income', 'expense'),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('commission', 'rental', 'sale', 'consulting', 'marketing', 'salary', 'office', 'utilities', 'maintenance', 'other'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  propertyId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  dealId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  vendor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurringFrequency: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    defaultValue: 'completed'
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'credit_card', 'check', 'online'),
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Transaction;
