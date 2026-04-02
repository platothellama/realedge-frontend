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
  currency: {
    type: DataTypes.ENUM('USD', 'LBP'),
    defaultValue: 'USD'
  },
  issueDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  supplyDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date of delivery/supply of goods or services'
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
  sellerId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Associated seller/owner'
  },
  clientName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  clientEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  clientPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Client phone number (Lebanese compliance)'
  },
  clientAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  clientTaxId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Client Tax Identification Number (NIF) for Lebanese compliance'
  },
  subtotal: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  taxRate: {
    type: DataTypes.FLOAT,
    defaultValue: 11,
    comment: 'Lebanese VAT rate is typically 11%'
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
  lineItems: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of line items: { description, quantity, unitPrice, total }'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  paymentTerms: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Payment terms (e.g., 30 days, Net 60)'
  },
  paidAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  paidDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sellerName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Seller/Company name for Lebanese compliance'
  },
  sellerLegalForm: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Legal form (SARL, SAL, etc.)'
  },
  sellerCapital: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Company capital'
  },
  sellerTradeRegister: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Trade Register number (RCS)'
  },
  sellerTaxId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Tax Identification Number (NIF)'
  },
  sellerAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Company address'
  },
  sellerPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Company phone'
  },
  sellerEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Company email'
  }
}, {
  timestamps: true,
  paranoid: true
});

module.exports = Invoice;
