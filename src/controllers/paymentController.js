const { Payment, PaymentPlan, Deal, Invoice, User, Property, Lead } = require('../models/associations');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

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
    res.status(500).json({ message: 'Error fetching payments', ...require('../utils/http').safeError(error) });
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
    res.status(500).json({ message: 'Error fetching payment', ...require('../utils/http').safeError(error) });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { 
      dealId, invoiceId, installmentNumber, payerName, payerPhone,
      amount, currency, exchangeRate, paymentDate, paymentMethod,
      referenceNumber, bankName, notes, status
    } = req.body;

    // PHASE 2 (D10/D11/D12/D13): USD reporting with payment-date rate;
    // LBP without a valid rate is HELD (Pending, amountInUSD NULL, excluded
    // from sums). Default status Pending. Overpayment rejected exact (D13).
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Payment amount must be a positive number' });
    }
    const cur = currency || 'USD';
    const rate = exchangeRate !== undefined && exchangeRate !== null && exchangeRate !== '' ? Number(exchangeRate) : null;

    let heldForRate = false;
    let amountInUSD = null;
    if (cur === 'LBP') {
      if (rate === null || !Number.isFinite(rate) || rate <= 0) {
        heldForRate = true; // D11 hold: keep row, exclude from sums
      } else {
        amountInUSD = amt / rate;
      }
    } else {
      amountInUSD = amt;
    }

    // D13 exact overpay guard (Confirmed totals only; held rows excluded).
    // QA 2026-09-18: guard + insert run inside one transaction with a row
    // lock on the deal, so two parallel payments cannot both pass the guard
    // and overpay the deal (double-submit / double-click safe).
    const t = await sequelize.transaction();
    let payment;
    try {
      if (dealId && amountInUSD !== null) {
        const deal = await Deal.findByPk(dealId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!deal) {
          await t.rollback();
          return res.status(404).json({ message: 'Deal not found' });
        }
        const confirmed = await Payment.sum('amountInUSD', { where: { dealId, status: 'Confirmed' }, transaction: t }) || 0;
        const outstanding = Number(deal.finalPrice || 0) - Number(confirmed || 0);
        if ((Number(confirmed) + amountInUSD) - Number(deal.finalPrice || 0) > 0) {
          await t.rollback();
          return res.status(400).json({ message: `Overpayment rejected: outstanding is ${outstanding.toFixed(2)} (D13, exact)` });
        }
      }

      payment = await Payment.create({
        dealId,
        invoiceId,
        installmentNumber,
        payerName,
        payerPhone,
        amount: amt,
        currency: cur,
        exchangeRate: rate,
        amountInUSD,
        rateDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentDate,
        paymentMethod,
        referenceNumber,
        bankName,
        notes: heldForRate ? [notes, 'HELD: missing/invalid LBP rate (D11)'].filter(Boolean).join(' | ') : notes,
        // QA hardening 2026-09-18: payments are born Pending; Confirmed must
        // come from the update flow (D19 Accountant/Admin gate). Honoring
        // client `status` here bypassed confirmation at birth.
        status: 'Pending',
        recordedByUserId: req.user.id
      }, { transaction: t });
      await t.commit();
    } catch (txErr) {
      try { await t.rollback(); } catch (_) { /* already settled */ }
      throw txErr;
    }

    const fullPayment = await Payment.findByPk(payment.id, {
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title', 'finalPrice', 'dealStage'] }
      ]
    });

    res.status(201).json(fullPayment);
  } catch (error) {
    res.status(400).json({ message: 'Error creating payment', ...require('../utils/http').safeError(error) });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // PHASE 2 (D19): only Accountant/Admin can confirm (verify) payments.
    if (req.body?.status === 'Confirmed' && payment.status !== 'Confirmed') {
      const r = req.user?.role;
      if (r !== 'Super Admin' && r !== 'Admin' && r !== 'Accountant') {
        return res.status(403).json({ message: 'Only Accountant/Admin can confirm payments' });
      }
    }

    // QA hardening 2026-09-18: status state machine. Confirmed rows feed
    // revenue sums — leaving Confirmed must only go to Refunded (never back
    // to Pending, which would silently erase revenue); Refunded is terminal.
    const PAYMENT_TRANSITIONS = {
      Pending: ['Pending', 'Confirmed', 'Rejected'],
      Confirmed: ['Confirmed', 'Refunded'],
      Rejected: ['Rejected', 'Pending'],
      Refunded: ['Refunded']
    };
    const updateData = { ...req.body };
    // QA 2026-09-18: PK/timestamps never client-settable.
    for (const f of ['id', 'createdAt', 'updatedAt']) {
      delete updateData[f];
    }
    if (updateData.status !== undefined) {
      const allowed = PAYMENT_TRANSITIONS[payment.status];
      if (!allowed) {
        return res.status(400).json({ message: `Invalid current payment status: ${payment.status}` });
      }
      if (!allowed.includes(updateData.status)) {
        return res.status(400).json({ message: `Cannot move payment from ${payment.status} to ${updateData.status}` });
      }
    }
    // QA hardening 2026-09-18: server-computed/audit fields are never
    // client-settable (amountInUSD could otherwise be forged without
    // changing amount; recordedByUserId impersonates the recorder).
    delete updateData.amountInUSD;
    delete updateData.rateDate;
    delete updateData.recordedByUserId;

    // QA hardening 2026-09-18: money fields on Confirmed/Refunded rows are
    // immutable (otherwise the LBP-hold path below could force a Confirmed
    // row back to Pending and silently erase revenue). Refund + re-record.
    if ((payment.status === 'Confirmed' || payment.status === 'Refunded') &&
        (updateData.amount !== undefined || updateData.currency !== undefined || updateData.exchangeRate !== undefined)) {
      return res.status(400).json({ message: `Cannot edit money fields on a ${payment.status} payment (refund and re-record instead).` });
    }

    // PHASE 2 (D10/D11): guarded recompute — never divide by zero/missing.
    if (updateData.amount !== undefined || updateData.currency !== undefined || updateData.exchangeRate !== undefined) {
      const amount = updateData.amount !== undefined ? Number(updateData.amount) : Number(payment.amount);
      const currency = updateData.currency || payment.currency;
      const exchangeRate = updateData.exchangeRate !== undefined ? Number(updateData.exchangeRate) : Number(payment.exchangeRate);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Payment amount must be a positive number' });
      }
      if (currency === 'LBP') {
        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
          updateData.amountInUSD = null; // held (D11)
          updateData.status = 'Pending';
        } else {
          updateData.amountInUSD = amount / exchangeRate;
          updateData.rateDate = updateData.paymentDate ? new Date(updateData.paymentDate) : (payment.rateDate || new Date());
        }
      } else {
        updateData.amountInUSD = amount;
      }
      updateData.amount = amount;
      updateData.exchangeRate = Number.isFinite(exchangeRate) ? exchangeRate : null;
    }

    await payment.update(updateData);

    const updatedPayment = await Payment.findByPk(payment.id, {
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title', 'finalPrice', 'dealStage'] }
      ]
    });

    res.status(200).json(updatedPayment);
  } catch (error) {
    res.status(400).json({ message: 'Error updating payment', ...require('../utils/http').safeError(error) });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // PHASE 2 (D21): payments are immutable — void via status
    // (Rejected/Refunded), never hard-delete. Admin-only void preserved
    // through updatePayment status change.
    return res.status(403).json({ message: 'Payments cannot be deleted (void-only). Set status to Rejected/Refunded instead (D21).' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting payment', ...require('../utils/http').safeError(error) });
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

    // PHASE 2 (D12): only Confirmed with a converted amount counts as paid.
    // Pending (incl. rate-held) is pipeline; Rejected/Refunded excluded.
    const confirmed = payments.filter(p => p.status === 'Confirmed' && p.amountInUSD !== null);
    const totalPaid = confirmed.reduce((sum, p) => sum + Number(p.amountInUSD || 0), 0);
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
        totalPaidInOriginalCurrency: confirmed.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        finalPrice,
        remaining,
        percentPaid: Math.round(percentPaid * 100) / 100,
        paymentCount: payments.length,
        confirmedCount: confirmed.length,
        pendingCount: payments.filter(p => p.status === 'Pending').length,
        currencies: [...new Set(payments.map(p => p.currency))]
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment summary', ...require('../utils/http').safeError(error) });
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
    res.status(500).json({ message: 'Error fetching payment plans', ...require('../utils/http').safeError(error) });
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
    res.status(500).json({ message: 'Error fetching payment plan', ...require('../utils/http').safeError(error) });
  }
};

exports.createPaymentPlan = async (req, res) => {
  try {
    const {
      dealId, planName, totalAmount, currency, numberOfInstallments,
      startDate, endDate, installmentAmount, notes
    } = req.body;

    // QA 2026-09-18: plans previously trusted every numeric/date blindly
    // (negative totals, NaN installments persisted).
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ message: 'Plan total amount must be a positive number' });
    }
    const count = Number(numberOfInstallments);
    if (!Number.isInteger(count) || count <= 0 || count > 360) {
      return res.status(400).json({ message: 'Number of installments must be an integer between 1 and 360' });
    }
    if (installmentAmount !== undefined && installmentAmount !== null && installmentAmount !== '') {
      const inst = Number(installmentAmount);
      if (!Number.isFinite(inst) || inst <= 0) {
        return res.status(400).json({ message: 'Installment amount must be a positive number' });
      }
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ message: 'Plan start date cannot be after end date' });
    }
    if (dealId) {
      const deal = await Deal.findByPk(dealId);
      if (!deal) return res.status(404).json({ message: 'Deal not found' });
    }

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
    res.status(400).json({ message: 'Error creating payment plan', ...require('../utils/http').safeError(error) });
  }
};

