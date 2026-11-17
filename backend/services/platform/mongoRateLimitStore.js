'use strict';

/**
 * Shared express-rate-limit store backed by MongoDB, so limits hold across
 * several API instances. Enabled with RATE_LIMIT_STORE=mongo.
 * Each limiter must use a distinct prefix.
 */
class MongoRateLimitStore {
  constructor({ prefix, getCollection }) {
    this.prefix = prefix;
    this.getCollection = getCollection || (() => require('mongoose').connection.collection('pharmavault_rate_limits'));
    this.localKeys = false;
    this.indexReady = null;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async collection() {
    const collection = this.getCollection();
    this.indexReady ||= Promise.resolve(collection.createIndex?.({ resetTime: 1 }, { expireAfterSeconds: 0 })).catch(() => {});
    await this.indexReady;
    return collection;
  }

  key(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key) {
    const collection = await this.collection();
    const now = new Date();
    const id = this.key(key);
    // Reset an expired window, then count this hit.
    await collection.updateOne({ _id: id, resetTime: { $lte: now } }, { $set: { hits: 0, resetTime: new Date(now.getTime() + this.windowMs) } });
    const result = await collection.findOneAndUpdate(
      { _id: id },
      { $inc: { hits: 1 }, $setOnInsert: { resetTime: new Date(now.getTime() + this.windowMs) } },
      { upsert: true, returnDocument: 'after' }
    );
    const doc = result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;
    return { totalHits: doc.hits, resetTime: doc.resetTime };
  }

  async decrement(key) {
    const collection = await this.collection();
    await collection.updateOne({ _id: this.key(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    const collection = await this.collection();
    await collection.deleteOne({ _id: this.key(key) });
  }
}

module.exports = { MongoRateLimitStore };
