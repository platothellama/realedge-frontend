const multer = require('multer');
const path = require('path');

// Memory storage: files stay in req.file.buffer and are uploaded
// to Supabase Storage (free persistent object storage).
// Local disk (../../uploads) is ephemeral on Render/Railway and gets wiped.
const storage = multer.memoryStorage();

// PHASE 1 (production hardening): exact allowlists — no substring regex.
// Extension is matched exactly (lowercased, no dot); MIME must be the exact
// official type for that extension. Anything else (html/svg/xml/js/exe/…)
// is rejected, which also blocks script execution via uploaded files.
const IMAGE_EXTS = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif']);
const DOCUMENT_EXTS = new Set([
  'jpeg', 'jpg', 'png', 'webp', 'gif',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'
]);

// Official MIME per extension. Office Open XML + legacy + text/image types.
const MIME_BY_EXT = {
  jpeg: ['image/jpeg'],
  jpg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
  csv: ['text/csv', 'application/vnd.ms-excel']
};

const ERROR_HINT = 'Images: jpeg, jpg, png, webp, gif. Documents: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv.';

// Magic-byte signatures (content sniffing) for common binary types.
// Used by assertFileMagic() in controllers AFTER multer accepts the file,
// because multer's fileFilter cannot see file contents.
const MAGIC = [
  { exts: ['jpg', 'jpeg'], test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { exts: ['png'], test: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { exts: ['gif'], test: (b) => b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { exts: ['webp'], test: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { exts: ['pdf'], test: (b) => b.length >= 5 && b.toString('ascii', 0, 5) === '%PDF-' }
];

function getExt(originalname) {
  return path.extname(originalname || '').toLowerCase().slice(1);
}

// Throws on mismatch; returns the safe display name otherwise.
// Display names are never used as storage keys (storage uses UUID keys in
// supabaseStorageService.buildKey) — this only sanitizes what is shown/stored
// as DocumentVersion.fileName: strips directories, control chars, and caps length.
function sanitizeDisplayName(originalname) {
  const base = path.basename(originalname || 'file').replace(/[\x00-\x1f\x7f]/g, '');
  const clean = base.replace(/[^a-zA-Z0-9._\- ()]/g, '_').slice(0, 120) || 'file';
  return clean;
}

function assertFileMagic(buffer, originalname) {
  const ext = getExt(originalname);
  const rule = MAGIC.find((r) => r.exts.includes(ext));
  if (!rule) return true; // No signature known (office docs/txt/csv): allow, ext+MIME already checked.
  if (!buffer || !rule.test(buffer)) {
    const err = new Error(`File content does not match extension .${ext}.`);
    err.status = 400;
    throw err;
  }
  return true;
}

const fileFilter = (req, file, cb) => {
  const ext = getExt(file.originalname);
  const mime = (file.mimetype || '').toLowerCase().split(';')[0].trim();

  if (file.fieldname === 'file') {
    if (DOCUMENT_EXTS.has(ext) && (MIME_BY_EXT[ext] || []).includes(mime)) {
      return cb(null, true);
    }
  } else if (file.fieldname === 'image') {
    if (IMAGE_EXTS.has(ext) && (MIME_BY_EXT[ext] || []).includes(mime)) {
      return cb(null, true);
    }
  }

  cb(new Error(`File type not allowed: ${ext || '(none)'}. ${ERROR_HINT}`));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: fileFilter
});

upload.fileFilter = fileFilter;
upload.sanitizeDisplayName = sanitizeDisplayName;
upload.assertFileMagic = assertFileMagic;

module.exports = upload;
