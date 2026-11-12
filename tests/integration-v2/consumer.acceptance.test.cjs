'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadClient, apiAlias } = require('./load-client.cjs');
const { makeSnapshot, documentMetadata, clone, TOKEN, ACTOR } = require('./synthetic-snapshots.cjs');
const { parseCaseSnapshot, buildGroupingRequest, createGroupingDraft, candidateNeedsCorrection, canSubmitAction, buildReviewRequest, isCorrectionRole, safeApiMessage } = loadClient('integration/snapshot.ts');
const { createLatestRequestGuard } = loadClient('integration/latestRequest.ts');
const { resolveEvidenceSource } = loadClient('integration/sourceSelection.ts');
const { CaseReconciliationWorkspace } = loadClient('integration/CaseReconciliationWorkspace.tsx');
const { createIntegrationApi } = loadClient('integration/api.ts', apiAlias);
const { verificationApi } = loadClient('api/verificationApi.ts', apiAlias);
const { ExtractedFieldsEditor } = loadClient('components/ExtractedFieldsEditor.tsx', apiAlias);
const { DocumentEvidenceViewer, hasValidBoundingBox } = loadClient('components/DocumentEvidenceViewer.tsx', apiAlias);
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const workspace = (snapshot, role = 'patient') => render(CaseReconciliationWorkspace, { caseId: snapshot.caseId, snapshot, role, loading: false, busy: false, error: null, onRefresh() {}, onOpenFields() {}, onInspect() {}, async onConfirm() {} });

for (const kind of ['consistent', 'mismatch', 'pack', 'unknownPack', 'incomplete', 'missingInvoice']) test(`accepts linked authored ${kind} snapshot (not an API/clinical score)`, () => {
  const snapshot = makeSnapshot(kind); assert.ok(parseCaseSnapshot(snapshot, snapshot.caseId));
});

for (const [label, mutate] of [
  ['foreign selected case', value => { value.caseId = 'b'.repeat(24); }],
  ['unknown schema', value => { value.schemaVersion = 'future'; }],
  ['missing snapshot token', value => { delete value.snapshotToken; }],
  ['malformed token', value => { value.snapshotToken = 'anything'; }],
  ['negative revision', value => { value.evidenceRevision = -1; }],
  ['storage key on root', value => { value.objectStorageKey = 'private'; }],
  ['storage metadata on doc', value => { value.groupingDocuments[0].metadata = {}; }],
  ['foreign candidate document', value => { value.groupingDocuments[0].fields[0].documentId = 'b'.repeat(24); }],
  ['foreign candidate case', value => { value.groupingDocuments[0].fields[0].caseId = 'b'.repeat(24); }],
  ['fake candidate confidence', value => { value.groupingDocuments[0].fields[0].extractionConfidence = 1.1; }],
  ['omitted explicit uncertainty', value => { value.groupingDocuments[0].fields[0].needsCorrection = true; }],
  ['changed correction actor', value => { value.groupingDocuments[0].fields[0].correctedBy = ACTOR; }],
  ['conflicting candidate text', value => { value.groupingDocuments[0].fields[0].normalizedValue = 'invented'; }],
  ['foreign group member', value => { value.groupingDocuments[0].groups[0].fieldIds.push('b'.repeat(24)); }],
  ['duplicate group member', value => { const group = value.groupingDocuments[0].groups[0]; group.fieldIds.push(group.anchorFieldId); }],
  ['unattested human grouping', value => { value.groupingDocuments[0].confirmedAt = null; }],
  ['wrong visible item count', value => { value.groupingDocuments[0].observedItemCount = 3; }],
  ['unconfirmed Verify', value => { value.groupingDocuments[0].mode = 'AUTO_PROPOSED'; }],
  ['unfinished extraction Verify', value => { value.groupingDocuments[0].processingStatus = 'EXTRACTING'; }],
  ['finalised case still reviewable', value => { value.caseStatus = 'VERIFIED'; }],
  ['blockers alongside Verify', value => { value.reviewEligibility.blockerCodes = ['FIELD_CORRECTION_REQUIRED']; }],
  ['disabled Verify still allowed', value => { value.reviewEligibility.canVerify = false; }],
  ['non-reviewer allowed actions', value => { value.permissions.canReview = false; }],
  ['unknown blocker', value => { value.reviewEligibility.blockerCodes = ['CLAIM_APPROVED']; }],
  ['legacy output declared current', value => { value.legacyFindingsCurrent = true; }],
]) test(`fails closed on ${label}`, () => { const snapshot = makeSnapshot(); const selectedCase = snapshot.caseId; mutate(snapshot); assert.equal(parseCaseSnapshot(snapshot, selectedCase), null); });

