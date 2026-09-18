const express = require('express');
const router = express.Router();
const transactionWorkflowController = require('../controllers/transactionWorkflowController');
const auditLogController = require('../controllers/auditLogController');
const groupController = require('../controllers/groupController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

// Transaction Workflows
router.get('/workflows', transactionWorkflowController.getWorkflows);
router.post('/workflows', transactionWorkflowController.createWorkflow);
router.patch('/workflows/:id/stage', transactionWorkflowController.updateWorkflowStage);
router.get('/workflows/stats', transactionWorkflowController.getWorkflowStats);

// Audit Logs
router.get('/audit', auditLogController.getAuditLogs);
// QA hardening 2026-09-18: clients must not forge audit rows via POST.
router.post('/audit', restrictTo('Super Admin', 'Admin'), auditLogController.createAuditLog);
router.get('/audit/stats', auditLogController.getAuditStats);

// Groups
router.get('/groups', groupController.getAllGroups);
router.post('/groups', groupController.createGroup);
router.put('/groups/:id', groupController.updateGroup);
router.delete('/groups/:id', groupController.deleteGroup);
router.post('/groups/members', groupController.addGroupMember);
router.get('/groups/stats', groupController.getGroupStats);

module.exports = router;
