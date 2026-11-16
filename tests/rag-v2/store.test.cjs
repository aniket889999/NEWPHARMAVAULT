'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadClient } = require('./load-client.cjs');
const f = require('./client-fixtures.cjs');
const { createChatStore } = loadClient('src/stores/chatStore.ts');
const { toChatResponse } = loadClient('src/features/caseAssistant/toChatResponse.ts');
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(check = async (_caseId, receipts) => ({ ...f.freshness(), results: receipts.map(r => ({ ...f.freshness().results[0], answerId: r.answerId })) })) {
  let serial = 0; const payloads = [];
  const store = createChatStore(async (payload, _signal, emit) => {
    payloads.push(payload);
    const a = f.answer(); a.answerId = String(++serial).padStart(8, '0') + '-1111-4111-8111-111111111111';
    emit({ event: 'done', data: toChatResponse(a) });
  }, check);
  store.getState().createConversation(f.CASE);
  return { store, payloads };
}
test('case scope is explicit; receipt check consumes no question/history/field values', async () => {
  const checks = [];
  const { store, payloads } = harness(async (...args) => { checks.push(args); return { ...f.freshness(), results: args[1].map(r => ({ ...f.freshness().results[0], answerId: r.answerId })) }; });
  store.getState().selectCaseMedicine(f.ITEM); await store.getState().sendMessage('recorded strength?'); await flush();
  assert.equal(payloads[0].caseId, f.CASE); assert.equal(payloads[0].medicineItemId, f.ITEM);
  assert.deepEqual(Object.keys(checks[0][1][0]).sort(), ['answerId', 'bindingToken']);
  assert.equal(store.getState().activeConversation.messages[1].freshness.status, 'FRESH');
});
test('server-reported dependent change marks old answer stale without altering its text', async () => {
  let status = 'FRESH';
  const { store } = harness(async (_caseId, receipts) => ({ ...f.freshness(), results: receipts.map(r => ({ ...f.freshness(undefined, status).results[0], answerId: r.answerId })) }));
  await store.getState().sendMessage('recorded strength?'); await flush();
  const original = store.getState().activeConversation.messages[1].content;
  status = 'STALE'; await store.getState().refreshCaseFreshness();
  assert.equal(store.getState().activeConversation.messages[1].freshness.status, 'STALE');
  assert.equal(store.getState().activeConversation.messages[1].content, original);
});
test('private ask-again appends a new exchange and retains previous evidence answer', async () => {
  const { store, payloads } = harness(); store.getState().selectCaseMedicine(f.ITEM);
  await store.getState().sendMessage('recorded strength?'); await flush();
  const old = store.getState().activeConversation.messages[1];
  store.getState().selectCaseMedicine('mi_' + '1'.repeat(24));
  await store.getState().askAgainWithCurrentEvidence(old.id); await flush();
  const messages = store.getState().activeConversation.messages;
  assert.equal(messages.length, 4); assert.equal(messages[1].id, old.id);
  assert.equal(payloads[1].medicineItemId, f.ITEM, 'Re-ask preserves the original scope, not a later selector choice');
  await store.getState().regenerateLastResponse(); await flush();
  assert.equal(store.getState().activeConversation.messages.length, 6, 'Private regenerate also preserves history');
});
test('unavailable freshness never becomes fresh and never deletes existing answer text', async () => {
  const { store } = harness(async () => { throw new Error('SENSITIVE internal error'); });
  await store.getState().sendMessage('recorded strength?'); await flush();
  const message = store.getState().activeConversation.messages[1];
  assert.equal(message.freshness.status, 'UNVERIFIABLE'); assert.match(message.content, /650 mg/);
  assert.doesNotMatch(store.getState().freshnessError, /SENSITIVE/);
});
test('a later fresh result does not silently rehabilitate an already stale historical answer', async () => {
  let status = 'STALE';
  const { store } = harness(async (_caseId, receipts) => ({ ...f.freshness(), results: receipts.map(r => ({ ...f.freshness(undefined, status).results[0], answerId: r.answerId })) }));
  await store.getState().sendMessage('recorded strength?'); await flush();
  status = 'FRESH'; await store.getState().refreshCaseFreshness();
  assert.equal(store.getState().activeConversation.messages[1].freshness.status, 'STALE');
});
test('late receipt response cannot modify a newly selected conversation', async () => {
  let resolve;
  const { store } = harness(async () => new Promise(r => { resolve = r; }));
  await store.getState().sendMessage('recorded strength?'); const old = store.getState().activeConversation;
  store.getState().createConversation('f'.repeat(24));
  resolve({ ...f.freshness(), results: [{ ...f.freshness().results[0], answerId: old.messages[1].rag.caseAnswer.answerId }] });
  await flush();
  assert.equal(store.getState().activeConversation.caseId, 'f'.repeat(24));
  assert.equal(store.getState().activeConversation.messages.length, 0);
  assert.equal(store.getState().isCheckingFreshness, false);
});
test('a superseded fresh check cannot override a newer stale response', async () => {
  const pending = [];
  const { store } = harness(async (_caseId, receipts) => new Promise(resolve => pending.push({ resolve, answerId: receipts[0].answerId })));
  await store.getState().sendMessage('recorded strength?');
  const second = store.getState().refreshCaseFreshness();
  pending[1].resolve({ ...f.freshness(undefined, 'STALE'), results: [{ ...f.freshness(undefined, 'STALE').results[0], answerId: pending[1].answerId }] });
  await second;
  pending[0].resolve({ ...f.freshness(), results: [{ ...f.freshness().results[0], answerId: pending[0].answerId }] });
  await flush();
  assert.equal(store.getState().activeConversation.messages[1].freshness.status, 'STALE');
});
test('sign-out/session reset clears answers and cancels pending receipt checks', async () => {
  let signal;
  const { store } = harness(async (_caseId, _receipts, s) => { signal = s; return new Promise(() => {}); });
  await store.getState().sendMessage('recorded strength?'); store.getState().resetChat();
  assert.equal(signal.aborted, true); assert.equal(store.getState().conversations.length, 0);
  assert.equal(store.getState().activeConversation, null);
});
