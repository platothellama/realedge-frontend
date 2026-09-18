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
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // QA hardening 2026-09-18: prevent open-redirect abuse (phishing via
  // /api/track/click?url=https://evil.example). Only http(s) URLs with a
  // hostname are followed; anything else is rejected before redirecting.
  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid url parameter' });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return res.status(400).json({ error: 'Invalid url parameter' });
  }
  // Never redirect back to our own tracking endpoint (loop / abuse).
  if (target.pathname.startsWith('/api/track/')) {
    return res.status(400).json({ error: 'Invalid url parameter' });
  }

  await emailService.handleClickTracking(trackingId, target.toString());

  res.redirect(target.toString());
});

module.exports = router;
