const express = require('express');
const router = express.Router();

// PHASE 2 (D27): seed endpoint REMOVED. Property seeding is CLI-only:
//   npm run seed:properties   (node src/seeders/propertySeeder.js)
// This router is kept mounted so /api/admin stays a valid namespace for
// future admin endpoints; unknown paths fall through to the JSON 404.

module.exports = router;
