'use strict';

// Database-free tests for the MongoDB lease lock and shared rate-limit store,
// using an in-memory collection that mimics the driver calls they use.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLeaseLock } = require('../services/platform/distributedLock');
const { MongoRateLimitStore } = require('../services/platform/mongoRateLimitStore');

function matches(doc, filter) {
  return Object.entries(filter).every(([k, v]) => {
    const actual = doc[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('$lt' in v) return actual < v.$lt;
      if ('$lte' in v) return actual <= v.$lte;
      if ('$gt' in v) return actual > v.$gt;
    }
    return actual instanceof Date ? actual.getTime() === v.getTime() : actual === v;
  });
}

function fakeCollection() {
  const docs = new Map();
  const apply = (doc, update) => {
    for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v;
    for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + v;
  };
  return {
    docs,
    async insertOne(doc) {
      if (docs.has(doc._id)) throw Object.assign(new Error('dup'), { code: 11000 });
      docs.set(doc._id, { ...doc });
    },
    async updateOne(filter, update) {
      const doc = docs.get(filter._id);
      if (doc && matches(doc, filter)) { apply(doc, update); return { modifiedCount: 1 }; }
      return { modifiedCount: 0 };
    },
    async findOneAndUpdate(filter, update, options = {}) {
      let doc = docs.get(filter._id);
      if (doc && !matches(doc, filter)) return null;
      if (!doc) {
        if (!options.upsert) return null;
        doc = { _id: filter._id, ...(update.$setOnInsert || {}) };
        docs.set(filter._id, doc);
      }
      apply(doc, update);
      return { ...doc };
    },
    async deleteOne(filter) {
      const doc = docs.get(filter._id);
      if (doc && matches(doc, filter)) docs.delete(filter._id);
    }
  };
}

test('lease lock: second holder is refused, release frees it, expired lease is taken over', async () => {
  let clock = 1_000_000;
  const collection = fakeCollection();
  const lock = createLeaseLock(async () => collection, { leaseMs: 5000, now: () => clock });

  const releaseA = await lock.acquire('case:1');
  await assert.rejects(lock.acquire('case:1'), { code: 'CASE_BUSY' });
  const releaseOther = await lock.acquire('case:2');
  await releaseA();
  const releaseB = await lock.acquire('case:1');
  await releaseB();
  await releaseOther();

  await lock.acquire('case:3'); // crashed holder never releases
  clock += 6000;
  const releaseC = await lock.acquire('case:3');
  assert.ok(collection.docs.has('case:3'));
  await releaseC();
  assert.equal(collection.docs.has('case:3'), false);
});

test('lease lock: a stale holder cannot delete the new owner lease', async () => {
  let clock = 0;
  const collection = fakeCollection();
  const lock = createLeaseLock(async () => collection, { leaseMs: 1000, now: () => clock });
  const staleRelease = await lock.acquire('k');
  clock += 2000;
  const freshRelease = await lock.acquire('k');
  await staleRelease();
  assert.ok(collection.docs.has('k'), 'new owner keeps the lock');
  await freshRelease();
});

test('withLock releases after errors', async () => {
  const collection = fakeCollection();
  const lock = createLeaseLock(async () => collection, { leaseMs: 1000 });
  await assert.rejects(lock.withLock('x', async () => { throw new Error('boom'); }), /boom/);
  assert.equal(collection.docs.size, 0);
});

test('shared rate-limit store counts per prefix and resets', async () => {
  const collection = fakeCollection();
  const auth = new MongoRateLimitStore({ prefix: 'auth', getCollection: () => collection });
  const ai = new MongoRateLimitStore({ prefix: 'ai', getCollection: () => collection });
  auth.init({ windowMs: 60_000 });
  ai.init({ windowMs: 60_000 });
  assert.equal((await auth.increment('1.2.3.4')).totalHits, 1);
  assert.equal((await auth.increment('1.2.3.4')).totalHits, 2);
  assert.equal((await ai.increment('1.2.3.4')).totalHits, 1);
  await auth.decrement('1.2.3.4');
  assert.equal((await auth.increment('1.2.3.4')).totalHits, 2);
  await auth.resetKey('1.2.3.4');
  assert.equal((await auth.increment('1.2.3.4')).totalHits, 1);
});
