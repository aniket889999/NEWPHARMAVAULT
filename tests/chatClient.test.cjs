const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

function load(entry) {
  const result = esbuild.buildSync({ entryPoints: [path.resolve(__dirname, '..', entry)], bundle: true, write: false,
    platform: 'node', format: 'cjs', logLevel: 'silent', define: { 'import.meta.env.VITE_API_URL': '"http://127.0.0.1:5001/api"' } });
  const m = new Module(path.resolve(__dirname, 'bundled-test.cjs'), module);
  m.filename = path.resolve(__dirname, 'bundled-test.cjs');
  m.paths = module.paths;
  m._compile(result.outputFiles[0].text, m.filename);
  return m.exports;
}
const { createChatStore } = load('src/stores/chatStore.ts');
const { parseChatEvent, streamChat } = load('src/api/chatStream.ts');
const answer = { reply: 'A supported answer. [S1]', mode: 'GEMINI_RAG', sources: [], warnings: [], disclaimer: 'Demo', retrieval: { method: 'BM25', matchedPassages: 1 } };

test('client parses SSE events and ignores heartbeats', () => {
  assert.equal(parseChatEvent(': keepalive'), null);
  assert.deepEqual(parseChatEvent('event: delta\ndata: {"text":"hello"}'), { event: 'delta', data: { text: 'hello' } });
});

test('store streams into one assistant message and forwards bounded conversation history', async () => {
  const payloads = [];
  const store = createChatStore(async (payload, _signal, emit) => {
    payloads.push(payload); emit({ event: 'delta', data: { text: 'partial' } }); emit({ event: 'done', data: answer });
  });
  store.getState().createConversation();
  await store.getState().sendMessage('What is Paracetamol?');
  await store.getState().sendMessage('What about its side effects?');
  assert.equal(store.getState().activeConversation.messages.length, 4);
  assert.equal(store.getState().activeConversation.messages[3].deliveryStatus, 'complete');
  assert.equal(payloads[1].history.length, 2);
  assert.equal(payloads[1].history[0].text, 'What is Paracetamol?');
  assert.equal(store.getState().isLoading, false);
});

test('regeneration replaces the last exchange without duplicating the user question', async () => {
  const store = createChatStore(async (_payload, _signal, emit) => emit({ event: 'done', data: answer }));
  await store.getState().sendMessage('human review');
  await store.getState().regenerateLastResponse();
  assert.equal(store.getState().activeConversation.messages.length, 2);
  assert.equal(store.getState().activeConversation.messages.filter(m => m.role === 'user').length, 1);
});

test('stop preserves partial output and never appends an old reply to a new chat', async () => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const store = createChatStore(async (_payload, signal, emit) => {
    emit({ event: 'delta', data: { text: 'Validated partial paragraph.' } }); started();
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true }));
  });
  const pending = store.getState().sendMessage('first question');
  await ready;
  const oldId = store.getState().activeConversation.id;
  store.getState().createConversation('650000000000000000000001');
  await pending;
  assert.equal(store.getState().activeConversation.messages.length, 0);
  const old = store.getState().conversations.find(c => c.id === oldId);
  assert.equal(old.messages[1].deliveryStatus, 'stopped');
  assert.equal(store.getState().isLoading, false);
});

test('session reset removes private conversation data, including a pending response', async () => {
  const store = createChatStore(async (_payload, _signal, emit) => emit({ event: 'done', data: answer }));
  store.getState().createConversation('650000000000000000000001');
  await store.getState().sendMessage('private case question');
  store.getState().resetChat();
  assert.equal(store.getState().conversations.length, 0);
  assert.equal(store.getState().activeConversation, null);
});

test('stream reader decodes split UTF-8 frames and rejects a truncated response', async t => {
  const originalFetch = global.fetch, originalStorage = global.localStorage;
  t.after(() => { global.fetch = originalFetch; if (originalStorage === undefined) delete global.localStorage; else global.localStorage = originalStorage; });
  global.localStorage = { getItem: () => 'synthetic-token' };
  const raw = new TextEncoder().encode('event: delta\r\ndata: {"text":"café"}\r\n\r\nevent: done\r\ndata: ' + JSON.stringify(answer) + '\r\n\r\n');
  global.fetch = async () => new Response(new ReadableStream({ start(c) { for (const byte of raw) c.enqueue(Uint8Array.of(byte)); c.close(); } }));
  const events = [];
  await streamChat({ message: 'hi', history: [] }, new AbortController().signal, e => events.push(e));
  assert.equal(events[0].data.text, 'café'); assert.equal(events[1].event, 'done');
  global.fetch = async () => new Response('event: delta\ndata: {"text":"partial"}\n\n');
  await assert.rejects(streamChat({ message: 'hi', history: [] }, new AbortController().signal, () => {}), /interrupted/);
});
