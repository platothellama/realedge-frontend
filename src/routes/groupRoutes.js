const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', groupController.getAllGroups);
router.post('/', restrictTo('Super Admin', 'Admin', 'Office Manager'), groupController.createGroup);
router.put('/:id', restrictTo('Super Admin', 'Admin', 'Office Manager'), groupController.updateGroup);
router.delete('/:id', restrictTo('Super Admin', 'Admin', 'Office Manager'), groupController.deleteGroup);

module.exports = router;
