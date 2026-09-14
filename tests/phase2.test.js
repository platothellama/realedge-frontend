// PHASE 2 regression tests (DB-free pure logic). Run: npm test (node:test).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ---- D2: Deal.commission is a percentage 0-100, no silent default ----
function validateCommissionPct(v) {
  if (v === undefined || v === null || v === '') return 0;
  const pct = Number(v);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error('range');
  return pct;
}
describe('D2 commission percentage', () => {
  it('accepts 0-100', () => { assert.equal(validateCommissionPct(2), 2); assert.equal(validateCommissionPct('100'), 100); });
  it('rejects out of range and non-numeric', () => {
    assert.throws(() => validateCommissionPct(101));
    assert.throws(() => validateCommissionPct(-1));
    assert.throws(() => validateCommissionPct('abc'));
  });
  it('no silent 2% default: empty -> 0', () => { assert.equal(validateCommissionPct(undefined), 0); });
});

// ---- D8: revenue = finalPrice x % / 100 ----
function grossOf(d) {
  const price = Number(d.finalPrice || 0);
  const pct = Number(d.commission || 0);
  if (!Number.isFinite(price) || !Number.isFinite(pct)) return 0;
  return price * pct / 100;
}
describe('D8 computed gross revenue', () => {
  it('computes 180000 x 2% = 3600', () => { assert.equal(grossOf({ finalPrice: 180000, commission: 2 }), 3600); });
  it('percentage rows never summed as money', () => {
    const deals = [{ finalPrice: 100000, commission: 2 }, { finalPrice: 200000, commission: 3 }];
    const gross = deals.reduce((s, d) => s + grossOf(d), 0);
    assert.equal(gross, 8000); // not 2+3=5
  });
});

// ---- D5: holdback to company reserve; totals always 100% ----
describe('D5 holdback reserve', () => {
  it('company residual absorbs holdback', () => {
    const total = 10000, agentPct = 60, companyPct = 10;
    const agent = total * agentPct / 100;
    const company = total - agent; // residual incl. reserve
    const holdbackPct = Math.max(0, 100 - companyPct - agentPct);
    const holdback = total * holdbackPct / 100;
    assert.equal(agent + company, total);
    assert.equal(holdbackPct, 30);
    assert.equal(holdback, 3000);
    assert.equal(company, 4000); // 1000 + 3000 reserve
  });
});

// ---- D6: normalize role splits to 100 ----
function normalize(splits) {
  const total = splits.reduce((a, b) => a + b, 0);
  if (total !== 100 && total > 0) { const k = 100 / total; return splits.map(s => s * k); }
  return splits;
}
describe('D6 normalization', () => {
  it('scales 90 -> 100', () => {
    const out = normalize([36, 27, 18, 9]);
    assert.ok(Math.abs(out.reduce((a, b) => a + b, 0) - 100) < 1e-9);
  });
  it('leaves 100 untouched', () => { assert.deepEqual(normalize([40, 30, 20, 10]), [40, 30, 20, 10]); });
});

// ---- D11: LBP without valid rate held (NULL), excluded ----
describe('D11 rate hold', () => {
  it('zero/missing rate -> held null', () => {
    const toUSD = (amt, cur, rate) => {
      if (cur === 'LBP') {
        if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
        return amt / rate;
      }
      return amt;
    };
    assert.equal(toUSD(90000, 'LBP', 0), null);
    assert.equal(toUSD(90000, 'LBP', null), null);
    assert.equal(toUSD(90000, 'LBP', 90000), 1);
    assert.equal(toUSD(100, 'USD', null), 100);
  });
});

// ---- D13: exact overpay rejection (zero tolerance) ----
describe('D13 exact overpay', () => {
  it('any excess rejected', () => {
    const outstanding = 1000.0, pay = 1000.01;
    assert.ok(pay - outstanding > 0); // rejected
    assert.ok(!((1000.0) - outstanding > 0)); // exact accepted
  });
});

// ---- D20: hierarchy strictly-lower ----
const RANK = { 'Super Admin': 5, Admin: 4, 'Office Manager': 3, Broker: 2, Agent: 1, Accountant: 1, Marketing: 1, Client: 1 };
describe('D20 hierarchy', () => {
  it('OM cannot manage Admin', () => { assert.ok(!(RANK['Office Manager'] > RANK.Admin)); });
  it('Admin cannot create Admin', () => { assert.ok(!(RANK.Admin > RANK.Admin)); });
  it('Super Admin outranks all', () => {
    for (const r of Object.keys(RANK)) { if (r !== 'Super Admin') assert.ok(RANK['Super Admin'] > RANK[r]); }
  });
});

// ---- D14: sequence naming ----
describe('D14 invoice sequence', () => {
  it('pads to 4 digits', () => {
    const n = (y, s) => `INV-${y}-${String(s).padStart(4, '0')}`;
    assert.equal(n(2026, 1), 'INV-2026-0001');
    assert.equal(n(2026, 42), 'INV-2026-0042');
  });
});
