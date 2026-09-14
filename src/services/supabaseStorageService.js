const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'realedge-uploads';

let client = null;
function getClient() {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase storage not configured: set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_KEY)');
  }
  client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}

function buildKey(folder, originalname) {
  const ext = path.extname(originalname || '').toLowerCase() || '';
  const day = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${folder}/${day}/${rand}${ext}`;
}

async function uploadBuffer(buffer, originalname, mimetype, folder = 'properties') {
  const supabase = getClient();
  const key = buildKey(folder, originalname);
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: mimetype || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, path: key };
}

function isCloudUrl(fileUrl) {
  return typeof fileUrl === 'string' && /^https?:\/\//i.test(fileUrl);
}

async function fetchBufferForHash(fileUrl) {
  // Best-effort re-hash for tamper checks; returns null when unreachable.
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

module.exports = { uploadBuffer, isCloudUrl, fetchBufferForHash, getBucket: () => BUCKET };
