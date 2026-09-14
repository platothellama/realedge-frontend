// PHASE 1 regression tests (production hardening).
// Run: npm test   (node built-in test runner, no extra deps, no DB needed
// except the black-box boot test which starts the server with a dead DB
// address and expects graceful 503/404/410 JSON responses).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawn } = require('node:child_process');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase1-test-secret';

const upload = require('../src/middleware/uploadMiddleware');

function filterResult(fieldname, originalname, mimetype) {
  return new Promise((resolve) => {
    upload.fileFilter({}, { fieldname, originalname, mimetype }, (err, ok) => {
      resolve({ accepted: !err && ok === true, error: err ? err.message : null });
    });
  });
}

describe('upload allowlist (AUDIT-009)', () => {
  it('accepts a valid property image', async () => {
    const r = await filterResult('image', 'villa.jpg', 'image/jpeg');
    assert.equal(r.accepted, true);
  });

  it('accepts a valid document', async () => {
    const r = await filterResult('file', 'contract.pdf', 'application/pdf');
    assert.equal(r.accepted, true);
  });

  it('rejects invalid extension', async () => {
    const r = await filterResult('file', 'payload.exe', 'application/octet-stream');
    assert.equal(r.accepted, false);
  });

  it('rejects spoofed MIME (jpg name, pdf mime on image field)', async () => {
    const r = await filterResult('image', 'photo.jpg', 'application/pdf');
    assert.equal(r.accepted, false);
  });

  it('rejects spoofed extension (pdf mime, exe name)', async () => {
    const r = await filterResult('file', 'evil.exe', 'application/pdf');
    assert.equal(r.accepted, false);
  });

  it('rejects dangerous web-executable types', async () => {
    for (const name of ['page.html', 'icon.svg', 'app.js', 'run.sh']) {
      const r = await filterResult('file', name, 'text/html');
      assert.equal(r.accepted, false, name);
    }
  });

  it('rejects substring-bypass names (old regex flaw: "doc" inside)', async () => {
    // Old flaw: /doc/ matched any string containing "doc".
    const r = await filterResult('file', 'malware.doc.exe', 'application/pdf');
    assert.equal(r.accepted, false);
  });
});

describe('filename sanitizer + magic bytes', () => {
  it('strips path traversal from display names', () => {
    const safe = upload.sanitizeDisplayName('../../etc/passwd.pdf');
    assert.ok(!safe.includes('/') && !safe.includes('..'));
  });

  it('strips control chars and caps length', () => {
    const safe = upload.sanitizeDisplayName('a\x00b\x1fc' + 'x'.repeat(500) + '.pdf');
    assert.ok(!/[\x00-\x1f]/.test(safe));
    assert.ok(safe.length <= 120);
  });

  it('accepts genuine JPEG/PNG/PDF magic', () => {
    assert.equal(upload.assertFileMagic(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'a.jpg'), true);
    assert.equal(
      upload.assertFileMagic(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'a.png'),
      true
    );
    assert.equal(upload.assertFileMagic(Buffer.from('%PDF-1.7'), 'a.pdf'), true);
  });

  it('rejects mismatched content (exe renamed to .jpg)', () => {
    assert.throws(() => upload.assertFileMagic(Buffer.from('MZ fake exe'), 'evil.jpg'), /does not match/);
  });

  it('passes through types without known signatures (docx)', () => {
    assert.equal(upload.assertFileMagic(Buffer.from('PK fake'), 'doc.docx'), true);
  });
});

describe('supabase storage helpers', () => {
  const svc = require('../src/services/supabaseStorageService');

  it('extracts keys only from own-bucket public URLs', () => {
    const bucket = svc.getBucket();
    assert.equal(
      svc.keyFromPublicUrl(`https://xyz.supabase.co/storage/v1/object/public/${bucket}/documents/2026-01-01/u.pdf`),
      'documents/2026-01-01/u.pdf'
    );
    assert.equal(svc.keyFromPublicUrl('/uploads/local.pdf'), null);
    assert.equal(svc.keyFromPublicUrl('https://evil.example/x.pdf'), null);
  });
});

