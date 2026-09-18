const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', announcementController.getAnnouncements);
// QA hardening 2026-09-18: the announcements page is Super Admin/Admin-only;
// enforce the same server-side (previously any role could post/pin/delete
// company-wide announcements via direct API calls).
const announceAdmin = restrictTo('Super Admin', 'Admin');
router.post('/', announceAdmin, announcementController.createAnnouncement);
router.put('/:id', announceAdmin, announcementController.updateAnnouncement);
router.delete('/:id', announceAdmin, announcementController.deleteAnnouncement);
router.patch('/:id/pin', announceAdmin, announcementController.pinAnnouncement);

module.exports = router;
