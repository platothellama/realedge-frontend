const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
router.use(restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'));

router.get('/', groupController.getAllGroups);
router.get('/stats', groupController.getGroupStats);
router.get('/:id/members', groupController.getGroupMembers);
router.post('/', groupController.createGroup);
router.patch('/:id', groupController.updateGroup);
router.put('/:id', groupController.updateGroup);
router.delete('/:id', groupController.deleteGroup);
router.post('/members', groupController.addGroupMember);

router.post('/:id/add-user', groupController.addUserToGroup);
router.post('/:id/remove-user', groupController.removeUserFromGroup);
router.put('/:id/roles', groupController.updateGroupRoles);

module.exports = router;