test('an unavailable comparison is explicit, with no fabricated source envelopes', () => {
  const snapshot = makeSnapshot(); snapshot.comparison = null; snapshot.prescription = null; snapshot.invoice = null;
  snapshot.reviewEligibility = { canVerify: false, blockerCodes: ['MULTIPLE_DOCUMENTS_UNSUPPORTED'], allowedActions: ['RETURN_FOR_CORRECTION', 'ESCALATE'] };
  assert.ok(parseCaseSnapshot(snapshot, snapshot.caseId)); snapshot.reviewEligibility.blockerCodes = []; assert.equal(parseCaseSnapshot(snapshot, snapshot.caseId), null);
});
test('client parsing and grouping do not mutate response inputs', () => {
  const snapshot = makeSnapshot('pack'); const before = clone(snapshot); parseCaseSnapshot(snapshot, snapshot.caseId); createGroupingDraft(snapshot.groupingDocuments[0]); assert.deepEqual(snapshot, before);
});
test('group confirmation is never pre-attested and emits source references only', () => {
  const doc = makeSnapshot('pack').groupingDocuments[0]; const draft = createGroupingDraft(doc);
  assert.equal(draft.completenessAttested, false); assert.equal(buildGroupingRequest(doc, draft, TOKEN).payload, null);
  draft.completenessAttested = true; const { payload } = buildGroupingRequest(doc, draft, TOKEN);
  assert.ok(payload); assert.deepEqual(Object.keys(payload).sort(), ['completenessAttested', 'groups', 'observedItemCount', 'snapshotToken']); assert.equal(payload.groups.length, 3);
  assert.doesNotMatch(JSON.stringify(payload), /rawValue|normalizedValue|userRole|organizationId|confidence/);
});
for (const [label, mutate] of [
  ['unassigned field', (doc, draft) => { draft.assignments[doc.fields[1].id] = ''; }],
  ['foreign row anchor', (doc, draft) => { draft.assignments[doc.fields[1].id] = 'b'.repeat(24); }],
  ['name moved to other row', (doc, draft) => { const name = doc.fields.find(field => field.fieldType === 'medicine_name'); draft.assignments[name.id] = 'b'.repeat(24); }],
  ['wrong count', (_doc, draft) => { draft.observedItemCount = 2; }],
  ['fourth row', (_doc, draft) => { draft.observedItemCount = 4; }],
]) test(`blocks grouping with ${label}`, () => { const doc = makeSnapshot('pack').groupingDocuments[0]; const draft = createGroupingDraft(doc); draft.completenessAttested = true; mutate(doc, draft); assert.equal(buildGroupingRequest(doc, draft, TOKEN).payload, null); });
test('low confidence, partial correction and an explicit flag remain conservative', () => {
  const field = makeSnapshot().groupingDocuments[0].fields[0]; field.extractionConfidence = 0.3; assert.equal(candidateNeedsCorrection(field), true);
  field.correctedAt = '2026-11-12T08:00:00Z'; assert.equal(candidateNeedsCorrection(field), true);
  field.correctedBy = ACTOR; assert.equal(candidateNeedsCorrection(field), false);
  field.needsCorrection = true; assert.equal(candidateNeedsCorrection(field), true);
  field.needsCorrection = false; field.extractionConfidence = null; assert.equal(candidateNeedsCorrection(field), true);
});
test('Verify cannot bypass a mismatch; Return/Escalate remain available', () => {
  const snapshot = makeSnapshot('mismatch'); assert.equal(buildReviewRequest(snapshot, 'pharmacist', 'VERIFY', 'OK', 'Inspected original evidence'), null);
  for (const action of ['RETURN_FOR_CORRECTION', 'ESCALATE']) assert.equal(buildReviewRequest(snapshot, 'claims_reviewer', action, 'SOURCE_ISSUE', 'Inspected the original source').snapshotToken, TOKEN);
});
test('patient, evaluator, doctor and generic admin have no reviewer/correction actions', () => {
  for (const role of ['patient', 'research_evaluator', 'doctor', 'admin', undefined]) { assert.equal(isCorrectionRole(role), false); assert.equal(canSubmitAction(makeSnapshot(), role, 'VERIFY'), false); }
  assert.equal(isCorrectionRole('super_admin'), false); assert.equal(canSubmitAction(makeSnapshot(), 'super_admin', 'VERIFY'), true);
});
test('review requires meaningful bounded notes and the displayed token', () => {
  const snapshot = makeSnapshot(); for (const notes of [' ', 'tiny', 'x'.repeat(2001)]) assert.equal(buildReviewRequest(snapshot, 'org_admin', 'VERIFY', 'CONFIRMED', notes), null);
  assert.equal(buildReviewRequest(snapshot, 'org_admin', 'VERIFY', 'CONFIRMED', '  All source fields inspected.  ').snapshotToken, TOKEN);
});
test('late results from an old case, refresh or unmount cannot replace a newer request', async () => {
  const guard = createLatestRequestGuard(); const old = guard.begin(); const current = guard.begin();
  assert.equal(guard.isCurrent(old), false); assert.equal(guard.isCurrent(current), true);
  guard.invalidate(); assert.equal(guard.isCurrent(current), false);
});
test('source opening is exact-document/page, not first matching document type', () => {
  const snapshot = makeSnapshot(); const docs = documentMetadata(snapshot); const source = docs[0];
  const other = { ...source, id: 'b'.repeat(24) }; docs.unshift(other);
  const reference = { documentId: source.id, fieldId: snapshot.groupingDocuments[0].fields[0].id, pageNumber: 2 };
  assert.equal(resolveEvidenceSource(snapshot.caseId, docs, reference).documentId, source.id);
  assert.equal(resolveEvidenceSource(snapshot.caseId, docs, reference).pageNumber, 2);
  assert.equal(resolveEvidenceSource('c'.repeat(24), docs, reference), null);
  reference.pageNumber = 4; assert.equal(resolveEvidenceSource(snapshot.caseId, docs, reference).previewAvailable, false);
});
test('GET validates case scope and forwards cancellation without a request-side role', async () => {
  const snapshot = makeSnapshot(); const calls = []; const controller = new AbortController();
  const api = createIntegrationApi({ async get(...args) { calls.push(args); return { data: snapshot }; }, async put() { throw new Error('Unexpected mutation'); } });
  assert.equal((await api.getSnapshot(snapshot.caseId, controller.signal)).caseId, snapshot.caseId);
  assert.equal(calls[0][0], '/v1/cases/' + snapshot.caseId + '/reconciliation'); assert.equal(calls[0][1].signal, controller.signal);
  await assert.rejects(api.getSnapshot('../other')); assert.equal(calls.length, 1);
});
test('PUT preserves the displayed stale token for server conflict detection; never pre-fetches', async () => {
  const snapshot = makeSnapshot(); const doc = snapshot.groupingDocuments[0]; const draft = createGroupingDraft(doc); draft.completenessAttested = true;
  const payload = buildGroupingRequest(doc, draft, TOKEN).payload; let gets = 0; const calls = [];
  const api = createIntegrationApi({ async get() { gets++; throw new Error('Must not silently refresh'); }, async put(...args) { calls.push(args); throw { response: { data: { code: 'STALE_REVIEW_SNAPSHOT', message: '/private/patient.txt' } } }; } });
  await assert.rejects(api.confirmGroups(snapshot.caseId, doc.documentId, payload)); assert.equal(gets, 0); assert.equal(calls[0][1].snapshotToken, TOKEN);
});
test('existing correction and review clients send the displayed token in bounded payloads', async () => {
  const calls = []; global.__session3Transport = { async patch(...args) { calls.push(args); return { data: {} }; }, async post(...args) { calls.push(args); return { data: {} }; } };
  const snapshot = makeSnapshot(); const field = snapshot.groupingDocuments[0].fields[0];
  await verificationApi.correctExtractedField(snapshot.caseId, field.id, 'source correction', TOKEN);
  await verificationApi.submitReview(snapshot.caseId, buildReviewRequest(snapshot, 'pharmacist', 'VERIFY', 'SOURCE_CHECKED', 'Compared the original sources.'));
  assert.deepEqual(calls[0][1], { normalizedValue: 'source correction', snapshotToken: TOKEN }); assert.equal(calls[1][1].snapshotToken, TOKEN); delete global.__session3Transport;
});
test('errors show safe fixed text, never raw patient/server paths', () => {
  for (const code of ['STALE_REVIEW_SNAPSHOT', 'CASE_BUSY', 'REVIEW_BLOCKED', 'OTHER']) assert.doesNotMatch(safeApiMessage({ response: { data: { code, message: '/private/patient.txt', detail: 'private' } } }), /private|patient.txt/);
});
test('patient workspace is read-only; authorised staff can confirm grouping', () => {
  const snapshot = makeSnapshot(); const patient = workspace(snapshot); const staff = workspace(snapshot, 'pharmacist');
  assert.match(patient, /Read-only/); assert.doesNotMatch(patient, /Confirm source grouping/); assert.match(staff, /Confirm source grouping/); assert.match(staff, /not clinical approval/);
});
test('mismatch and uncertain comparison do not render a Verify button', () => {
  const snapshot = makeSnapshot('mismatch'); const html = workspace(snapshot, 'pharmacist'); assert.match(html, /Verification is blocked/); assert.match(html, /Difference found/); assert.doesNotMatch(html, /Record human decision/);
});
test('unavailable integration renders a limitation, not successful legacy results', () => {
  const snapshot = makeSnapshot(); const html = render(CaseReconciliationWorkspace, { caseId: snapshot.caseId, snapshot: null, role: 'patient', loading: false, busy: false, error: 'Backend unavailable.', onRefresh() {}, onOpenFields() {}, onInspect() {}, async onConfirm() {} });
  assert.match(html, /Historical findings below must not be used/); assert.doesNotMatch(html, /Checked fields agree/);
});
test('field editor shows unknown confidence instead of an invented 90 percent', () => {
  const snapshot = makeSnapshot(); const field = { ...snapshot.groupingDocuments[0].fields[0], documentType: 'PRESCRIPTION', extractionConfidence: null };
  const html = render(ExtractedFieldsEditor, { caseId: snapshot.caseId, fields: [field], canEdit: false, snapshotToken: TOKEN });
  assert.match(html, /unknown/); assert.doesNotMatch(html, /90%|>Edit</);
});
test('viewer rejects invalid coordinates and renders only the exact same-case source fields', () => {
  for (const bbox of [null, [0,0,0,0], [-1,0,1,1], [0,0,2,1], [0,0,Infinity,1], [0,0,0,1]]) assert.equal(hasValidBoundingBox(bbox), false);
  assert.equal(hasValidBoundingBox([0.1,0.2,0.3,0.4]), true);
  const snapshot = makeSnapshot(); const docs = documentMetadata(snapshot); const first = docs[0]; const second = { ...first, id: 'b'.repeat(24) };
  const field = { ...snapshot.groupingDocuments[0].fields[0], documentType: 'PRESCRIPTION', rawValue: 'EXACT-SOURCE-VALUE', normalizedValue: 'EXACT-SOURCE-VALUE' };
  const other = { ...field, id: 'c'.repeat(24), documentId: second.id, rawValue: 'WRONG-SOURCE-VALUE', normalizedValue: 'WRONG-SOURCE-VALUE' };
  const html = render(DocumentEvidenceViewer, { caseId: snapshot.caseId, documents: [second, ...docs], extractedFields: [field, other], initialDocumentId: first.id });
  assert.match(html, /EXACT-SOURCE-VALUE/); assert.doesNotMatch(html, /WRONG-SOURCE-VALUE|Teal: Verified/);
});
