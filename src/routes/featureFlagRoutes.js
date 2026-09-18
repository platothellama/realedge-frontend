const express = require('express');
const router = express.Router();
const { getAllFeatureFlags, createFeatureFlag, updateFeatureFlag, toggleFeatureFlag, deleteFeatureFlag, getEnabledFeatures } = require('../controllers/featureFlagController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/enabled', getEnabledFeatures);
router.get('/', protect, getAllFeatureFlags);
// QA hardening 2026-09-18: flag writes gated to admins (previously any agent could toggle).
const flagAdmin = restrictTo('Super Admin', 'Admin');
router.post('/', protect, flagAdmin, createFeatureFlag);
router.put('/:id', protect, flagAdmin, updateFeatureFlag);
router.patch('/:id/toggle', protect, flagAdmin, toggleFeatureFlag);
router.delete('/:id', protect, flagAdmin, deleteFeatureFlag);

module.exports = router;