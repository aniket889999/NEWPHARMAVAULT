#!/usr/bin/env node
'use strict';

/**
 * Checks the tamper-evident audit chain. Exit code 0 = intact, 2 = broken.
 *   node scripts/verifyAuditChain.js [--from 1]
 * Set AUDIT_CHAIN_KEY when the chain was written with HMAC.
 */
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const AuditEvent = require('../models/auditEventModel');
const { verifyChain } = require('../services/platform/auditChain');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const result = await verifyChain(AuditEvent, { fromSeq: Number(arg('--from', 1)) });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 2;
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Audit verification failed:', error.message);
  process.exit(1);
});
