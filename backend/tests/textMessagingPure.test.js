'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const tm = require('../services/platform/textMessaging');

test('phone numbers are normalised to E.164 and Indian mobiles are validated', () => {
  assert.equal(tm.normalizePhone('98765 43210'), '+919876543210');
  assert.equal(tm.normalizePhone('098765-43210'), '+919876543210');
  assert.equal(tm.normalizePhone('+44 7700 900123'), '+447700900123');
  for (const bad of ['12345', '+91 12345 67890', 'abc', '']) assert.throws(() => tm.normalizePhone(bad), /valid mobile/);
  assert.equal(tm.maskPhone('+919876543210'), '+91 ••••• 210');
});

test('texts are off unless enabled with an https gateway, and carry no case content', async () => {
  assert.equal(tm.textEnabled({ NOTIFY_TEXT_ENABLED: 'true', TEXT_GATEWAY_URL: 'http://x', TEXT_GATEWAY_TOKEN: 't'.repeat(16) }), false);
  const env = { NOTIFY_TEXT_ENABLED: 'true', TEXT_GATEWAY_URL: 'https://gateway.example', TEXT_GATEWAY_TOKEN: 't'.repeat(16) };
  assert.equal(tm.textEnabled(env), true);
  for (const text of Object.values(tm.TEXT_TEMPLATES)) assert.doesNotMatch(text, /₹|\d/);
  const calls = [];
  const ok = await tm.sendText({ to: '+919876543210', channel: 'sms', text: 'x' }, env, async (url, init) => { calls.push([url, JSON.parse(init.body)]); return { ok: true, status: 200 }; });
  assert.deepEqual(ok, { sent: true, attempts: 1 });
  assert.equal(calls[0][1].to, '+919876543210');
  const rejected = await tm.sendText({ to: '+919876543210', channel: 'sms', text: 'x' }, env, async () => ({ ok: false, status: 400 }));
  assert.equal(rejected.sent, false, 'client errors are not retried');
});
