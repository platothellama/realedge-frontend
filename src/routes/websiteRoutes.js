const express = require('express');
const router = express.Router();
const websiteController = require('../controllers/websiteController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Public routes
router.get('/public/:slug', websiteController.getWebsiteBySlug);

// Protected routes
router.use(protect);
// QA 2026-09-18: builder/editor UI is Super-Admin/Admin-only in the
// frontend; the API previously let any role (incl. Client) create, edit,
// publish and export websites.
router.use(restrictTo('Super Admin', 'Admin'));

// Websites
router.get('/', websiteController.getWebsites);
router.get('/:id', websiteController.getWebsite);
router.post('/', websiteController.createWebsite);
router.put('/:id', websiteController.updateWebsite);
router.delete('/:id', websiteController.deleteWebsite);

// Website Properties
router.get('/:websiteId/properties', websiteController.getWebsiteProperties);
router.post('/:websiteId/properties', websiteController.linkProperties);

// AI Generation
router.post('/generate', websiteController.generateAWebsite);
router.get('/templates/layouts', websiteController.getLayoutTemplates);

// Export
router.post('/export', websiteController.exportWebsite);

// Pages
router.get('/:websiteId/pages', websiteController.getPages);
router.get('/pages/:pageId', websiteController.getPage);
router.post('/:websiteId/pages', websiteController.createPage);
router.put('/pages/:pageId', websiteController.updatePage);
router.delete('/pages/:pageId', websiteController.deletePage);

// Sections
router.post('/pages/:pageId/sections', websiteController.createSection);
router.put('/sections/:sectionId', websiteController.updateSection);
router.delete('/sections/:sectionId', websiteController.deleteSection);
router.post('/sections/reorder', websiteController.reorderSections);

// Component Templates
router.get('/components/templates', websiteController.getComponentTemplates);
router.post('/components/templates', websiteController.createComponentTemplate);

// Data Sources
router.get('/data-sources', websiteController.getDataSources);

module.exports = router;
