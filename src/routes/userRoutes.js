const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All routes here should be protected and restricted to Super Admin or Admin
router.use(protect);
router.use(restrictTo('Super Admin', 'Admin', 'Office Manager'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUser);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.patch('/:id/toggle-status', userController.toggleUserStatus);

module.exports = router;
