const { Payment, PaymentPlan, Deal, Invoice, User, Property, Lead } = require('../models/associations');
const { Op } = require('sequelize');

exports.getAllPayments = async (req, res) => {
  try {
    const { dealId, startDate, endDate } = req.query;
    const where = {};

    if (dealId) where.dealId = dealId;
    if (startDate && endDate) {
      where.paymentDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const payments = await Payment.findAll({
      where,
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title', 'finalPrice', 'dealStage'] },
        { model: User, as: 'recorder', attributes: ['id', 'name'] }
      ],
      order: [['paymentDate', 'DESC']]
    });

    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments', error: error.message });
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [
        { model: Deal, as: 'deal' },
        { model: User, as: 'recorder', attributes: ['id', 'name'] }
      ]
    });

    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment', error: error.message });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { 
      dealId, invoiceId, installmentNumber, payerName, payerPhone,
      amount, currency, exchangeRate, paymentDate, paymentMethod,
      referenceNumber, bankName, notes, status
    } = req.body;

    const amountInUSD = currency === 'LBP' && exchangeRate 
      ? Number(amount) / Number(exchangeRate) 
      : Number(amount);

    const payment = await Payment.create({
      dealId,
      invoiceId,
      installmentNumber,
      payerName,
      payerPhone,
      amount,
      currency,
      exchangeRate: exchangeRate || 1,
      amountInUSD,
      paymentDate,
      paymentMethod,
      referenceNumber,
      bankName,
      notes,
      status: status || 'Confirmed',
      recordedByUserId: req.user.id
    });

    const fullPayment = await Payment.findByPk(payment.id, {
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title', 'finalPrice', 'dealStage'] }
      ]
    });

    res.status(201).json(fullPayment);
  } catch (error) {
    res.status(400).json({ message: 'Error creating payment', error: error.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const updateData = { ...req.body };

    if (updateData.amount || updateData.currency || updateData.exchangeRate) {
      const amount = updateData.amount || payment.amount;
      const currency = updateData.currency || payment.currency;
      const exchangeRate = updateData.exchangeRate || payment.exchangeRate;
      updateData.amountInUSD = currency === 'LBP' 
        ? Number(amount) / Number(exchangeRate) 
        : Number(amount);
    }

    await payment.update(updateData);

    const updatedPayment = await Payment.findByPk(payment.id, {
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title', 'finalPrice', 'dealStage'] }
      ]
    });

    res.status(200).json(updatedPayment);
  } catch (error) {
    res.status(400).json({ message: 'Error updating payment', error: error.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    await payment.destroy();
    res.status(200).json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting payment', error: error.message });
  }
};

exports.getDealPaymentSummary = async (req, res) => {
  try {
    const { dealId } = req.params;

    const deal = await Deal.findByPk(dealId, {
      include: [
        { model: Property, as: 'property', attributes: ['id', 'title'] },
        { model: Lead, as: 'buyerLead', attributes: ['id', 'name'] }
      ]
    });

    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    const payments = await Payment.findAll({
      where: { dealId },
      order: [['paymentDate', 'ASC']]
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountInUSD || 0), 0);
    const finalPrice = Number(deal.finalPrice || 0);
    const remaining = finalPrice - totalPaid;
    const percentPaid = finalPrice > 0 ? (totalPaid / finalPrice) * 100 : 0;

    res.status(200).json({
      deal: {
        id: deal.id,
        title: deal.title,
        finalPrice: deal.finalPrice,
        dealStage: deal.dealStage,
        property: deal.property,
        buyer: deal.buyerLead
      },
      payments,
      summary: {
        totalPaid,
        totalPaidInOriginalCurrency: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        finalPrice,
        remaining,
        percentPaid: Math.round(percentPaid * 100) / 100,
        paymentCount: payments.length,
        currencies: [...new Set(payments.map(p => p.currency))]
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment summary', error: error.message });
  }
};

exports.getAllPaymentPlans = async (req, res) => {
  try {
    const { dealId } = req.query;
    const where = dealId ? { dealId } : {};

    const paymentPlans = await PaymentPlan.findAll({
      where,
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title', 'finalPrice'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(paymentPlans);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment plans', error: error.message });
  }
};

exports.getPaymentPlanById = async (req, res) => {
  try {
    const plan = await PaymentPlan.findByPk(req.params.id, {
      include: [
        { model: Deal, as: 'deal' },
        { model: User, as: 'creator', attributes: ['id', 'name'] }
      ]
    });

    if (!plan) return res.status(404).json({ message: 'Payment plan not found' });

    const payments = await Payment.findAll({
      where: { dealId: plan.dealId },
      order: [['installmentNumber', 'ASC'], ['paymentDate', 'ASC']]
    });

    res.status(200).json({ ...plan.toJSON(), payments });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment plan', error: error.message });
  }
};

exports.createPaymentPlan = async (req, res) => {
  try {
    const {
      dealId, planName, totalAmount, currency, numberOfInstallments,
      startDate, endDate, installmentAmount, notes
    } = req.body;

    const plan = await PaymentPlan.create({
      dealId,
      planName,
      totalAmount,
      currency,
      numberOfInstallments,
      startDate,
      endDate,
      installmentAmount,
      status: 'Active',
      notes,
      createdByUserId: req.user.id
    });

    res.status(201).json(plan);
  } catch (error) {
    res.status(400).json({ message: 'Error creating payment plan', error: error.message });
  }
};

exports.updatePaymentPlan = async (req, res) => {
  try {
    const plan = await PaymentPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Payment plan not found' });

    await plan.update(req.body);

    const updatedPlan = await PaymentPlan.findByPk(plan.id, {
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title'] }
      ]
    });

    res.status(200).json(updatedPlan);
  } catch (error) {
    res.status(400).json({ message: 'Error updating payment plan', error: error.message });
  }
};

exports.deletePaymentPlan = async (req, res) => {
  try {
    const plan = await PaymentPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Payment plan not found' });

    await plan.destroy();
    res.status(200).json({ message: 'Payment plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting payment plan', error: error.message });
  }
};

exports.getCashTracking = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const where = { paymentMethod: 'Cash' };

    if (startDate && endDate) {
      where.paymentDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    if (userId) {
      where.recordedByUserId = userId;
    }

    const cashPayments = await Payment.findAll({
      where,
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title'] },
        { model: User, as: 'recorder', attributes: ['id', 'name'] }
      ],
      order: [['paymentDate', 'DESC']]
    });

    const totalCashUSD = cashPayments.reduce((sum, p) => sum + Number(p.amountInUSD || 0), 0);
    const totalCashLBP = cashPayments
      .filter(p => p.currency === 'LBP')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    res.status(200).json({
      payments: cashPayments,
      summary: {
        totalPayments: cashPayments.length,
        totalInUSD: totalCashUSD,
        totalInLBP: totalCashLBP
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cash tracking', error: error.message });
  }
};