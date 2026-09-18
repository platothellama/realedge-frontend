/**
 * QA hardening 2026-09-18: safe API error shapes.
 *
 * Raw `error.message` (Sequelize/SQL/stack internals) must never reach
 * clients in production. `safeError` spreads dev-only detail:
 *
 *   res.status(400).json({ message: 'Error creating payment', ...safeError(error) });
 *
 * Production responses carry only the curated `message`; development keeps
 * the detail for debugging. A production response middleware in index.js
 * additionally strips any stray `error` field as defense in depth.
 */
function safeError(err) {
  if (process.env.NODE_ENV === 'production') return {};
  if (err && err.message) return { error: err.message };
  return {};
}

module.exports = { safeError };
