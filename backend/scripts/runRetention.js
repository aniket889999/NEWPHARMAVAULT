#!/usr/bin/env node
'use strict';

/**
 * Manual retention pass.
 *   node scripts/runRetention.js          # dry run (counts only)
 *   node scripts/runRetention.js --apply  # remove content of eligible old cases + old notifications
 * Policy: RETENTION_CASE_DAYS (default 365, min 30), RETENTION_NOTIFICATION_DAYS (default 180, min 7).
 */
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { runRetention } = require('../services/platform/retentionService');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const report = await runRetention({ dryRun: !process.argv.includes('--apply') });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Retention failed:', error.message);
  process.exit(1);
});
