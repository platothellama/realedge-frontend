const express = require('express');
const router = express.Router();
const visitController = require('../controllers/visitController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', visitController.getAllVisits);
router.get('/:id', visitController.getVisitById);
router.post('/', visitController.createVisit);
router.patch('/:id', visitController.updateVisit);
router.delete('/:id', visitController.deleteVisit);

module.exports = router;
