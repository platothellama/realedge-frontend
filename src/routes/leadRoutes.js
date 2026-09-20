const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', leadController.getAllLeads);
router.get('/:id', leadController.getLeadById);
router.post('/', leadController.createLead);
// QA 2026-09-18: static path before '/:id' routes (same shadowing class as
// the public-sign routes). Validated, capped, transactional bulk import.
router.post('/bulk', leadController.bulkCreateLeads);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);
router.post('/:id/convert-to-deal', leadController.convertToDeal);
router.post('/:id/properties', leadController.addLeadProperty);
router.delete('/:id/properties/:propertyId', leadController.removeLeadProperty);

module.exports = router;
