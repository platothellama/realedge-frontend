// PHASE 3 regression tests (full-application audit 2026-09-14).
// DB-free: pure logic + source tripwires + stubbed-model controller test.
// Run: npm test  (node built-in test runner, no extra deps).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
// Function-scoped slice: from a marker to the next same-kind definition.
const block = (src, start, nextRe) => {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `marker not found: ${start}`);
  const rest = src.slice(i + start.length);
  const j = rest.search(nextRe);
  return j < 0 ? rest : rest.slice(0, j);
};

// ---- BUG-001: boot migration must cover every Phase-2 model column ----
// (A fresh boot on a pre-Phase-2 DB crashed ALL auth with
// "Unknown column 'passwordChangedAt'".)
describe('bootMigrate covers Phase-2 schema drift (BUG-001)', () => {
  const boot = require('../src/seeders/bootMigrate');

  it('still exports a callable with its column lists', () => {
    assert.equal(typeof boot, 'function');
    assert.ok(Array.isArray(boot.REQUIRED_COLUMNS));
    assert.ok(Array.isArray(boot.COLUMN_DEFAULTS));
  });

  it('adds the three previously-missing columns', () => {
    const keys = boot.REQUIRED_COLUMNS.map(([t, c]) => `${t}.${c}`);
    for (const k of ['Users.passwordChangedAt', 'Payments.rateDate', 'DealCommissions.reserveAmount']) {
      assert.ok(keys.includes(k), `REQUIRED_COLUMNS missing ${k}`);
    }
  });

  it('corrects the three stale fail-open defaults (rows untouched)', () => {
    const map = new Map(boot.COLUMN_DEFAULTS.map(([t, c, d]) => [`${t}.${c}`, d]));
    assert.equal(map.get('Documents.visibility'), "'internal'"); // was 'shareable'
    assert.equal(map.get('Documents.retentionPeriodDays'), '3650'); // was 2555
    assert.equal(map.get('Payments.status'), "'Pending'"); // was 'Confirmed'
  });

  it('only converts Transactions.currency when all values are already valid', () => {
    assert.equal(boot.shouldConvertCurrency(['USD', 'LBP', null]), true);
    assert.equal(boot.shouldConvertCurrency(['USD']), true);
    assert.equal(boot.shouldConvertCurrency([]), true);
    assert.equal(boot.shouldConvertCurrency(['USD', 'EUR']), false);
    assert.equal(boot.shouldConvertCurrency(['USD', '']), false);
    assert.equal(boot.shouldConvertCurrency(null), false);
    assert.equal(boot.shouldConvertCurrency('USD'), false);
  });

  it('every REQUIRED_COLUMNS entry matches a real model attribute', () => {
    const modelFor = {
      Expenses: 'expense', Transactions: 'transaction',
      TransactionWorkflows: 'transactionWorkflow', Payments: 'payment',
      PaymentPlans: 'paymentPlan', Users: 'user', DealCommissions: 'dealCommission',
      Properties: 'property',
    };
    for (const [table, column] of boot.REQUIRED_COLUMNS) {
      let attrs;
      if (table === 'Websites') {
        // models/website.js exports a bundle; createdByUserId lives on Website.
        attrs = require('../src/models/website.js').Website.rawAttributes;
      } else {
        attrs = require(`../src/models/${modelFor[table]}.js`).rawAttributes;
      }
      assert.ok(attrs[column], `${table}.${column} is not a model attribute`);
    }
  });
});

// ---- BUG-002: /me must not leak credentials ----
describe('getMe strips sensitive fields (BUG-002)', () => {
  it('excludes password, 2FA secret and reset material', async () => {
    const User = require('../src/models/user');
    const orig = User.findByPk;
    let captured = null;
    User.findByPk = async (id, opts) => { captured = opts; return { id }; };
    try {
      const ctrl = require('../src/controllers/authController');
      let body = null;
      await ctrl.getMe({ user: { id: 'u1' } }, { status: () => ({ json: (b) => { body = b; } }) });
      const excluded = captured.attributes.exclude;
      for (const f of ['password', 'twoFactorSecret', 'passwordResetToken', 'passwordResetExpires']) {
        assert.ok(excluded.includes(f), `getMe must exclude ${f}`);
      }
      assert.ok(body && body.status === 'success');
    } finally {
      User.findByPk = orig;
    }
  });

  it('forgot-password gates the raw reset token to non-production', () => {
    const src = read('controllers/authController.js');
    assert.ok(src.includes("NODE_ENV === 'production'"), 'forgot-password must branch on NODE_ENV');
    // Production branch returns a generic message; the raw token must only
    // appear in the dev branch below it.
    const i = src.indexOf("NODE_ENV === 'production'");
    const prodRet = src.indexOf('return res.status(200).json', i);
    assert.ok(prodRet > i, 'production branch must return a response');
    const prodBlock = src.slice(prodRet, prodRet + 250);
    assert.ok(!prodBlock.includes('resetToken'), 'production response must not contain the token');
    assert.ok(src.includes('token: resetToken'), 'dev convenience response must be preserved');
  });
});

// ---- BUG-003: deletes must not 500 on FK rows or leak SQL internals ----
describe('delete guards (BUG-003)', () => {
  it('deal delete removes derived commissions in-transaction first', () => {
    const src = read('controllers/dealController.js');
    const del = block(src, 'exports.deleteDeal', /\nexports\./);
    assert.ok(del.includes('DealCommission.destroy'), 'must clear DealCommissions before destroying the deal');
    assert.ok(del.includes('transaction'), 'must be transactional');
    assert.ok(!del.includes('error: error.message'), 'must not echo raw SQL errors to the client');
  });

  it('property delete refuses linked deals with 409', () => {
    const src = read('controllers/propertyController.js');
    const del = block(src, 'exports.deleteProperty', /\nexports\./);
    assert.ok(del.includes('409'), 'must answer 409 when deals reference the property');
    assert.ok(!del.includes('error: error.message'), 'must not echo raw SQL errors to the client');
  });

  it('seller delete refuses linked properties with 409', () => {
    const src = read('routes/sellerRoutes.js');
    const del = block(src, "router.delete('/:id'", /\nrouter\./);
    assert.ok(del.includes('409'), 'must answer 409 when properties reference the seller');
    assert.ok(!del.includes('error: error.message'), 'must not echo raw SQL errors to the client');
  });
});

// ---- Commission money math on the REAL service (no DB) ----
describe('commissionService.calculatePropertyCommission edges', () => {
  const svc = require('../src/services/commissionService');

  it('fixed amount passes through untouched', () => {
    assert.equal(svc.calculatePropertyCommission({ commissionType: 'fixed', commissionValue: 5000 }, 180000), 5000);
  });
  it('percentage: 180000 x 2.5% = 4500', () => {
    assert.equal(svc.calculatePropertyCommission({ commissionType: 'percentage', commissionValue: 2.5 }, 180000), 4500);
  });
  it('0% and 100% boundaries', () => {
    assert.equal(svc.calculatePropertyCommission({ commissionType: 'percentage', commissionValue: 0 }, 250000), 0);
    assert.equal(svc.calculatePropertyCommission({ commissionType: 'percentage', commissionValue: 100 }, 1000000000), 1000000000);
  });
  it('null property yields 0, never NaN', () => {
    assert.equal(svc.calculatePropertyCommission(null, 100000), 0);
    const r = svc.calculatePropertyCommission({ commissionType: 'percentage' }, 100000);
    assert.ok(Number.isFinite(r));
  });
});
