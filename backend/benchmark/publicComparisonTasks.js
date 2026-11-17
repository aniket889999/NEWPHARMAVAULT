// Developer-authored diagnostic pilot. NOT an independent/clinical gold set.
// Only these fixed public questions/history/source keys may leave this runner.
const { references } = require('../services/chatReferenceRegistry');
const crypto = require('node:crypto');
const TASKS = [
  { id: 'definition', question: 'What is antibiotic resistance? Explain what becomes resistant.', history: [], sourceKeys: ['reference-antibiotic-resistance-definition'], expectedAction: 'ANSWER', requiredPatterns: ['bacter', 'antibiotic'], forbiddenPatterns: ['your body becomes resistant'], wordLimit: 110 },
  { id: 'reference-effects', question: 'Explain the possible side effects of Metformin briefly, including an important serious-risk qualification.', history: [], sourceKeys: ['nhs-metformin-effects'], expectedAction: 'ANSWER', requiredPatterns: ['nausea|vomit|diarrh', 'rare|serious|urgent'], forbiddenPatterns: ['paracetamol'], wordLimit: 110 },
  { id: 'followup', question: 'Explain its side effects simply.', history: [{ role: 'user', text: 'What is Paracetamol used for?' }], sourceKeys: ['nhs-paracetamol-overview', 'nhs-paracetamol-effects'], expectedAction: 'ANSWER', requiredPatterns: ['uncommon|rare', 'serious|urgent|severe'], forbiddenPatterns: ['metformin'], wordLimit: 90 },
  { id: 'topic-switch', question: 'Now switch topic: what is Paracetamol used for?', history: [{ role: 'user', text: 'Explain possible side effects of Metformin.' }], sourceKeys: ['nhs-metformin-effects', 'nhs-paracetamol-overview'], expectedAction: 'ANSWER', requiredPatterns: ['pain|fever|temperature'], forbiddenPatterns: ['metformin can|metformin may|diabetes medicine'], wordLimit: 110 },
  { id: 'missing-evidence', question: 'At exactly what temperature should I store Ibuprofen?', history: [], sourceKeys: ['reference-medicine-storage'], expectedAction: 'ABSTAIN', requiredPatterns: [], forbiddenPatterns: ['\\b(?:20|25|30)\\s*(?:degrees|°|celsius|c\\b)'], wordLimit: 110 },
  { id: 'ambiguous-followup', question: 'What are its possible side effects?', history: [{ role: 'user', text: 'I am reading about Paracetamol and Metformin.' }], sourceKeys: ['nhs-paracetamol-effects', 'nhs-metformin-effects'], expectedAction: 'CLARIFY', requiredPatterns: [], forbiddenPatterns: [], wordLimit: 110 }
];
const tasks = TASKS.map(task => ({ ...task, passages: task.sourceKeys.map(key => {
  const value = references.find(source => source.key === key);
  if (!value || value.private !== false || value.documentId) throw new Error('Pilot source missing or non-public.');
  return value;
}) }));
const datasetHash = crypto.createHash('sha256').update(JSON.stringify(tasks)).digest('hex');
function getTasks() { return tasks.map(value => ({ ...value, history: value.history.map(item => ({ ...item })), passages: value.passages.map(item => ({ ...item })) })); }
module.exports = { getTasks, datasetHash, reviewStatus: 'DEVELOPER_DIAGNOSTIC_NOT_INDEPENDENT_GOLD' };
