'use strict';
// Public transport/parser coverage only. No model, credentials or patient data.
async function main() {
  if (!process.argv.includes('--run-public-lookups')) { console.log(JSON.stringify({ status: 'NOT_RUN', modelRequests: 0 })); return; }
  const registry = require('../data/chatTopicRegistry');
  const { createApprovedMedicineSearch } = require('../services/approvedMedicineSearchService');
  const { createApprovedFdaMedicineSearch } = require('../services/approvedFdaMedicineSearchService');
  const { registerMedicineCandidates } = require('../services/approvedHealthSearchService');
  const nhs = createApprovedMedicineSearch({ enabled: () => true }), fda = createApprovedFdaMedicineSearch({ enabled: () => true });
  const topics = registry.filter(value => !value.concept && !value.id.startsWith('nhs-'));
  const results = []; let next = 0;
  const worker = async () => { while (next < topics.length) {
    const topic = topics[next++]; let result = await nhs(topic.id, { attribute: 'GENERAL' });
    if (result.status === 'UNSUPPORTED') result = await fda(topic.id, { attribute: 'GENERAL' });
    const passages = result.candidates.length ? registerMedicineCandidates(result.candidates) : [];
    results.push({ topicId: topic.id, label: topic.label, status: result.status, passageCount: passages.length,
      publisher: passages[0]?.publisher || null, jurisdiction: passages[0]?.jurisdiction || null, urls: [...new Set(passages.map(value => value.sourceUrl))], clinicalApproval: 'NOT_ESTABLISHED' });
  } };
  await Promise.all([worker(), worker(), worker()]);
  console.log(JSON.stringify({ type: 'PUBLIC_SOURCE_TRANSPORT_NOT_CLINICAL_VALIDATION', modelRequests: 0, checked: results.length,
    withPassages: results.filter(value => value.passageCount > 0).length, results: results.sort((a,b) => a.topicId.localeCompare(b.topicId)) }, null, 2));
}
main().catch(error => { console.log(JSON.stringify({ status: 'FAILED', reason: error.name, modelRequests: 0 })); process.exitCode = 2; });
