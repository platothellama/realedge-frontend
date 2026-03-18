const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

router.get('/open/:trackingId', async (req, res) => {
  const { trackingId } = req.params;
  
  await emailService.handleOpenTracking(trackingId);
  
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(pixel);
});

router.get('/click/:trackingId', async (req, res) => {
  const { trackingId } = req.params;
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  await emailService.handleClickTracking(trackingId, url);
  
  res.redirect(url);
});

module.exports = router;
