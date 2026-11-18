#!/usr/bin/env node
'use strict';

/**
 * One-time migration: encrypt documents and page previews that were stored
 * before DOCUMENT_ENCRYPTION_KEY was configured.
 *
 *   node scripts/encryptStoredDocuments.js            # dry run: counts only
 *   node scripts/encryptStoredDocuments.js --apply    # encrypt in place (atomic rename)
 *
 * Each file is verified by decrypting the new bytes before it replaces the old file.
 * Take a backup of DOCUMENT_STORAGE_ROOT first.
 */
const fs = require('node:fs');
const path = require('node:path');
const { getDocumentStorageRoot } = require('../config/documentStorage');
const documentCrypto = require('../services/platform/documentCrypto');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && !entry.name.endsWith('.pv-tmp')) yield full;
  }
}

function migrate({ root, key, apply }) {
  const result = { scanned: 0, alreadyEncrypted: 0, encrypted: 0, wouldEncrypt: 0, failed: 0 };
  if (!fs.existsSync(root)) return result;
  for (const file of walk(root)) {
    result.scanned += 1;
    const original = fs.readFileSync(file);
    if (documentCrypto.isEncrypted(original)) { result.alreadyEncrypted += 1; continue; }
    if (!apply) { result.wouldEncrypt += 1; continue; }
    try {
      const sealed = documentCrypto.encrypt(original, key);
      if (!documentCrypto.decrypt(sealed, key).equals(original)) throw new Error('round-trip mismatch');
      const tmp = `${file}.pv-tmp`;
      fs.writeFileSync(tmp, sealed, { mode: 0o600, flag: 'wx' });
      fs.renameSync(tmp, file);
      result.encrypted += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`Failed: ${path.relative(root, file)} (${error.message})`);
    }
  }
  return result;
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const key = documentCrypto.configuredKey();
  if (!key) {
    console.error('DOCUMENT_ENCRYPTION_KEY (32+ characters) must be set.');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  const result = migrate({ root: getDocumentStorageRoot(), key, apply });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...result }, null, 2));
  process.exit(result.failed ? 1 : 0);
}

module.exports = { migrate };
