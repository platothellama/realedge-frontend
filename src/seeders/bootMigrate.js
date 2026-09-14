/**
 * Boot-time schema safety net.
 *
 * 1. `sequelize.sync()` (no force/alter) creates any MISSING tables only.
 *    It never drops or modifies existing tables, so it is safe to run on
 *    every boot in development and production.
 * 2. `ensureColumns()` adds columns that models/associations expect but
 *    that older databases predate (e.g. Expenses.createdByUserId,
 *    Websites.createdByUserId, Users.passwordChangedAt). Each column is
 *    added only when INFORMATION_SCHEMA confirms it is absent.
 * 3. `ensureDefaults()` corrects stale column DEFAULTS on pre-existing
 *    tables (Phase-2 decisions D12/D21/D25). Only the default changes —
 *    existing ROWS are never rewritten (D26 freeze).
 * 4. `ensureNullability()` widens `Payments.amountInUSD` to NULL (D11 LBP
 *    hold) only when it is currently NOT NULL. No values are touched.
 * 5. `ensureTransactionCurrencyEnum()` converts `Transactions.currency`
 *    varchar → ENUM('USD','LBP') only when every existing value is already
 *    USD/LBP/NULL; otherwise it skips with a warning (manual mapping per
 *    PHASE_2_MANUAL_MIGRATION.sql step 5).
 */
const { sequelize } = require('../config/database');

// [table, column, definition]
const REQUIRED_COLUMNS = [
  ['Expenses', 'createdByUserId', 'CHAR(36) NULL'],
  ['Websites', 'createdByUserId', 'CHAR(36) NULL'],
  ['Transactions', 'userId', 'CHAR(36) NULL'],
  ['TransactionWorkflows', 'clientId', 'CHAR(36) NULL'],
  ['Payments', 'recordedByUserId', 'CHAR(36) NULL'],
  ['PaymentPlans', 'createdByUserId', 'CHAR(36) NULL'],
  // AUDIT-2026-09: Phase-2 model columns missing on pre-Phase-2 databases.
  // Absence crashes auth on EVERY request (Users.passwordChangedAt is in
  // protect()'s attribute list) and breaks payments/commissions reads.
  ['Users', 'passwordChangedAt', 'DATETIME NULL'],
  ['Payments', 'rateDate', 'DATETIME NULL'],
  ['DealCommissions', 'reserveAmount', 'DECIMAL(15,2) NULL DEFAULT 0'],
];

// [table, column, default literal] — future-row defaults only, no rewrites.
const COLUMN_DEFAULTS = [
  // D25: private-by-default (was fail-open 'shareable').
  ['Documents', 'visibility', "'internal'"],
  // D21: 10-year retention (was 2555 days).
  ['Documents', 'retentionPeriodDays', '3650'],
  // D12: safe default Pending (was fail-open Confirmed).
  ['Payments', 'status', "'Pending'"],
];

/**
 * Pure decision helper (unit-testable): only convert the currency column
 * when every distinct existing value is already valid. Any unexpected
 * value (or a read failure upstream) must skip the conversion.
 */
const shouldConvertCurrency = (distinctValues) => {
  if (!Array.isArray(distinctValues)) return false;
  const allowed = new Set(['USD', 'LBP', null]);
  return distinctValues.every((v) => allowed.has(v));
};

const columnExists = async (queryInterface, table, column) => {
  try {
    const [rows] = await sequelize.query(
      'SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      { replacements: [table, column] }
    );
    return Number(rows[0].cnt) > 0;
  } catch (_) {
    return true; // fail-open: never block boot on a metadata check
  }
};

const ensureColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  for (const [table, column, definition] of REQUIRED_COLUMNS) {
    try {
      const tables = await queryInterface.showAllTables();
      if (!tables.includes(table)) continue; // sync() will create the table
      if (await columnExists(queryInterface, table, column)) continue;
      await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`🔧 Migration: added ${table}.${column}`);
    } catch (err) {
      console.log(`⚠️  Migration skipped for ${table}.${column}: ${err.message}`);
    }
  }
};

const ensureDefaults = async () => {
  for (const [table, column, defLiteral] of COLUMN_DEFAULTS) {
    try {
      const queryInterface = sequelize.getQueryInterface();
      const tables = await queryInterface.showAllTables();
      if (!tables.includes(table)) continue;
      if (!(await columnExists(queryInterface, table, column))) continue;
      // ALTER COLUMN ... SET DEFAULT touches metadata only (no row rewrite).
      await sequelize.query(
        `ALTER TABLE \`${table}\` ALTER COLUMN \`${column}\` SET DEFAULT ${defLiteral}`
      );
      console.log(`🔧 Migration: default ${table}.${column} -> ${defLiteral}`);
    } catch (err) {
      console.log(`⚠️  Default skipped for ${table}.${column}: ${err.message}`);
    }
  }
};

const ensureNullability = async () => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Payments')) return;
    const [rows] = await sequelize.query(
      "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Payments' AND COLUMN_NAME = 'amountInUSD'"
    );
    // D11: LBP rows without a valid rate are held with amountInUSD NULL —
    // widening NOT NULL → NULL never alters stored values.
    if (rows.length && rows[0].IS_NULLABLE === 'NO') {
      await sequelize.query('ALTER TABLE `Payments` MODIFY COLUMN `amountInUSD` DECIMAL(15,2) NULL');
      console.log('🔧 Migration: Payments.amountInUSD is now NULL-able');
    }
  } catch (err) {
    console.log(`⚠️  Nullability skipped for Payments.amountInUSD: ${err.message}`);
  }
};

const ensureTransactionCurrencyEnum = async () => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Transactions')) return;
    const [cols] = await sequelize.query(
      "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Transactions' AND COLUMN_NAME = 'currency'"
    );
    if (!cols.length || String(cols[0].COLUMN_TYPE).toLowerCase().startsWith('enum')) return;
    const [distinct] = await sequelize.query('SELECT DISTINCT `currency` AS v FROM `Transactions`');
    if (!shouldConvertCurrency(distinct.map((r) => r.v))) {
      console.log('⚠️  Transactions.currency kept as varchar: unexpected values present (see PHASE_2_MANUAL_MIGRATION.sql step 5)');
      return;
    }
    await sequelize.query("ALTER TABLE `Transactions` MODIFY COLUMN `currency` ENUM('USD','LBP') NULL DEFAULT 'USD'");
    console.log('🔧 Migration: Transactions.currency converted to ENUM(USD,LBP)');
  } catch (err) {
    console.log(`⚠️  Currency conversion skipped: ${err.message}`);
  }
};

const bootMigrate = async () => {
  try {
    // Creates missing tables only — never alters/drops existing ones.
    await sequelize.sync();
    console.log('📦 Schema in sync (missing tables created if any)');
  } catch (err) {
    console.log(`⚠️  sequelize.sync() skipped: ${err.message}`);
  }
  await ensureColumns();
  await ensureDefaults();
  await ensureNullability();
  await ensureTransactionCurrencyEnum();
};

module.exports = bootMigrate;
// Exported for regression tests (DB-free): the module must stay callable.
module.exports.REQUIRED_COLUMNS = REQUIRED_COLUMNS;
module.exports.COLUMN_DEFAULTS = COLUMN_DEFAULTS;
module.exports.shouldConvertCurrency = shouldConvertCurrency;
