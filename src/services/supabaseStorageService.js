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

// Extract the storage key from a public URL produced by uploadBuffer().
// Returns null for legacy local paths or foreign URLs (never delete those).
function keyFromPublicUrl(fileUrl) {
  if (!isCloudUrl(fileUrl)) return null;
  const marker = `/${BUCKET}/`;
  const i = fileUrl.indexOf(marker);
  if (i === -1) return null;
  return fileUrl.slice(i + marker.length).split('?')[0] || null;
}
// Best-effort delete of a storage object. Never throws: callers deleting a
// DB record must not fail just because the object is already gone or the
// key lacks delete permission; the failure is logged server-side.
async function deleteObject(key) {
  try {
    if (!key) return false;
    const supabase = getClient();
    const { error } = await supabase.storage.from(BUCKET).remove([key]);
    if (error) {
      console.error(`Supabase delete failed for ${key}: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Supabase delete failed: ${err.message}`);
    return false;
  }
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

// PHASE 2 (D22): private docs via short-lived signed URLs (approved 24h
// expiry). Photos stay public. During the transition, existing public URLs
// keep resolving (dual-read); new confidential downloads use this.
async function createSignedUrl(key, expiresInSeconds = 86400) {
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, expiresInSeconds);
  if (error) {
    throw new Error(`Signed URL failed: ${error.message}`);
  }
  return data.signedUrl;
}

module.exports = { uploadBuffer, deleteObject, keyFromPublicUrl, isCloudUrl, fetchBufferForHash, getBucket: () => BUCKET, createSignedUrl, SIGNED_URL_EXPIRY_SECONDS: 86400 };
