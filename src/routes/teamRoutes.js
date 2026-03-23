const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
router.use(restrictTo('Super Admin', 'Admin', 'Office Manager', 'Broker'));

router.get('/', teamController.getTeams);
router.get('/stats', teamController.getTeamStats);
router.post('/', teamController.createTeam);
router.patch('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);
router.post('/members', teamController.addTeamMember);

module.exports = router;