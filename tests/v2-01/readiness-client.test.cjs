'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadClient } = require('../rag-v2/load-client.cjs');
const { parseChatCapabilities, readinessPresentation } = loadClient('src/features/chatReadiness/presentation.ts');
const { ChatReadinessNotice } = loadClient('src/features/chatReadiness/ChatReadinessNotice.tsx');
const checkedAt = '2026-11-16T16:00:00.000Z', expiresAt = '2026-11-16T16:05:00.000Z';
const now = Date.parse(checkedAt) + 1000;
const base = () => ({ generationEnabled: true, embeddingEnabled: false, model: 'gemini-2.5-flash', healthReferencePassages: 5 });
const verified = () => ({ ...base(), providerReadiness: { schemaVersion: 'chat-provider-readiness/1.0.0', state: 'VERIFIED_RECENTLY', reasonCode: 'LIVE_RESPONSE_VALIDATED', configured: true, model: 'gemini-2.5-flash', liveProviderVerified: true, checkedAt, lastSuccessAt: checkedAt, expiresAt, verificationScope: 'PUBLIC_REFERENCE_GENERATION', privateCasePolicy: 'LOCAL_ONLY', statusDoesNotProbe: true } });
const status = (state, reasonCode) => ({ ...verified(), providerReadiness: { ...verified().providerReadiness, state, reasonCode, liveProviderVerified: false, lastSuccessAt: null } });

test('legacy configured API is never displayed as a live verified provider', () => {
  const value = parseChatCapabilities(base()); assert.ok(value);
  assert.match(readinessPresentation(value, false, now).title, /not verified/);
});
test('legacy disabled API and missing status have distinct honest labels', () => {
  assert.match(readinessPresentation(parseChatCapabilities({ ...base(), generationEnabled: false, model: null }), false, now).title, /disabled/);
  assert.match(readinessPresentation(null).title, /unavailable/);
});
test('current format/citation-validated public observation has a bounded label', () => {
  const value = parseChatCapabilities(verified()); assert.ok(value);
  const display = readinessPresentation(value, false, now);
  assert.match(display.title, /Recent public Gemini response verified/);
  assert.match(display.detail, /not clinical correctness/); assert.match(display.detail, /not.*guarantee/);
});
test('expired or future provider observation cannot be displayed as verified', () => {
  const value = parseChatCapabilities(verified());
  for (const time of [Date.parse(expiresAt), Date.parse(expiresAt) + 1, Date.parse(checkedAt) - 1]) assert.match(readinessPresentation(value, false, time).title, /not verified/);
});
test('private scope always overrides every public-provider state', () => {
  for (const value of [null, parseChatCapabilities(base()), parseChatCapabilities(verified()), parseChatCapabilities(status('DEGRADED', 'PROVIDER_RATE_LIMIT'))]) {
    const display = readinessPresentation(value, true, now); assert.match(display.title, /local only/); assert.doesNotMatch(display.title, /Gemini|verified|unavailable/);
    assert.match(display.detail, /does not validate private/);
  }
});
test('public fallback states remain degraded with rate limits explained', () => {
  for (const reason of ['PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'ANSWER_VALIDATION_FAILED']) {
    const value = parseChatCapabilities(status('DEGRADED', reason)); assert.ok(value);
    const display = readinessPresentation(value, false, now); assert.equal(display.tone, 'warning'); assert.match(display.title, /fallback/);
    if (reason === 'PROVIDER_RATE_LIMIT') assert.match(display.detail, /rate-limited/);
  }
});
test('configured unverified and expired observations do not become success badges', () => {
  for (const reasonCode of ['NOT_CHECKED', 'CHECK_EXPIRED']) {
    const input = status('CONFIGURED_UNVERIFIED', reasonCode);
    if (reasonCode === 'NOT_CHECKED') Object.assign(input.providerReadiness, { checkedAt: null, expiresAt: null, verificationScope: 'NONE' });
    const parsed = parseChatCapabilities(input); assert.ok(parsed); assert.match(readinessPresentation(parsed, false, now).title, /not verified/);
  }
});
test('server misconfiguration is distinguishable from intentional local-only mode', () => {
  for (const [state, reasonCode] of [['LOCAL_ONLY', 'PUBLIC_EXPORT_NOT_ALLOWED'], ['MISCONFIGURED', 'MISSING_CREDENTIAL'], ['MISCONFIGURED', 'INVALID_MODEL']]) {
    const input = { ...base(), generationEnabled: false, model: null, providerReadiness: { ...verified().providerReadiness, state, reasonCode, configured: false, liveProviderVerified: false, checkedAt: null, expiresAt: null, lastSuccessAt: null, verificationScope: 'NONE' } };
    const parsed = parseChatCapabilities(input); assert.ok(parsed);
    assert.match(readinessPresentation(parsed, false, now).title, state === 'LOCAL_ONLY' ? /disabled/ : /server setup/);
  }
});
test('malformed status fails closed without exposing injected configuration text', () => {
  for (const mutate of [
    x => { x.providerReadiness.schemaVersion = 'unknown'; }, x => { x.providerReadiness.liveProviderVerified = false; },
    x => { x.providerReadiness.privateCasePolicy = 'EXPORT_ANYTHING'; }, x => { x.providerReadiness.statusDoesNotProbe = false; },
    x => { x.providerReadiness.model = 'https://secret.invalid/'; }, x => { x.model = 'gemini-other'; },
    x => { x.providerReadiness.reasonCode = 'SECRET_INJECTED'; }, x => { x.providerReadiness.state = 'SECRET_INJECTED'; },
    x => { x.providerReadiness.expiresAt = '2026-11-17T16:05:00.000Z'; }, x => { x.providerReadiness.checkedAt = 'tomorrow'; },
    x => { x.providerReadiness.checkedAt = '2026-02-31T16:00:00.000Z'; }, x => { x.providerReadiness.verificationScope = 'NONE'; },
    x => { x.providerReadiness.lastSuccessAt = null; }, x => { x.healthReferencePassages = -1; },
    x => { x.providerReadiness.state = 'LOCAL_ONLY'; }, x => { x.generationEnabled = false; x.embeddingEnabled = true; }
  ]) { const x = verified(); mutate(x); assert.equal(parseChatCapabilities(x), null); }
});
test('projection strips arbitrary extra response properties', () => {
  const input = verified(); input.API_KEY = 'MUST_NOT_RENDER'; input.providerReadiness.rawException = 'MUST_NOT_RENDER';
  assert.doesNotMatch(JSON.stringify(parseChatCapabilities(input)), /MUST_NOT_RENDER|rawException|API_KEY/);
});
test('accessible readiness UI is explicit about scope and current verification limits', () => {
  const html = renderToStaticMarkup(React.createElement(ChatReadinessNotice, { capabilities: parseChatCapabilities(verified()), now }));
  assert.match(html, /role="status"/); assert.match(html, /Chat provider readiness/); assert.match(html, /not clinical correctness/);
  const privateHtml = renderToStaticMarkup(React.createElement(ChatReadinessNotice, { capabilities: parseChatCapabilities(verified()), privateScope: true, now }));
  assert.match(privateHtml, /Private case evidence/); assert.doesNotMatch(privateHtml, /Recent public Gemini/);
});
