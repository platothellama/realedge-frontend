const { Invoice, Deal, Property, User } = require('../models/associations');

exports.getInvoices = async (req, res) => {
  try {
    const { status, type, startDate, endDate } = req.query;
    let where = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate && endDate) {
      where.issueDate = {
        between: [new Date(startDate), new Date(endDate)]
      };
    }

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'title'] },
        { model: Deal, as: 'deal', attributes: ['id', 'title'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices', error: error.message });
  }
};

// PHASE 2 (D14): VAT default comes from the `vat_rate` system setting
// (default 11, super-admin-configurable); invoice numbers come from an
// atomic per-year counter (no count+1 race, no reuse after delete).
async function getVatRate() {
  try {
    const { SystemSetting } = require('../models/associations');
    const s = await SystemSetting.findOne({ where: { sKey: 'vat_rate' } });
    const v = s ? Number(s.value?.rate ?? s.value) : 11;
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 11;
  } catch (_) { return 11; }
}

async function nextInvoiceNumber() {
  const { SystemSetting } = require('../models/associations');
  const { sequelize } = require('../config/database');
  const year = new Date().getFullYear();
  const key = `invoice_seq_${year}`;
  const t = await sequelize.transaction();
  try {
    let row = await SystemSetting.findOne({ where: { sKey: key }, transaction: t, lock: t.LOCK.UPDATE });
    if (!row) {
      row = await SystemSetting.create({
        sKey: key, value: { next: 2 }, type: 'general',
        description: 'Atomic invoice counter (D14 sequence)',
        isEditable: false
      }, { transaction: t });
      await t.commit();
      return `INV-${year}-0001`;
    }
    const next = Number(row.value?.next ?? 1);
    await row.update({ value: { next: next + 1 } }, { transaction: t });
    await t.commit();
    return `INV-${year}-${String(next).padStart(4, '0')}`;
  } catch (e) {
    try { await t.rollback(); } catch (_) {}
    throw e;
  }
}

exports.createInvoice = async (req, res) => {
  try {
    const invoiceData = { ...req.body };

    invoiceData.invoiceNumber = await nextInvoiceNumber();

    if (invoiceData.taxRate === undefined || invoiceData.taxRate === null || invoiceData.taxRate === '') {
      invoiceData.taxRate = await getVatRate();
    }
    const rate = Number(invoiceData.taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ message: 'taxRate must be between 0 and 100' });
    }

    if (invoiceData.lineItems && Array.isArray(invoiceData.lineItems)) {
      invoiceData.subtotal = invoiceData.lineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    }

    invoiceData.subtotal = Number(invoiceData.subtotal) || 0;
    invoiceData.discount = Number(invoiceData.discount) || 0;
    if (invoiceData.discount < 0 || invoiceData.discount > invoiceData.subtotal + (invoiceData.subtotal * rate / 100)) {
      return res.status(400).json({ message: 'Discount cannot be negative or exceed the taxed subtotal' });
    }
    invoiceData.taxAmount = invoiceData.subtotal * (rate / 100);
    invoiceData.total = invoiceData.subtotal + invoiceData.taxAmount - invoiceData.discount;
    if (invoiceData.paidAmount === undefined) invoiceData.paidAmount = 0;

    const invoice = await Invoice.create(invoiceData);
    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Error creating invoice', error: error.message });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const updateData = { ...req.body };
    
    if (updateData.lineItems && Array.isArray(updateData.lineItems)) {
      updateData.subtotal = updateData.lineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      updateData.taxAmount = updateData.subtotal * (updateData.taxRate / 100);
      updateData.total = updateData.subtotal + updateData.taxAmount - (updateData.discount || 0);
    }

    await invoice.update(updateData);
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Error updating invoice', error: error.message });
  }
};

