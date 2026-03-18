const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.ENUM('Sale', 'Rental', 'Commission', 'Management Fee', 'Other'),
    defaultValue: 'Sale'
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'),
    defaultValue: 'Draft'
  },
  issueDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  dueDate: {
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
  clientName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  clientEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  clientAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  subtotal: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  taxRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  taxAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  discount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  total: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  paidAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  paidDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  paranoid: true
});

module.exports = Invoice;