exports.updatePaymentPlan = async (req, res) => {
  try {
    const plan = await PaymentPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Payment plan not found' });

    // QA hardening 2026-09-18: plans cannot be reparented to another deal
    // and authorship/PK are immutable (no UI calls this path — verified).
    const PLAN_FIELDS = ['planName', 'totalAmount', 'currency', 'numberOfInstallments', 'startDate', 'endDate', 'installmentAmount', 'status', 'notes'];
    const planData = {};
    for (const f of PLAN_FIELDS) {
      if (req.body && req.body[f] !== undefined) planData[f] = req.body[f];
    }
    await plan.update(planData);

    const updatedPlan = await PaymentPlan.findByPk(plan.id, {
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title'] }
      ]
    });

    res.status(200).json(updatedPlan);
  } catch (error) {
    res.status(400).json({ message: 'Error updating payment plan', ...require('../utils/http').safeError(error) });
  }
};

exports.deletePaymentPlan = async (req, res) => {
  try {
    const plan = await PaymentPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Payment plan not found' });

    await plan.destroy();
    res.status(200).json({ message: 'Payment plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting payment plan', ...require('../utils/http').safeError(error) });
  }
};

exports.getCashTracking = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    // PHASE 2 (D12/D19): cash tracking counts Confirmed only; non-privileged
    // callers are scoped to their own records (no client-controlled userId).
    const where = { paymentMethod: 'Cash', status: 'Confirmed' };

    if (startDate && endDate) {
      where.paymentDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const callerRole = req.user?.role;
    if (callerRole === 'Super Admin' || callerRole === 'Admin' || callerRole === 'Accountant') {
      if (userId) where.recordedByUserId = userId;
    } else {
      where.recordedByUserId = req.user.id;
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
    res.status(500).json({ message: 'Error fetching cash tracking', ...require('../utils/http').safeError(error) });
  }
};