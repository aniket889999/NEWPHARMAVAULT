'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { loadClient } = require('../rag-v2/load-client.cjs');
const { makeSnapshot, ACTOR } = require('../integration-v2/synthetic-snapshots.cjs');
const legacy = require('../../backend/services/trustRag/caseAssistantService');
const { prioritizeCaseAnswerSources } = require('../../backend/services/trustRag/citationPriorityPolicy');
const { CaseEvidenceSources, CaseSourceCards } = loadClient('src/features/caseAssistant/CaseEvidenceSources.tsx');
function answer() {
  const snapshot = makeSnapshot('mismatch'), message = 'Compare the recorded dosage strength in the prescription and invoice';
  const draft = legacy.buildCaseAnswer({ snapshot, message, medicineItemId: snapshot.prescription.medicineItems[0].itemId });
  return prioritizeCaseAnswerSources({ message, answer: legacy.finalizeCaseAnswer({ draft, snapshot, userId: ACTOR,
    secret: 'synthetic-ui-only-secret-at-least-32-characters', now: new Date('2026-11-16T14:00:00Z') }) });
}
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
test('private source panel puts both strength references first and keeps all other citations expandable', () => {
  const value = answer(), html = render(CaseEvidenceSources, { answer: value });
  assert.match(html, /Showing 4 of 10 sources/);
  assert.ok(html.indexOf('Prescription dosage strength') < html.indexOf('Pharmacy Invoice dosage strength'));
  assert.ok(html.indexOf('Pharmacy Invoice dosage strength') < html.indexOf('Prescription medicine name'));
  assert.match(html, /<details/); assert.match(html, /Show 6 additional cited sources/);
  assert.match(html, /No cited evidence has been removed/);
  for (const source of value.sources) assert.ok(html.includes('[' + source.citation + ']'));
  assert.doesNotMatch(html, /pvr1\.|Claim approved|Clinically verified/);
});
test('source cards preserve exact protected field/page links and escape document-supplied text', () => {
  const value = answer(), source = { ...value.sources[0], excerpt: '<img src=x onerror=alert(1)>' };
  const html = render(CaseSourceCards, { caseId: value.caseId, sources: [source] });
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img/);
  assert.ok(html.includes('/cases/' + value.caseId + '?documentId=' + source.documentId + '&amp;fieldId=' + source.fieldId + '&amp;pageNumber=' + source.pageNumber));
  assert.doesNotMatch(html, /objectStorageKey|localPath|bindingToken/);
});
test('one-source and source-free boundary responses never invent additional evidence controls', () => {
  const value = answer();
  for (const count of [0, 1]) {
    const html = render(CaseEvidenceSources, { answer: { ...value, sources: value.sources.slice(0, count) } });
    assert.doesNotMatch(html, /<details|additional cited sources/);
    assert.match(html, new RegExp('Showing ' + count + ' of ' + count));
  }
});
