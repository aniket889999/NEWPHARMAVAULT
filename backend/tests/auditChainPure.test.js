'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { canonical, linkHash, algorithm, GENESIS } = require('../services/platform/auditChain');

const event = { _id: '64b000000000000000000001', actorId: '64b000000000000000000002', actorRole: 'pharmacist', action: 'REVIEW_DECISION_RECORDED', targetType: 'Case', targetId: 'c1', metadata: { b: 1, a: { d: [2, 1], c: new Date('2026-11-18T00:00:00Z') } }, createdAt: new Date('2026-11-18T10:00:00Z') };

test('canonical form ignores key order but not values', () => {
  assert.equal(canonical({ b: 1, a: { y: 2, x: 1 } }), canonical({ a: { x: 1, y: 2 }, b: 1 }));
  assert.notEqual(canonical({ a: [1, 2] }), canonical({ a: [2, 1] }));
  assert.equal(canonical({ when: new Date('2026-11-18T00:00:00Z') }), '{"when":"2026-11-18T00:00:00.000Z"}');
  assert.equal(canonical({ a: 1, empty: {}, nested: { gone: {} } }), canonical({ a: 1 }), 'empty objects are minimized like MongoDB stores them');
});

test('link hash depends on sequence, previous hash and every event field', () => {
  const base = linkHash({ seq: 1, prevHash: GENESIS, event, alg: 'sha256' });
  assert.match(base, /^[a-f0-9]{64}$/);
  assert.equal(base, linkHash({ seq: 1, prevHash: GENESIS, event: { ...event, metadata: { a: { c: event.metadata.a.c, d: [2, 1] }, b: 1 } }, alg: 'sha256' }));
  assert.notEqual(base, linkHash({ seq: 2, prevHash: GENESIS, event, alg: 'sha256' }));
  assert.notEqual(base, linkHash({ seq: 1, prevHash: 'f'.repeat(64), event, alg: 'sha256' }));
  for (const change of [{ action: 'OTHER' }, { actorId: '64b000000000000000000009' }, { metadata: { b: 2 } }, { createdAt: new Date('2026-11-18T10:00:01Z') }]) {
    assert.notEqual(base, linkHash({ seq: 1, prevHash: GENESIS, event: { ...event, ...change }, alg: 'sha256' }), JSON.stringify(change));
  }
});

test('HMAC mode needs AUDIT_CHAIN_KEY and differs from plain SHA-256', () => {
  const env = { AUDIT_CHAIN_KEY: 'k'.repeat(32) };
  assert.equal(algorithm(env), 'hmac-sha256');
  assert.equal(algorithm({ AUDIT_CHAIN_KEY: 'short' }), 'sha256');
  const hmac = linkHash({ seq: 1, prevHash: GENESIS, event, alg: 'hmac-sha256' }, env);
  assert.notEqual(hmac, linkHash({ seq: 1, prevHash: GENESIS, event, alg: 'sha256' }, env));
  assert.throws(() => linkHash({ seq: 1, prevHash: GENESIS, event, alg: 'hmac-sha256' }, {}), /AUDIT_CHAIN_KEY/);
});
