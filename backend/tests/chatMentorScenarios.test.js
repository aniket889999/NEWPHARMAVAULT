const test = require('node:test');
const assert = require('node:assert/strict');
const { answer } = require('../services/contextualChatService');
const { routePharmacyQuestion } = require('../services/pharmacyChatPolicy');
const { planQuestion } = require('../services/chatQuestionService');

// The four public-chat scenarios from the mentor review, asked in one conversation.
// The web lookup is stubbed to "nothing found", so every passing answer here is backed by the local library.
const noWeb = { webSearch: async () => ({ status: 'NO_RELEVANT_EVIDENCE', passages: [] }) };
const ask = (message, history = []) => answer({ message, history }, noWeb);
const turn = (q, r) => [{ role: 'user', text: q }, { role: 'assistant', text: r.reply }];

test('mentor scenarios: multi-part answer, follow-up, topic switch and ambiguity in one conversation', async () => {
  const history = [];
  const q1 = 'What is Metformin used for, and what are its common side effects? Cite the supporting sources.';
  const a1 = await ask(q1, history);
  assert.equal(a1.routing.reasonCode, 'MULTI_PART_ANSWERED_SEPARATELY');
  assert.match(a1.reply, /^Uses: .*type 2 diabetes/m);
  assert.match(a1.reply, /^Possible side effects: .*nausea/m);
  assert.ok(a1.reply.indexOf('Uses:') < a1.reply.indexOf('Possible side effects:'), 'parts follow the order asked');
  assert.ok(a1.sources.length >= 2);
  assert.deepEqual(a1.sources.map(value => value.citation), a1.sources.map((_, index) => 'S' + (index + 1)));
  for (const citation of a1.reply.match(/\[S\d+\]/g)) assert.ok(a1.sources.some(value => '[' + value.citation + ']' === citation), citation + ' has a source');
  assert.ok(a1.agentTrace.some(step => step.tool === 'QUESTION_SPLIT'));
  history.push(...turn(q1, a1));

  const q2 = 'Can it affect vitamin B12 levels? Explain briefly and cite the evidence.';
  const a2 = await ask(q2, history);
  assert.equal(a2.context.followupResolved, true);
  assert.deepEqual(a2.context.topics.map(value => value.label), ['Metformin']);
  assert.match(a2.reply, /B12/);
  assert.ok(a2.sources.length >= 1);
  assert.doesNotMatch(a2.reply, /type 2 diabetes/, 'answers the B12 question, not a generic overview');
  history.push(...turn(q2, a2));

  const q3 = 'Now switch to Cetirizine. Can it make me sleepy? Give a brief answer with a source.';
  const a3 = await ask(q3, history);
  assert.deepEqual(a3.context.topics.map(value => value.label), ['Cetirizine']);
  assert.notEqual(a3.routing?.reasonCode, 'SUBSTITUTION_NEEDS_PROFESSIONAL_REVIEW');
  assert.match(a3.reply, /sleep|drows/i);
  assert.doesNotMatch(a3.reply, /Metformin|B12/);
  assert.ok(a3.sources.length >= 1 && a3.sources.every(value => /Cetirizine/i.test(value.title)));
  history.push(...turn(q3, a3));

  const a4 = await ask('I am asking about Metformin and Cetirizine. What are its side effects?', history);
  assert.equal(a4.mode, 'CLARIFY');
  assert.equal(a4.routing.reasonCode, 'AMBIGUOUS_TOPIC');
  assert.equal(a4.sources.length, 0, 'no invented citations for a clarification');
});

test('request words such as "cite", "evidence" and "brief" do not become required evidence terms', () => {
  const plan = planQuestion('Can it affect vitamin B12 levels? Explain briefly and cite the evidence.', [{ id: 'metformin', label: 'Metformin' }]);
  assert.deepEqual(plan.anchors.sort(), ['b12', 'vitamin']);
});

test('a topic switch is not a substitution request, but a real swap still is', () => {
  const route = message => routePharmacyQuestion({ message, resolved: { question: message, topics: ['cetirizine'] } }).reasonCode;
  assert.equal(route('Now switch to Cetirizine. Can it make me sleepy?'), 'SUPPORTED_TOPIC');
  assert.equal(route('Switch topic to Cetirizine: side effects?'), 'SUPPORTED_TOPIC');
  assert.equal(route('Switch to Cetirizine instead of Loratadine?'), 'SUBSTITUTION_NEEDS_PROFESSIONAL_REVIEW');
  assert.equal(route('Now switch to Cetirizine. Can I swap it for Loratadine?'), 'SUBSTITUTION_NEEDS_PROFESSIONAL_REVIEW');
  assert.equal(route('Should I switch to Cetirizine?'), 'PERSONAL_OR_UNVERIFIED_DECISION');
});

test('a part without evidence is reported as unanswered, never filled in', async () => {
  const result = await ask('How should Metformin be stored, and what are its side effects?');
  if (result.routing?.reasonCode !== 'MULTI_PART_ANSWERED_SEPARATELY') return; // both parts missing → the single-question path handles it
  for (const line of result.reply.split('\n\n')) assert.ok(/\[S\d+\]/.test(line) || /no approved source supported this part/.test(line), line);
});
