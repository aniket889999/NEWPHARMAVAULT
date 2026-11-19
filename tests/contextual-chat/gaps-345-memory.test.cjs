'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto'), path = require('node:path');
const { createRequire } = require('node:module'), b = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const memory = b('./services/chatConversationMemoryService'), { resolveContext, findTopics } = b('./services/chatContextService'), { validateInput } = b('./services/chatRagService');
const environment = { JWT_SECRET: 'synthetic-context-secret-32-characters-only' }, user = { _id: 'synthetic-user', organizationId: 'synthetic-org' }, chat = crypto.randomUUID();
const initial = () => memory.snapshotContext(resolveContext('What are Metformin uses and side effects?'));
test('opaque context is user/org/chat bound, not authentication or a readable transcript', () => {
  const token = memory.sealContext(user, chat, initial(), { environment, now: 10000 });
  assert.doesNotMatch(token, /Metformin|metformin|synthetic-user|uses/);
  assert.deepEqual(memory.openContext(user, chat, token, { environment, now: 10001 }).topicIds, ['metformin']);
  for (const [actor,id] of [[{...user,_id:'other'},chat],[{...user,organizationId:'other'},chat],[user,crypto.randomUUID()]]) assert.throws(()=>memory.openContext(actor,id,token,{environment,now:10001}));
});
test('tampered, expired, rotated-key and malformed memory fails closed', () => {
  const token = memory.sealContext(user, chat, initial(), { environment, now: 10000 });
  assert.throws(()=>memory.openContext(user,chat,token,{environment,now:10000+memory.TTL}));
  assert.throws(()=>memory.openContext(user,chat,token,{environment:{JWT_SECRET:'different-synthetic-context-secret-32-characters'},now:10001}));
  for(const value of ['ctx1.a.b.c',token.slice(0,-2)+'xx','x'.repeat(6001)])assert.throws(()=>memory.openContext(user,chat,value,{environment,now:10001}));
});
test('40 follow-ups retain topic, requested attributes and concise preference beyond raw-history window', () => {
  let state = initial();
  for(let index=0;index<40;index++){
    const context=resolveContext('Explain it simply',[],{memory:state});
    assert.equal(context.topics[0].id,'metformin');assert.equal(context.questionPlan.requestedAttributes.length,2);assert.equal(context.style,'CONCISE');
    state=memory.snapshotContext(context);
  }
});
test('explicit topic switch resets old fact intent; same-question transfer preserves it', () => {
  const state=memory.snapshotContext(resolveContext('What are Metformin side effects?'));
  const same=resolveContext('Same question for Cetirizine.',[],{memory:state});assert.equal(same.topics[0].id,'cetirizine');assert.equal(same.questionPlan.attribute,'SIDE_EFFECTS');
  const reset=resolveContext('Now explain Cetirizine.',[],{memory:state});assert.equal(reset.questionPlan.attribute,'GENERAL');
});
test('unresolved private detail cannot become a generic answer in a later follow-up', () => {
  const state=memory.snapshotContext(resolveContext('Does Metformin affect PRIVATE_PERSON_123?'));
  assert.equal(state.unresolvedDetail,true);assert.doesNotMatch(JSON.stringify(state),/PRIVATE_PERSON|private_person|123/);
  assert.equal(resolveContext('Explain it simply',[],{memory:state}).unresolvedDetail,true);
});
test('personal/private scope persists without raw identifiers or assistant medical claims', () => {
  const context=resolveContext('Can I take Metformin while pregnant?');const state=memory.snapshotContext(context);
  assert.equal(resolveContext('What about it?',[],{memory:state}).personalContext,true);
  assert.doesNotMatch(JSON.stringify(state),/pregnant|history|message|answer/);
  const forged={...initial(),topicIds:['not-registered']};assert.equal(memory.sanitizeState(forged),null);
});
test('session context fields are validated and cannot attach to a private case', () => {
  assert.equal(validateInput({message:'hello',contextId:chat}).contextId,chat);
  for(const value of [{message:'hello',contextId:'bad'},{message:'hello',contextToken:'x'},{message:'hello',serverMemory:initial()},{message:'hello',caseId:'650000000000000000000001',contextId:chat}])assert.throws(()=>validateInput(value));
});
test('official longest-name match does not confuse a more specific topic with its shorter alias', () => {
  const registry=b('./data/chatTopicRegistry'),specific=registry.find(value=>value.id.startsWith('nhs-amitriptyline-for-pain'));
  assert.ok(specific);const found=findTopics('Explain '+specific.label+'.');assert.deepEqual(found.map(value=>value.id),[specific.id]);
  assert.equal(findTopics(specific.label+' and Metformin.').length,2);
  assert.deepEqual(findTopics('What is Paracetamol used for?').map(value=>value.id),['paracetamol']);
  assert.deepEqual(findTopics('Explain Paracetamol for children.').map(value=>value.id),['nhs-paracetamol-for-children']);
});
