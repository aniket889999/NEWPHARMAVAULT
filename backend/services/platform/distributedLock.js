'use strict';

/**
 * Cross-instance lease lock stored in MongoDB (no extra infrastructure).
 *
 * Why MongoDB and not Redis: PharmaVault already depends on MongoDB, so a
 * unique-_id lease document gives multi-instance safety without adding a new
 * service. A Redis adapter can implement the same interface later.
 *
 * Semantics: acquire() inserts {_id: key, owner, expiresAt}. A duplicate key
 * means someone holds it, unless the lease expired, in which case it is taken
 * over atomically. The holder renews the lease while working; release()
 * deletes the document only if it still owns it.
 */
const crypto = require('node:crypto');

const DEFAULT_LEASE_MS = 120_000;

function busyError() {
  return Object.assign(new Error('Case is currently being modified or reviewed by another operation.'), { statusCode: 409, code: 'CASE_BUSY' });
}

function createLeaseLock(getCollection, { leaseMs = DEFAULT_LEASE_MS, now = () => Date.now() } = {}) {
  async function acquire(key) {
    const collection = await getCollection();
    const owner = crypto.randomUUID();
    const expiresAt = new Date(now() + leaseMs);
    try {
      await collection.insertOne({ _id: key, owner, expiresAt });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const takeover = await collection.findOneAndUpdate(
        { _id: key, expiresAt: { $lt: new Date(now()) } },
        { $set: { owner, expiresAt } },
        { returnDocument: 'after' }
      );
      const doc = takeover && Object.prototype.hasOwnProperty.call(takeover, 'value') ? takeover.value : takeover;
      if (!doc || doc.owner !== owner) throw busyError();
    }

    let released = false;
    const renewEvery = Math.max(1000, Math.floor(leaseMs / 3));
    const timer = setInterval(() => {
      collection.updateOne({ _id: key, owner }, { $set: { expiresAt: new Date(now() + leaseMs) } }).catch(() => {});
    }, renewEvery);
    timer.unref?.();

    return async function release() {
      if (released) return;
      released = true;
      clearInterval(timer);
      await collection.deleteOne({ _id: key, owner });
    };
  }

  async function withLock(key, fn) {
    const release = await acquire(key);
    try {
      return await fn();
    } finally {
      await release();
    }
  }

  return { acquire, withLock };
}

let mongoLock = null;
function mongoCaseLock() {
  if (!mongoLock) {
    const mongoose = require('mongoose');
    const leaseMs = Number(process.env.CASE_LOCK_LEASE_MS) > 0 ? Number(process.env.CASE_LOCK_LEASE_MS) : DEFAULT_LEASE_MS;
    let ready = null;
    const getCollection = async () => {
      const collection = mongoose.connection.collection('pharmavault_locks');
      // TTL index cleans up leases left by crashed instances.
      ready ||= collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 60 }).catch(() => {});
      await ready;
      return collection;
    };
    mongoLock = createLeaseLock(getCollection, { leaseMs });
  }
  return mongoLock;
}

const distributedLocksEnabled = () => process.env.CASE_LOCK_BACKEND === 'mongo';

module.exports = { createLeaseLock, mongoCaseLock, distributedLocksEnabled, busyError };
