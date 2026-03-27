const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
router.use(restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'));

router.get('/', groupController.getAllGroups);
router.get('/stats', groupController.getGroupStats);
router.post('/', groupController.createGroup);
router.patch('/:id', groupController.updateGroup);
router.delete('/:id', groupController.deleteGroup);
router.post('/members', groupController.addGroupMember);

module.exports = router;
