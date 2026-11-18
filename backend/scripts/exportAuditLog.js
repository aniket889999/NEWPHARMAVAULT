#!/usr/bin/env node
'use strict';

/**
 * Daily audit export for off-site, write-once storage (e.g. an object-lock bucket).
 *   node scripts/exportAuditLog.js --out ./audit-exports [--day 2026-11-17]
 * Writes audit-<day>.jsonl (events created that UTC day, chain order) and
 * audit-<day>.manifest.json (count, first/last chain seq and hash, file SHA-256).
 * Default day: yesterday (UTC). Metadata is already redacted when events are written.
 * Run from cron once a day; keep exports outside the database host.
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const AuditEvent = require('../models/auditEventModel');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required.');
    process.exit(1);
  }
  const outDir = path.resolve(arg('--out', './audit-exports'));
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const day = arg('--day', yesterday);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('--day must be YYYY-MM-DD');
  const from = new Date(`${day}T00:00:00.000Z`);
  const to = new Date(from.getTime() + 86_400_000);

  await mongoose.connect(process.env.MONGO_URI);
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `audit-${day}.jsonl`);
    if (fs.existsSync(file)) throw new Error(`${file} already exists; exports are write-once.`);
    const hash = crypto.createHash('sha256');
    const fd = fs.openSync(file, 'wx', 0o600);
    let count = 0, first = null, last = null;
    const cursor = AuditEvent.find({ createdAt: { $gte: from, $lt: to } }).sort({ chainSeq: 1, createdAt: 1 }).lean().cursor();
    for await (const e of cursor) {
      const line = `${JSON.stringify(e)}\n`;
      fs.writeSync(fd, line);
      hash.update(line);
      count += 1;
      if (e.chainSeq) { first = first || { seq: e.chainSeq, hash: e.hash }; last = { seq: e.chainSeq, hash: e.hash }; }
    }
    fs.closeSync(fd);
    const manifest = { day, count, firstLink: first, lastLink: last, fileSha256: hash.digest('hex'), exportedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(outDir, `audit-${day}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Audit export failed:', error.message);
  process.exit(1);
});
