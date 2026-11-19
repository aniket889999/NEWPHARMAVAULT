'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { validatePack, scoreItem, checkFreeze } = require('../scripts/evaluate-chatbot-reference.cjs');
const dataset = require('../docs/chatbot-reference-standard/v1/benchmark.json');
const catalog = require('../docs/chatbot-reference-standard/v1/source-catalog.json');
const fixtures = require('../docs/chatbot-reference-standard/v1/case-fixtures.json');
const freeze = require('../docs/chatbot-reference-standard/v1/freeze.json');
const result = require('../docs/chatbot-reference-standard/v1/RESULTS.json');
const copy = value => structuredClone(value);
test('100 labelled scenarios in 50 exposed families have resolvable evidence', () => {
  const value = validatePack(dataset, catalog, fixtures); assert.equal(value.items,100); assert.equal(value.families,50); assert.equal(value.facts,12);
});
test('expected-label/source hashes remain unchanged after application improvements', () => assert.equal(checkFreeze(freeze,{referenceOnly:true}),true));
test('duplicate item identifiers are rejected', () => { const d=copy(dataset); d.items[1].id=d.items[0].id; assert.throws(()=>validatePack(d,catalog,fixtures)); });
test('unknown answer facts are rejected', () => { const d=copy(dataset); d.items[0].expected.requiredFactIds=['INVENTED']; assert.throws(()=>validatePack(d,catalog,fixtures)); });
test('invented human review approval is rejected', () => { const d=copy(dataset); d.items[0].review.reviewerId='invented-reviewer'; assert.throws(()=>validatePack(d,catalog,fixtures)); });
test('exposed items cannot be relabelled unseen heldout', () => { const d=copy(dataset); d.items[0].split='HELDOUT'; assert.throws(()=>validatePack(d,catalog,fixtures)); });
test('malformed grading patterns are rejected', () => { const c=copy(catalog); c.facts[0].patterns=['(']; assert.throws(()=>validatePack(dataset,c,fixtures)); });
test('changed reference hashes fail closed even when comparing a new candidate', () => { const f=copy(freeze); f.referenceSha256['docs/chatbot-reference-standard/v1/benchmark.json']='0'.repeat(64); assert.throws(()=>checkFreeze(f,{referenceOnly:true})); });
const first = dataset.items[0], source = catalog.sources.find(s=>s.key==='nhs-paracetamol-overview');
function example() { return { mode:'PRECISE_LOCAL_EVIDENCE', reply:source.excerpt+' [S1]', sources:[{citation:'S1',sourceId:source.id,sourceUrl:source.sourceUrl,version:source.version,excerpt:source.excerpt,kind:source.kind}], context:{topics:[{id:'paracetamol'}]} }; }
test('known supported fact and original source pass the engineering scorer', () => { assert.equal(scoreItem(first,example(),{webCalls:0,permittedSources:catalog.sources},catalog).pass,true); });
test('a plausible answer with a forged source ID fails', () => { const a=example(); a.sources[0].sourceId='invented'; assert.equal(scoreItem(first,a,{webCalls:0,permittedSources:catalog.sources},catalog).pass,false); });
test('a real source without its required citation marker fails', () => { const a=example(); a.reply=source.excerpt; assert.equal(scoreItem(first,a,{webCalls:0,permittedSources:catalog.sources},catalog).pass,false); });
test('an abstain label cannot hide an explicit numeric regimen', () => { const i=dataset.items.find(i=>i.name==='personal dose'); const a={mode:'ABSTAIN',reply:'Take 2 tablets.',sources:[]}; assert.equal(scoreItem(i,a,{webCalls:0,permittedSources:[]},catalog).pass,false); });
test('an outcome label without an actual response fails', () => { const i=dataset.items.find(i=>i.name==='personal dose'); assert.equal(scoreItem(i,{mode:'ABSTAIN',reply:'',sources:[]},{webCalls:0,permittedSources:[]},catalog).pass,false); });
test('rendered review-action text accepts Markdown escapes, not missing actions', () => {
  const i=dataset.items.find(i=>i.id==='F44-01');
  const context={webCalls:0,snapshot:fixtures.snapshots.mismatch};
  const a={mode:'LOCAL_CASE_EVIDENCE',reply:'Allowed: RETURN\\_FOR\\_CORRECTION, ESCALATE [S1]',sources:[{citation:'S1',sourceId:'case:synthetic',fieldId:null}]};
  assert.equal(scoreItem(i,a,context,catalog).pass,true);
  a.reply='Allowed: ESCALATE [S1]'; assert.equal(scoreItem(i,a,context,catalog).pass,false);
});
test('published engineering results retain failures and never claim clinical accuracy', () => {
  assert.equal(result.itemResults.passed,92);assert.equal(result.itemResults.total,100);
  assert.equal(result.rows.filter(r=>!r.pass).length,8);assert.equal(result.humanClinicalGrades,'NOT_PERFORMED');assert.equal(result.superiorityClaim,false);assert.equal(result.egressAttempts,0);
});
