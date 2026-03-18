const express = require('express');
const router = express.Router();
const transactionWorkflowController = require('../controllers/transactionWorkflowController');
const auditLogController = require('../controllers/auditLogController');
const teamController = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Transaction Workflows
router.get('/workflows', transactionWorkflowController.getWorkflows);
router.post('/workflows', transactionWorkflowController.createWorkflow);
router.patch('/workflows/:id/stage', transactionWorkflowController.updateWorkflowStage);
router.get('/workflows/stats', transactionWorkflowController.getWorkflowStats);

// Audit Logs
router.get('/audit', auditLogController.getAuditLogs);
router.post('/audit', auditLogController.createAuditLog);
router.get('/audit/stats', auditLogController.getAuditStats);

// Teams
router.get('/teams', teamController.getTeams);
router.post('/teams', teamController.createTeam);
router.put('/teams/:id', teamController.updateTeam);
router.delete('/teams/:id', teamController.deleteTeam);
router.post('/teams/members', teamController.addTeamMember);
router.get('/teams/stats', teamController.getTeamStats);

module.exports = router;