exports.markAsPaid = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // PHASE 2 (D14d/D13): partial payments allowed. Optional {amount} records
    // one payment against paidAmount; Paid when paidAmount >= total (exact,
    // D13 zero tolerance). Overpayment rejected.
    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cancelled invoices cannot be paid' });
    }
    const amount = req.body?.amount !== undefined ? Number(req.body.amount) : Number(invoice.total) - Number(invoice.paidAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be a positive number' });
    }
    const outstanding = Number(invoice.total) - Number(invoice.paidAmount || 0);
    if (amount - outstanding > 0) {
      return res.status(400).json({ message: `Overpayment rejected: outstanding is ${outstanding.toFixed(2)} (D13, exact)` });
    }
    const newPaid = Number(invoice.paidAmount || 0) + amount;
    const isPaid = newPaid - Number(invoice.total) >= 0;
    await invoice.update({
      paidAmount: newPaid,
      status: isPaid ? 'Paid' : invoice.status,
      paidDate: isPaid ? new Date() : invoice.paidDate
    });

    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Error marking invoice as paid', error: error.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // PHASE 2 (D21): Paid invoices are immutable (void via Cancelled, never
    // hard-delete). Draft/Cancelled may be deleted.
    if (invoice.status === 'Paid') {
      return res.status(403).json({ message: 'Paid invoices cannot be deleted (void-only). Cancel the invoice instead (D21).' });
    }

    await invoice.destroy();
    res.status(200).json({ message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invoice', error: error.message });
  }
};

// PHASE 2 (D14a): VAT rate readable by staff, changeable by Super Admin.
exports.getVatRate = async (req, res) => {
  res.status(200).json({ rate: await getVatRate() });
};

exports.updateVatRate = async (req, res) => {
  const rate = Number(req.body?.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return res.status(400).json({ message: 'VAT rate must be between 0 and 100' });
  }
  const { SystemSetting } = require('../models/associations');
  const [row, created] = await SystemSetting.findOrCreate({
    where: { sKey: 'vat_rate' },
    defaults: { sKey: 'vat_rate', value: { rate }, type: 'general', description: 'Default invoice VAT % (D14a)', isEditable: true }
  });
  if (!created) await row.update({ value: { rate } });
  res.status(200).json({ rate });
};

exports.getInvoiceStats = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    // PHASE 2 (D14c): Cancelled excluded from main totals, shown separately.
    const live = { status: { [Op.ne]: 'Cancelled' } };
    const totalInvoiced = await Invoice.sum('total', { where: live }) || 0;
    const totalPaid = await Invoice.sum('paidAmount', { where: { status: 'Paid' } }) || 0;
    const totalOutstanding = totalInvoiced - totalPaid;
    const cancelledTotal = await Invoice.sum('total', { where: { status: 'Cancelled' } }) || 0;
    const cancelledCount = await Invoice.count({ where: { status: 'Cancelled' } });
    
    const overdueCount = await Invoice.count({ 
      where: { 
        status: { [Op.ne]: 'Paid' },
        dueDate: { [Op.lt]: new Date() }
      }
    });

    const paidCount = await Invoice.count({ where: { status: 'Paid' } });
    const pendingCount = await Invoice.count({ where: { status: { [Op.in]: ['Draft', 'Sent'] } } });
    const overdueInvoiceCount = await Invoice.count({ 
      where: { 
        status: { [Op.eq]: 'Overdue' }
      }
    });

    const byStatus = await Invoice.findAll({
      attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
      group: ['status']
    });

    const byType = await Invoice.findAll({
      attributes: ['type', [require('sequelize').fn('SUM', require('sequelize').col('total')), 'total'], [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
      group: ['type']
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const thisMonthInvoices = await Invoice.sum('total', { where: { issueDate: { [Op.gte]: thisMonth }, status: { [Op.ne]: 'Cancelled' } } }) || 0;
    const thisMonthPaid = await Invoice.sum('paidAmount', { where: { status: 'Paid', paidDate: { [Op.gte]: thisMonth } } }) || 0;

    res.status(200).json({
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      cancelledTotal,
      cancelledCount,
      overdueCount,
      paidCount,
      pendingCount,
      overdueInvoiceCount,
      thisMonthInvoices,
      thisMonthPaid,
      byStatus: byStatus.map(s => ({ status: s.status, count: Number(s.dataValues.count) })),
      byType: byType.map(t => ({ type: t.type, total: Number(t.dataValues.total), count: Number(t.dataValues.count) }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoice stats', error: error.message });
  }
};
