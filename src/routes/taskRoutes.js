const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

// QA 2026-09-18: task administration is Admin-only (mirrors the frontend
// route gate). Agents keep read access to their own tasks via /my-tasks.
router.get('/my-tasks', taskController.getMyTasks);
router.use(restrictTo('Super Admin', 'Admin'));
router.get('/', taskController.getTasks);
router.get('/stats', taskController.getTaskStats);
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
