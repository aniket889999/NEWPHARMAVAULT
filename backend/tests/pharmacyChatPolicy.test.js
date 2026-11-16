const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/conversationalRagService');
const { routePharmacyQuestion } = require('../services/pharmacyChatPolicy');

const route = (message, history = []) => routePharmacyQuestion({ message, resolved: service.resolveQuestion(message, history) });

for (const [name, message, intent, reason] of [
  ['domain greeting', 'hello', 'WORKFLOW_HELP', 'GREETING'],
  ['polite acknowledgement', 'thanks', 'WORKFLOW_HELP', 'ACKNOWLEDGEMENT'],
  ['medicine education', 'What is Paracetamol used for?', 'MEDICINE_EDUCATION', 'SUPPORTED_TOPIC'],
  ['workflow support', 'Explain human-in-the-loop validation', 'WORKFLOW_HELP', 'PROJECT_OR_DOCUMENT_EVIDENCE'],
  ['case selection', 'Why is my case flagged?', 'CASE_DOCUMENT_QUERY', 'CASE_SELECTION_REQUIRED'],
  ['brand ambiguity', 'Compare Dolo and Crocin', 'MEDICINE_IDENTITY', 'AMBIGUOUS_BRAND'],
  ['identity route', 'What is the generic name of Dolo 650 mg Tablet?', 'MEDICINE_IDENTITY', 'IDENTITY_LOOKUP'],
  ['comparison scope', 'Compare Paracetamol and Metformin', 'MEDICINE_IDENTITY', 'COMPARISON_SCOPE_NEEDED'],
  ['substitution boundary', 'Can I replace this medicine with another one?', 'MEDICINE_IDENTITY', 'SUBSTITUTION_NEEDS_PROFESSIONAL_REVIEW'],
  ['personal prescribing', 'Recommend the best medicine for my fever', 'CLINICAL_REFERRAL', 'PERSONAL_OR_UNVERIFIED_DECISION'],
  ['veterinary exclusion', 'Can my dog use Paracetamol?', 'CLINICAL_REFERRAL', 'HUMAN_REFERENCE_NOT_VETERINARY'],
  ['explicit off-topic', 'Write Python code for an inventory app', 'OUT_OF_DOMAIN', 'OUTSIDE_PHARMACY_SCOPE'],
  ['breathing emergency', 'I am unable to breathe', 'EMERGENCY', 'URGENT_SYMPTOMS'],
  ['excess-intake emergency', 'I took too much Paracetamol', 'EMERGENCY', 'URGENT_SYMPTOMS'],
  ['unknown reference', 'What are the side effects of UnknownDrug?', 'MEDICINE_EDUCATION', 'REFERENCE_OR_MEDICINE_NAME_NEEDED'],
  ['unknown identity', 'What is the generic name of UnknownDrug?', 'MEDICINE_IDENTITY', 'IDENTITY_REFERENCE_NOT_RESOLVED'],
]) test(`Pharmacy routing: ${name}`, () => {
  const result = route(message);
  assert.equal(result.intent, intent);
  assert.equal(result.reasonCode, reason);
  assert.equal(result.policyVersion, 'pharmacy-domain-v1');
});

test('new unrelated topic does not inherit a medicine from conversation history', async () => {
  const result = await service.answer({ message: 'Why is the stock market down?', history: [{ role: 'user', text: 'What is Paracetamol?' }] }, {
    retrieve: async () => { throw new Error('Must not retrieve for an unrelated topic'); }
  });
  assert.equal(result.routing.intent, 'OUT_OF_DOMAIN');
  assert.equal(result.mode, 'ABSTAIN');
  assert.equal(result.sources.length, 0);
});

test('clarification is returned before retrieval or cloud generation', async () => {
  let calls = 0;
  for (const message of ['Why is my invoice different?', 'Compare Dolo and Crocin', 'Can I replace this medicine?', 'What are the side effects of UnknownDrug?', 'What is the generic name of UnknownDrug?']) {
    const result = await service.answer({ message, history: [] }, {
      retrieve: async () => { calls++; throw new Error('Not permitted'); },
      generate: async () => { calls++; throw new Error('Not permitted'); }
    });
    assert.equal(result.mode, 'CLARIFY');
    assert.equal(result.sources.length, 0);
    assert.ok(result.routing.reasonCode);
  }
  assert.equal(calls, 0);
});

test('identity questions retrieve academic identity records rather than clinical advice', async () => {
  let captured;
  const result = await service.answer({ message: 'What is the generic name of Dolo 650 mg Tablet?', history: [] }, {
    retrieve: async (_query, candidates) => { captured = candidates; return { passages: [], method: 'BM25' }; }
  });
  assert.equal(result.routing.intent, 'MEDICINE_IDENTITY');
  assert.ok(captured.length > 0);
  assert.ok(captured.every(p => p.kind === 'ACADEMIC_CATALOGUE' && p.genericName === 'paracetamol'));
});
