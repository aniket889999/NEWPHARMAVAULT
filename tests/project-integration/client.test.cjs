'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadClient } = require('../rag-v2/load-client.cjs');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('all supported portal roles have a reachable home without a pharmacy redirect loop', () => {
  const { portalHome, portalTitle, STAFF_PORTALS } = loadClient('src/features/navigation/portalPolicy.ts');
  const homes = { patient: '/patient/dashboard', pharmacy: '/pharmacy/dashboard', pharmacist: '/review-queue', claims_reviewer: '/review-queue', org_admin: '/review-queue', super_admin: '/admin/saas', research_evaluator: '/research/dashboard' };
  for (const [role, target] of Object.entries(homes)) assert.equal(portalHome(role), target);
  assert.equal(portalHome('unsupported'), '/auth');
  assert.equal(portalTitle('claims_reviewer'), 'Reviewer Portal');
  assert.equal(portalTitle('research_evaluator'), 'Research Portal');
  assert.equal(STAFF_PORTALS.length, 5);
});
test('corrupt, primitive and incomplete cached sessions cannot crash restore', () => {
  const { parseSessionCache } = loadClient('src/features/navigation/sessionCache.ts');
  for (const value of [null, '', '{broken', 'null', '[]', 'true', '{}', '{"role":"super_admin"}']) assert.equal(parseSessionCache(value), null);
  const valid = { _id: '650000000000000000000001', name: 'Synthetic', email: 'test@example.invalid', role: 'patient', token: 'synthetic-unused', injected: 'not restored' };
  const restored = parseSessionCache(JSON.stringify(valid));
  assert.equal(restored.role, 'patient'); assert.equal(restored.injected, undefined);
  assert.equal(parseSessionCache(JSON.stringify({ ...valid, token: '' })), null);
});
test('both portals and the patient landing page expose the integrated chat and case workflow', () => {
  assert.match(read('src/layouts/PatientLayout.tsx'), /Evidence Chat · TrustRAG/);
  assert.match(read('src/layouts/PharmacyLayout.tsx'), /to="\/assistant"/);
  assert.match(read('src/pages/patient/Dashboard.tsx'), /\/patient\/health-assistant/);
  assert.match(read('src/pages/patient/Dashboard.tsx'), /\/cases\/new/);
});
test('legacy dashboard, graph and authenticity requests use the authenticated shared client', () => {
  for (const file of ['src/pages/pharmacy/Dashboard.tsx', 'src/pages/research/KnowledgeGraphExplorer.tsx', 'src/components/features/AuthenticityChecker.tsx']) {
    assert.match(read(file), /apiClient/); assert.doesNotMatch(read(file), /import axios|pharmavault_user|localhost:5000/);
  }
});
test('nearby lookup uses the mounted singular endpoint and does not auto-request location', () => {
  const source = read('src/pages/patient/NearbyMedicines.tsx');
  assert.match(source, /\/pharmacy\/nearby\?/); assert.doesNotMatch(source, /\/pharmacies\/nearby/);
  assert.match(source, /const requestLocation = \(\) =>/);
  assert.match(source, /no reservation or SMS was sent/);
});
test('admin and research entry routes enforce explicit client role gates', () => {
  const app = read('src/App.tsx');
  assert.match(app, /path="\/admin" element={<RoleRoute allowedRoles={\['super_admin'\]}/);
  assert.match(app, /path="\/research\/dashboard" element={<RoleRoute allowedRoles={\['super_admin', 'research_evaluator'\]}/);
  assert.match(app, /path="\/research\/ai-safety" element={<RoleRoute allowedRoles={\['super_admin'\]}/);
});
test('research dashboard projection exactly matches the published synthetic source and checksum', () => {
  const { researchSnapshot: snapshot } = loadClient('src/data/researchSnapshot.ts');
  const raw = fs.readFileSync(path.join(root, snapshot.source)); const source = JSON.parse(raw);
  assert.equal(snapshot.sourceSha256, crypto.createHash('sha256').update(raw).digest('hex'));
  for (const key of ['implementationCommit', 'freezeCommit']) assert.deepEqual(snapshot[key], source[key]);
  for (const key of ['generatedAt', 'dataset', 'retrieval', 'temporal', 'observedNetworkAttempts']) assert.deepEqual(snapshot[key], source.results.heldout[key]);
  assert.equal(snapshot.synthetic, true); assert.equal(snapshot.dataset.scenarios, 16);
  assert.equal(snapshot.retrieval.LEXICAL_UNSCOPED.wrongEntityOrSourceAnswers.numerator, 9);
  assert.equal(snapshot.retrieval.ITEM_SCOPED_DEPENDENCY_FRESHNESS.wrongEntityOrSourceAnswers.numerator, 0);
});
test('research screen does not reinstate illustrative IEEE or clinical accuracy scores', () => {
  const source = read('src/pages/research/ResearchDashboard.tsx');
  assert.match(source, /not live clinical analytics/); assert.match(source, /Reference recall did not improve/);
  assert.doesNotMatch(source, /axios|apiClient|IEEE|98\.5|Math\.random/);
});
test('organization settings handles missing subscription and marks unwired billing controls', () => {
  const source = read('src/pages/pharmacy/OrganizationSettings.tsx');
  assert.match(source, /data.subscription\?\.planName\?\./);
  assert.match(source, /data.subscription \? <div/);
  assert.match(source, /No subscription record/);
  assert.match(source, /Billing not connected/);
});
test('medicine clarification reuses its own preceding question and explicitly sends the selected item', () => {
  const { clarificationQuestion } = loadClient('src/features/caseAssistant/clarificationQuestion.ts');
  const messages = [{id:'u1',role:'user',content:'Compare strength'}, {id:'a1',role:'assistant',content:'Which item?'}, {id:'u2',role:'user',content:'Later question'}, {id:'a2',role:'assistant',content:'Later answer'}];
  assert.equal(clarificationQuestion(messages,'a1'),'Compare strength');
  assert.equal(clarificationQuestion(messages,'a2'),'Later question');
  assert.equal(clarificationQuestion(messages,'missing'),null);
  assert.equal(clarificationQuestion(messages,'u1'),null);
  const source = read('src/components/chat/ChatInterface.tsx');
  assert.match(source, /sendMessage\(question, \{ medicineItemId: itemId \}\)/);
  assert.match(source, /query: 'Compare prescription and invoice dosage strength for the selected medicine'/);
});
test('failed login stays with the form, while private 401 clears the session', async t => {
  const previous = { storage: global.localStorage, window: global.window, alert: global.alert };
  t.after(() => { for (const [name, value] of Object.entries({ localStorage: previous.storage, window: previous.window, alert: previous.alert })) { if (value === undefined) delete global[name]; else global[name] = value; } });
  const removed = []; global.localStorage = { getItem: () => 'synthetic', removeItem: key => removed.push(key) };
  global.window = { location: { href: '/login' } }; let alerts = 0; global.alert = () => alerts++;
  const { default: api } = loadClient('src/api/apiClient.ts');
  const request = api.interceptors.request.handlers[0].fulfilled({ headers: {} });
  assert.equal(request.headers.Authorization, 'Bearer synthetic');
  const reject = api.interceptors.response.handlers[0].rejected;
  await assert.rejects(reject({ response: { status: 401 }, config: { url: '/users/login' } }));
  assert.deepEqual(removed, []); assert.equal(alerts, 0); assert.equal(global.window.location.href, '/login');
  await assert.rejects(reject({ response: { status: 401 }, config: { url: '/v1/cases' } }));
  assert.deepEqual(removed, ['token', 'user', 'pharmavault_user']); assert.equal(alerts, 1); assert.equal(global.window.location.href, '/auth');
});
