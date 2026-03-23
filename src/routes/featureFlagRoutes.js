const express = require('express');
const router = express.Router();
const { getAllFeatureFlags, createFeatureFlag, updateFeatureFlag, toggleFeatureFlag, deleteFeatureFlag, getEnabledFeatures } = require('../controllers/featureFlagController');
const { protect } = require('../middleware/authMiddleware');

router.get('/enabled', getEnabledFeatures);
router.get('/', protect, getAllFeatureFlags);
router.post('/', protect, createFeatureFlag);
router.put('/:id', protect, updateFeatureFlag);
router.patch('/:id/toggle', protect, toggleFeatureFlag);
router.delete('/:id', protect, deleteFeatureFlag);

module.exports = router;