'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { loadClient } = require('./load-client.cjs');
const f = require('./client-fixtures.cjs');
const { EvidenceFreshness } = loadClient('src/features/caseAssistant/EvidenceFreshness.tsx');
const { default: ChatMessage } = loadClient('src/components/chat/ChatMessage.tsx');
const { toChatResponse } = loadClient('src/features/caseAssistant/toChatResponse.ts');
const render = (C, props) => renderToStaticMarkup(React.createElement(C, props));
test('stale evidence warning is explicit, actionable and does not claim an automatic review decision', () => {
  const html = render(EvidenceFreshness, { value: { status: 'STALE', checkedAt: null }, generatedAt: f.answer().generatedAt, onAskAgain() {}, onCheck() {} });
  assert.match(html, /Outdated answer/); assert.match(html, /Keep this answer as history/);
  assert.match(html, /Ask again using current evidence/); assert.doesNotMatch(html, /Verified answer|Claim approved/);
});
test('fresh evidence label is limited to the last check, not clinical confidence', () => {
  const html = render(EvidenceFreshness, { value: { status: 'FRESH', checkedAt: '2026-11-16T12:01:00.000Z' }, generatedAt: f.answer().generatedAt });
  assert.match(html, /unchanged at last check/); assert.match(html, /not clinical correctness/);
});
test('unchecked, checking and unavailable states are never presented as fresh', () => {
  for (const status of ['UNCHECKED', 'CHECKING', 'UNVERIFIABLE']) {
    const html = render(EvidenceFreshness, { value: { status }, generatedAt: f.answer().generatedAt });
    assert.doesNotMatch(html, /unchanged at last check/);
  }
});
test('case answer retains historical text and exact protected source links without exposing receipt', () => {
  const a = f.answer(), message = { id: 'fixture', role: 'assistant', content: a.reply, rag: toChatResponse(a), deliveryStatus: 'complete',
    freshness: { status: 'STALE', checkedAt: null }, timestamp: new Date() };
  const html = render(ChatMessage, { message, onAskAgain() {}, onCheckEvidence() {} });
  assert.match(html, /650 mg/); assert.match(html, /Outdated answer/); assert.match(html, /Local case evidence/);
  assert.doesNotMatch(html, /SYNTHETIC-UNSIGNED-CONSUMER-FIXTURE|Keyword retrieval|Generated with retrieved evidence/);
});
