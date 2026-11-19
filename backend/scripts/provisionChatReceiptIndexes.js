'use strict';
// Default is a dry-run. This only creates named receipt indexes; never drops
// indexes/collections, copies data or seeds accounts. TTL retention needs approval.
const mongoose = require('mongoose');
const indexes = [{ key: { user: 1 }, options: { name: 'user_1' } }, { key: { expiresAt: 1 }, options: { name: 'expiresAt_1', expireAfterSeconds: 0 } }];
async function apply() {
  if (process.env.CHAT_RECEIPT_INDEX_MIGRATION_APPROVED !== 'true' || !process.env.MONGO_URI) throw new Error('Explicit migration approval and a database configuration are required.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  try {
    const Receipt = require('../models/chatReceiptModel');
    for (const index of indexes) await Receipt.collection.createIndex(index.key, index.options);
    console.log('Chat receipt indexes provisioned. No collections or indexes were dropped.');
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) {
  if (!process.argv.includes('--apply')) console.log(JSON.stringify({ dryRun: true, target: 'chat receipt metadata collection', indexes, note: 'Confirm retention and configure credentials privately before --apply.' }, null, 2));
  else apply().catch(() => { console.error('Receipt index provisioning could not complete. No credential details are printed.'); process.exitCode = 1; });
}
module.exports = { indexes };
