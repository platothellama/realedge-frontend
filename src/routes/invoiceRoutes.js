const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', invoiceController.getInvoices);
router.post('/', invoiceController.createInvoice);
router.put('/:id', invoiceController.updateInvoice);
router.patch('/:id/paid', invoiceController.markAsPaid);
router.delete('/:id', invoiceController.deleteInvoice);
router.get('/stats', invoiceController.getInvoiceStats);

module.exports = router;
