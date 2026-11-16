'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadClient } = require('./load-client.cjs');
const f = require('./client-fixtures.cjs');
const contract = loadClient('src/features/caseAssistant/contract.ts');
const { createCaseAssistantApi } = loadClient('src/features/caseAssistant/api.ts');
const { resolveCaseSourceQuery } = loadClient('src/features/caseAssistant/sourceTarget.ts');
const receipt = a => [{ answerId: a.answerId, bindingToken: a.bindingToken }];
test('authored development answer decodes with exact case, item and source bindings', () => {
  assert.ok(contract.parseCaseAnswer(f.answer(), f.CASE, f.ITEM));
});
const answerMutations = {
  foreignCase: a => { a.caseId = 'f'.repeat(24); }, unknownSchema: a => { a.schemaVersion = 'future'; },
  storageIdentifier: a => { a.objectStorageKey = 'private/path'; }, forgedClaim: a => { a.verified = true; },
  futureMode: a => { a.mode = 'VERIFIED'; }, wrongItem: a => { a.medicineItemId = 'mi_' + '1'.repeat(24); },
  wrongSourceItem: a => { a.sources[0].itemId = 'mi_' + '1'.repeat(24); }, missingReceipt: a => { a.bindingToken = null; },
  missingDependency: a => { a.dependencyKeys = []; }, duplicateDependencies: a => { a.dependencyKeys.push(a.dependencyKeys[0]); },
  fakeCitation: a => { a.reply += ' [S99]'; }, unusedCitation: a => { a.reply = 'Uncited text'; },
  pathInSource: a => { a.sources[0].localPath = '/private/file'; }, sourceUrl: a => { a.sources[0].sourceUrl = 'https://attacker.invalid'; },
  missingFingerprint: a => { a.sources[0].fingerprint = ''; }, fakePage: a => { a.sources[0].pageNumber = 0; },
  missingPage: a => { a.sources[0].pageNumber = null; }, noDocument: a => { a.sources[0].documentId = null; },
  duplicateSource: a => { a.sources.push({ ...a.sources[0], citation: 'S2' }); a.reply += ' [S2]'; },
  invalidTime: a => { a.generatedAt = 'today'; }, negativeRevision: a => { a.evidenceRevision = -1; },
  tooManyChoices: a => { a.choices = Array(7).fill(a.choices[0]); }, claimPretendsMedicine: a => { a.choices[0].documentType = 'CLAIM_FORM'; },
  unclearWithEvidence: a => { a.mode = 'CLARIFY'; },
};
for (const [name, change] of Object.entries(answerMutations)) test('answer fails closed: ' + name, () => {
  const a = f.answer(); change(a); assert.equal(contract.parseCaseAnswer(a, f.CASE, f.ITEM), null);
});
test('clarification has choices but never a source, receipt or freshness assertion', () => {
  const a = f.answer(); Object.assign(a, { mode: 'CLARIFY', medicineItemId: null, reply: 'Which medicine?', sources: [], dependencyKeys: [], bindingToken: null });
  assert.ok(contract.parseCaseAnswer(a, f.CASE)); a.bindingToken = 'fake'; assert.equal(contract.parseCaseAnswer(a, f.CASE), null);
});
test('foreign expected scope and unexpected explicit medicine are rejected', () => {
  assert.equal(contract.parseCaseAnswer(f.answer(), 'f'.repeat(24)), null);
  assert.equal(contract.parseCaseAnswer(f.answer(), f.CASE, 'mi_' + '1'.repeat(24)), null);
});
test('freshness maps every requested receipt exactly once', () => {
  const a = f.answer(); assert.ok(contract.parseFreshnessResponse(f.freshness(a), f.CASE, receipt(a)));
  assert.ok(contract.parseFreshnessResponse(f.freshness(a, 'STALE'), f.CASE, receipt(a)));
  assert.ok(contract.parseFreshnessResponse(f.freshness(a, 'UNVERIFIABLE'), f.CASE, receipt(a)));
});
const freshnessMutations = {
  otherCase: r => { r.caseId = 'f'.repeat(24); }, absentResult: r => { r.results = []; },
  foreignAnswer: r => { r.results[0].answerId = '22222222-2222-4222-8222-222222222222'; },
  repeatedResult: r => { r.results.push(r.results[0]); }, fakeConfidence: r => { r.confidence = 1; },
  freshButChanged: r => { r.results[0].changedDependencyKeys = ['field:changed']; },
  freshButExpired: r => { r.results[0].reasonCode = 'RECEIPT_EXPIRED'; },
  staleButUnchanged: r => { r.results[0].status = 'STALE'; },
  invalidStatus: r => { r.results[0].status = 'VERIFIED'; },
  processingButFresh: r => { r.results[0].reasonCode = 'CASE_PROCESSING'; },
  badTime: r => { r.checkedAt = 'yesterday'; },
};
for (const [name, change] of Object.entries(freshnessMutations)) test('freshness fails closed: ' + name, () => {
  const a = f.answer(), r = f.freshness(a); change(r);
  assert.equal(contract.parseFreshnessResponse(r, f.CASE, receipt(a)), null);
});
test('API forwards bounded payload and cancellation, never caller history/role/evidence', async () => {
  const calls = [], signal = new AbortController().signal, a = f.answer();
  const api = createCaseAssistantApi({ post: async (...args) => { calls.push(args); return { data: calls.length === 1 ? a : f.freshness(a) }; } });
  await api.answer(f.CASE, '  recorded strength?  ', f.ITEM, signal);
  await api.checkFreshness(f.CASE, [{ ...receipt(a)[0], role: 'admin', dependencies: ['forged'] }], signal);
  assert.equal(calls[0][0], '/v1/cases/' + f.CASE + '/assistant/answers');
  assert.deepEqual(calls[0][1], { message: 'recorded strength?', medicineItemId: f.ITEM });
  assert.deepEqual(calls[1][1], { receipts: receipt(a) }); assert.equal(calls[0][2].signal, signal);
});
test('invalid scope/receipt never reaches transport and raw provider errors never reach UI', async () => {
  let calls = 0; const api = createCaseAssistantApi({ post: async () => { calls++; throw new Error('/private/path/SENSITIVE'); } });
  await assert.rejects(api.answer('../other', 'x'), /valid case/);
  await assert.rejects(api.checkFreshness(f.CASE, [{ answerId: 'bad', bindingToken: 'x' }]), /Invalid evidence/);
  assert.equal(calls, 0);
  await assert.rejects(api.answer(f.CASE, 'x'), e => !e.message.includes('SENSITIVE') && /unavailable/.test(e.message));
});
test('source URL targets exact same-case field and page, never first document by type', () => {
  const a = f.answer(), href = contract.caseSourceHref(f.CASE, a.sources[0]), params = new URL(href, 'http://synthetic.invalid').searchParams;
  const documents = [{ id: '9'.repeat(24), caseId: f.CASE, type: 'PRESCRIPTION', pageCount: 2 }, { id: f.DOC, caseId: f.CASE, type: 'PRESCRIPTION', pageCount: 2 }];
  const fields = [{ id: f.FIELD, caseId: f.CASE, documentId: f.DOC, pageNumber: 1 }];
  assert.equal(resolveCaseSourceQuery(f.CASE, params, documents, fields).documentId, f.DOC);
  assert.equal(resolveCaseSourceQuery('f'.repeat(24), params, documents, fields), 'INVALID');
  assert.equal(resolveCaseSourceQuery(f.CASE, params, documents, []), 'INVALID');
  params.set('pageNumber', '2'); assert.equal(resolveCaseSourceQuery(f.CASE, params, documents, fields), 'INVALID');
});
test('source query rejects duplicate or malformed parameters and unknown sources', () => {
  assert.equal(resolveCaseSourceQuery(f.CASE, new URLSearchParams(), [], []), null);
  for (const query of ['documentId=../../secret', 'pageNumber=NaN', 'documentId=' + f.DOC + '&documentId=' + f.DOC + '&fieldId=' + f.FIELD + '&pageNumber=1']) {
    assert.equal(resolveCaseSourceQuery(f.CASE, new URLSearchParams(query), [], []), 'INVALID');
  }
});
