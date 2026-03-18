const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', announcementController.getAnnouncements);
router.post('/', announcementController.createAnnouncement);
router.put('/:id', announcementController.updateAnnouncement);
router.delete('/:id', announcementController.deleteAnnouncement);
router.patch('/:id/pin', announcementController.pinAnnouncement);

module.exports = router;
