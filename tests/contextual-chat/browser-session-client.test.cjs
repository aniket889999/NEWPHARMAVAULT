'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { loadClient } = require('../rag-v2/load-client.cjs');
const read = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');

test('server identity projection drops tokens, passwords and injected properties', () => {
  const { parseSessionProfile } = loadClient('src/features/navigation/sessionProfile.ts');
  for (const value of [null, [], true, {}, { role: 'super_admin' }]) assert.equal(parseSessionProfile(value), null);
  const profile = parseSessionProfile({ _id: '650000000000000000000001', name: 'Synthetic', email: 'example@example.invalid', role: 'patient', token: 'PRIVATE_TOKEN', password: 'PRIVATE_PASSWORD', sessionVersion: 3 });
  assert.equal(profile.role, 'patient'); assert.doesNotMatch(JSON.stringify(profile), /PRIVATE_|sessionVersion/);
});
test('API client sends credentials and fixed web header, never reads local-storage tokens', async t => {
  const saved = { storage: global.localStorage, window: global.window };
  t.after(() => { for (const [key, value] of Object.entries({ localStorage: saved.storage, window: saved.window })) { if (value === undefined) delete global[key]; else global[key] = value; } });
  const removed = [], events = [];
  global.localStorage = { getItem: () => { throw new Error('must not read credentials'); }, removeItem: key => removed.push(key) };
  global.window = { dispatchEvent: value => events.push(value.type) };
  const { default: api } = loadClient('src/api/apiClient.ts'); assert.equal(api.defaults.withCredentials, true);
  const config = api.interceptors.request.handlers[0].fulfilled({ headers: {} }); assert.equal(config.headers.Authorization, undefined); assert.equal(config.headers['X-PharmaVault-Client'], 'web');
  const reject = api.interceptors.response.handlers[0].rejected;
  for (const url of ['/users/login', '/users/register', '/users/profile', '/users/logout']) await assert.rejects(reject({ response: { status: 401 }, config: { url } }));
  assert.equal(events.length, 0); assert.equal(removed.length, 0);
  await assert.rejects(reject({ response: { status: 401 }, config: { url: '/v1/cases' } })); assert.deepEqual(removed, ['token', 'user', 'pharmavault_user']); assert.deepEqual(events, ['pharmavault:session-expired']);
});
test('chat streaming uses the same cookie transport and expires the UI session on 401', async t => {
  const saved = { fetch: global.fetch, storage: global.localStorage, window: global.window };
  t.after(() => { for (const [key, value] of Object.entries({ fetch: saved.fetch, localStorage: saved.storage, window: saved.window })) { if (value === undefined) delete global[key]; else global[key] = value; } });
  global.localStorage = { getItem: () => { throw new Error('must not read token'); }, removeItem: () => {} };
  const events = []; global.window = { dispatchEvent: event => events.push(event.type) };
  const { streamChat } = loadClient('src/api/chatStream.ts'); let sent;
  global.fetch = async (_url, options) => { sent = options; return new Response('event: done\ndata: {"reply":"Synthetic"}\n\n'); };
  await streamChat({ message: 'What is RAG?', history: [] }, new AbortController().signal, () => {});
  assert.equal(sent.credentials, 'include'); assert.equal(sent.headers['X-PharmaVault-Client'], 'web'); assert.equal(sent.headers.Authorization, undefined);
  global.fetch = async () => new Response('', { status: 401 }); await assert.rejects(streamChat({ message: 'What is RAG?', history: [] }, new AbortController().signal, () => {}), /sign in again/); assert.deepEqual(events, ['pharmavault:session-expired']);
});
test('browser bootstrap validates with the server and migration only removes old credentials', () => {
  const provider = read('src/context/AuthContext.tsx'); assert.match(provider, /apiClient\.get\('\/users\/profile'\)/); assert.match(provider, /apiClient\.post\('\/users\/logout'/); assert.match(provider, /current !== epoch\.current/); assert.match(provider, /server-side sign-out could not be confirmed/);
  for (const file of ['src/context/AuthContext.tsx', 'src/api/apiClient.ts', 'src/api/chatStream.ts']) assert.doesNotMatch(read(file), /localStorage\.(?:getItem|setItem)|Bearer/);
  assert.doesNotMatch(read('src/features/navigation/sessionProfile.ts'), /localStorage\.(?:getItem|setItem)/);
});
