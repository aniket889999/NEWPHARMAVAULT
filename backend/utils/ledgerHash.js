'use strict';
const crypto = require('node:crypto');

const iso = (value) => (value ? new Date(value).toISOString() : undefined);

/**
 * The one canonical block payload for the demo ledger. Used when a block is written
 * (seed, registerBatch) and when it is checked (verifyBatch), so a genuine record always
 * re-hashes to the stored value and only a real edit shows as tampered.
 */
function blockHashPayload(b) {
  return {
    medicineName: b.medicineName,
    genericName: b.genericName || undefined,
    batchNumber: b.batchNumber,
    manufacturer: b.manufacturer,
    manufacturingDate: iso(b.manufacturingDate),
    expiryDate: iso(b.expiryDate),
    distributor: b.distributor || undefined,
    pharmacyName: b.pharmacyName || undefined,
    pharmacyLocation: b.pharmacyLocation || undefined,
    supplyChainStage: b.supplyChainStage || undefined,
    previousHash: b.previousHash,
    timestamp: iso(b.timestamp)
  };
}

const blockHash = (b) => crypto.createHash('sha256').update(JSON.stringify(blockHashPayload(b))).digest('hex');

module.exports = { blockHashPayload, blockHash };
