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

exports.createInvoice = async (req, res) => {
  try {
    const invoiceData = { ...req.body };
    
    const count = await Invoice.count() + 1;
    invoiceData.invoiceNumber = `INV-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;
    
    if (invoiceData.lineItems && Array.isArray(invoiceData.lineItems)) {
      invoiceData.subtotal = invoiceData.lineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    }
    
    invoiceData.taxAmount = invoiceData.subtotal * (invoiceData.taxRate / 100);
    invoiceData.total = invoiceData.subtotal + invoiceData.taxAmount - (invoiceData.discount || 0);

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

    await invoice.update({
      status: 'Paid',
      paidDate: new Date(),
      paidAmount: invoice.total
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

    await invoice.destroy();
    res.status(200).json({ message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invoice', error: error.message });
  }
};

exports.getInvoiceStats = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    const totalInvoiced = await Invoice.sum('total') || 0;
    const totalPaid = await Invoice.sum('paidAmount', { where: { status: 'Paid' } }) || 0;
    const totalOutstanding = totalInvoiced - totalPaid;
    
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
    
    const thisMonthInvoices = await Invoice.sum('total', { where: { issueDate: { [Op.gte]: thisMonth } } }) || 0;
    const thisMonthPaid = await Invoice.sum('paidAmount', { where: { status: 'Paid', paidDate: { [Op.gte]: thisMonth } } }) || 0;

    res.status(200).json({
      totalInvoiced,
      totalPaid,
      totalOutstanding,
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