describe('route registration (AUDIT-002 / AUDIT-008)', () => {
  it('admin router exposes no seeding operation', () => {
    const admin = require('../src/routes/adminRoutes');
    const paths = (admin.stack || [])
      .filter((l) => l.route)
      .map((l) => `${Object.keys(l.route.methods).join(',')}:${l.route.path}`);
    // The only permitted /seed-properties layer is the explicit 410 stub
    // (registered via router.all -> methods key "_all"). Any method-specific
    // (POST/GET/…) seed route is a regression.
    assert.ok(
      !paths.some((p) => /seed/i.test(p) && !p.startsWith('_all:')),
      `unexpected seed route: ${paths}`
    );
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'adminRoutes.js'), 'utf8');
    assert.ok(!/require\(['"]\.\.\/seeders\/propertySeeder['"]\)/.test(src), 'admin route must not import the seeder');
    assert.ok(!/seedProperties\(100\)/.test(src), 'admin route must not invoke seeding');
  });

  it('invoice + expense expose GET /stats', () => {
    for (const file of ['invoiceRoutes', 'expenseRoutes']) {
      const router = require(`../src/routes/${file}`);
      const getPaths = (router.stack || [])
        .filter((l) => l.route && l.route.methods.get)
        .map((l) => l.route.path);
      assert.ok(getPaths.includes('/stats'), `${file} missing GET /stats (got: ${getPaths})`);
    }
  });
});

describe('auth middleware (AUDIT-003)', () => {
  const jwt = require('jsonwebtoken');
  const { protect } = require('../src/middleware/authMiddleware');
  const User = require('../src/models/user');

  function mockRes() {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
  }

  it('rejects missing token with 401', async () => {
    const res = mockRes();
    await protect({ headers: {} }, res, () => { throw new Error('next() must not run'); });
    assert.equal(res.statusCode, 401);
  });

  it('rejects expired JWT with TOKEN_EXPIRED and no DB hit', async () => {
    const token = jwt.sign({ id: 'x' }, process.env.JWT_SECRET, { expiresIn: '-10s' });
    const res = mockRes();
    await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => {
      throw new Error('next() must not run');
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'TOKEN_EXPIRED');
  });

  it('rejects malformed JWT with INVALID_TOKEN', async () => {
    const res = mockRes();
    await protect({ headers: { authorization: 'Bearer not-a-token' } }, res, () => {
      throw new Error('next() must not run');
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'INVALID_TOKEN');
  });

  it('rejects inactive users with 401', async () => {
    const orig = User.findByPk;
    User.findByPk = async () => ({ id: 'u1', name: 'N', email: 'e', role: 'Agent', photo: null, active: false });
    try {
      const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const res = mockRes();
      await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => {
        throw new Error('next() must not run');
      });
      assert.equal(res.statusCode, 401);
      assert.match(res.body.message, /deactivat/i);
    } finally {
      User.findByPk = orig;
    }
  });

  it('lets active users through with a trimmed req.user', async () => {
    const orig = User.findByPk;
    User.findByPk = async () => ({
      id: 'u1', name: 'N', email: 'e', role: 'Agent', photo: null, active: true,
      password: 'must-not-leak', twoFactorSecret: 'must-not-leak'
    });
    try {
      const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const res = mockRes();
      let nextUser = null;
      const req = { headers: { authorization: `Bearer ${token}` } };
      await protect(req, res, () => { nextUser = req.user; });
      assert.ok(nextUser);
      assert.equal(nextUser.id, 'u1');
      assert.ok(!('password' in nextUser) && !('twoFactorSecret' in nextUser));
    } finally {
      User.findByPk = orig;
    }
  });
});

describe('production env fail-fast', () => {
  const { assertProdEnv } = require('../src/config/database');
  const saved = { ...process.env };

  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in saved)) delete process.env[k];
    }
    Object.assign(process.env, saved);
  });

  it('passes outside production even with nothing set', () => {
    process.env.NODE_ENV = 'development';
    assert.doesNotThrow(() => assertProdEnv());
  });

  it('throws in production when secrets are missing (names only)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_DATABASE;
    delete process.env.DB_NAME;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    assert.throws(() => assertProdEnv(), /JWT_SECRET/);
  });
});

// Black-box boot: real server, dead DB address, production mode.
// Proves: fail-fast passes with vars present, /health degrades without
// leaking internals, unknown /api 404s as JSON, seed endpoint is gone (410),
// oversized JSON is rejected (413).
describe('server boot + API hygiene (black box)', { timeout: 90000 }, () => {
  let child = null;
  let base = null;

  before(async () => {
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '0', // unused: index binds process.env.PORT || 8000; override below
      JWT_SECRET: 'phase1-boot-test',
      JWT_EXPIRE: '1h',
      DB_HOST: '127.0.0.1',
      DB_PORT: '1', // refused fast: no 60s hang
      DB_DATABASE: 'phase1test',
      DB_USERNAME: 'u',
      DB_PASSWORD: 'p',
      DB_SSL: 'false',
      FRONTEND_URL: ''
    };
    delete env.DATABASE_URL;
    child = spawn(process.execPath, ['src/index.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...env, PORT: '8123' }
    });
    base = 'http://127.0.0.1:8123';
    // Wait for the listen line (boot is fail-soft on DB by design).
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server did not boot in time')), 60000);
      child.stdout.on('data', (d) => {
        if (d.toString().includes('Server is flying')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.stderr.on('data', () => {});
      child.on('error', reject);
      child.on('exit', (code) => reject(new Error(`server exited early with ${code}`)));
    });
  });

  after(() => {
    if (child) child.kill();
  });

  it('health degrades to 503 JSON without leaking internals', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.db, 'down');
    assert.ok(!JSON.stringify(body).match(/127\.0\.0\.1|phase1test|Error|ECONN/i));
  });

  it('unknown API routes 404 as JSON', async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).status, 'fail');
  });

  // PHASE 2 (D27): seed endpoint fully REMOVED (was 410 stub in Phase 1).
  // Either 404 (removed) or legacy 410 counts as gone — seeding must never run.
  it('seed endpoint is gone (404/410) for anon and authed callers', async () => {
    for (const headers of [{}, { Authorization: 'Bearer fake' }]) {
      const res = await fetch(`${base}/api/admin/seed-properties`, { method: 'POST', headers });
      assert.ok(res.status === 404 || res.status === 410, `expected 404/410, got ${res.status} ${JSON.stringify(headers)}`);
    }
  });

  it('oversized JSON is rejected with 413', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x'.repeat(300 * 1024) })
    });
    assert.equal(res.status, 413);
  });
});
