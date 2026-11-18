#!/usr/bin/env node
'use strict';

/**
 * Production runs with autoIndex off, so new indexes (unique claim/audit/data-request
 * constraints included) must be created explicitly after each deploy.
 *   node scripts/syncIndexes.js          # dry run: show missing / extra indexes per model
 *   node scripts/syncIndexes.js --apply  # create missing indexes (never drops extra ones)
 */
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required.');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  const dir = path.join(__dirname, '..', 'models');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) require(path.join(dir, file));
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const report = [];
  try {
    for (const name of mongoose.modelNames().sort()) {
      const Model = mongoose.model(name);
      const diff = await Model.diffIndexes().catch((error) => ({ toCreate: [], toDrop: [], error: error.message }));
      const entry = { model: name, missing: diff.toCreate.length, extra: diff.toDrop.length, ...(diff.error ? { error: diff.error } : {}) };
      if (apply && diff.toCreate.length) {
        await Model.createIndexes();
        entry.created = diff.toCreate.length;
      }
      report.push(entry);
    }
    console.log(JSON.stringify({ apply, models: report }, null, 2));
    if (!apply && report.some((r) => r.missing)) console.log('Missing indexes found. Re-run with --apply.');
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Index sync failed:', error.message);
  process.exit(1);
});
