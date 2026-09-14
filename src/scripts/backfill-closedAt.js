// PHASE 2 (D9b) — one-shot backfill: closedAt from updatedAt for Closed deals.
// Policy D26=A (freeze): financial amounts are NEVER backfilled, only the
// non-financial closedAt metadata. Run explicitly: node src/scripts/backfill-closedAt.js
// Requires DB env. Dry-run by default; pass --apply to write.
const { sequelize } = require('../config/database');

async function main() {
  const apply = process.argv.includes('--apply');
  const { Deal } = require('../models/associations');
  await sequelize.authenticate();
  const rows = await Deal.findAll({ where: { dealStage: 'Closed', closedAt: null } });
  console.log(`Closed deals missing closedAt: ${rows.length}`);
  if (!apply) {
    console.log('Dry-run. Re-run with --apply to set closedAt = updatedAt.');
    await sequelize.close();
    return;
  }
  let updated = 0;
  for (const d of rows) {
    await d.update({ closedAt: d.updatedAt || new Date() });
    updated += 1;
  }
  console.log(`Backfilled closedAt on ${updated} deal(s).`);
  await sequelize.close();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
