const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);

// Any listing-capable role may create a project on the fly from the
// property form (same roles as POST /properties); deletes stay admin-only.
router.post('/', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'), projectController.createProject);
router.put('/:id', restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'), projectController.updateProject);
router.delete('/:id', restrictTo('Super Admin', 'Admin', 'Office Manager'), projectController.deleteProject);

module.exports = router;
