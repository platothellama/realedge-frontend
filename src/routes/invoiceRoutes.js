const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
// QA 2026-09-18: finance-only surface (mirrors the frontend route gate).
// Previously any authenticated role could read/mutate anyone's invoices.
router.use(restrictTo('Super Admin', 'Admin', 'Accountant'));

router.get('/', invoiceController.getInvoices);
// PHASE 1: static paths before parametric ones so a future GET /:id can
// never shadow /stats (Express matches in registration order).
router.get('/stats', invoiceController.getInvoiceStats);
router.get('/vat-rate', invoiceController.getVatRate);
router.put('/vat-rate', restrictTo('Super Admin'), invoiceController.updateVatRate);
router.post('/', invoiceController.createInvoice);
router.put('/:id', invoiceController.updateInvoice);
router.patch('/:id/paid', invoiceController.markAsPaid);
router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;
