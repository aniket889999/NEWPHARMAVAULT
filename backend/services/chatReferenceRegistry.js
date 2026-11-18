const crypto = require('node:crypto');
const rag = require('./chatRagService');
const extensions = require('../data/chatReferenceExtensions');
const topicByKey = { workflow: ['workflow-trustrag'], 'human-review': ['workflow-human-review'], ocr: ['workflow-ocr'], 'strength-mismatch': ['workflow-consistency'], 'medicine-identity': ['workflow-identity'], risk: ['workflow-consistency'], claim: ['workflow-claims'], fhir: ['workflow-interoperability'], rag: ['workflow-trustrag'], privacy: ['workflow-privacy'] };
const focusByKey = { 'human-review': ['DEFINITION', 'OVERVIEW', 'EXPLAIN'], ocr: ['DEFINITION', 'OVERVIEW', 'EXPLAIN'], 'strength-mismatch': ['DEFINITION', 'OVERVIEW', 'EXPLAIN'], 'medicine-identity': ['IDENTITY', 'OVERVIEW'], claim: ['DEFINITION', 'OVERVIEW'], fhir: ['DEFINITION', 'OVERVIEW'], risk: ['DEFINITION', 'OVERVIEW'], privacy: ['OVERVIEW', 'EXPLAIN'] };
const superseded = new Set(extensions.flatMap(value => value.supersedes || []));
const references = Object.freeze([
  ...rag.publicChunks.filter(value => value.kind !== 'ACADEMIC_CATALOGUE' && !superseded.has(value.key)).map(value => ({ ...value, topics: value.topics || topicByKey[value.key] || [], focuses: focusByKey[value.key] || (/effects/.test(value.key) ? ['SIDE_EFFECTS'] : /nhs-(cetirizine|amoxicillin)$/.test(value.key) ? ['OVERVIEW', 'SIDE_EFFECTS'] : ['OVERVIEW']), reviewStatus: value.kind === 'PROJECT_GUIDE' ? 'FIRST_PARTY_PROJECT_GUIDE' : 'HISTORICAL_SOURCE_SNAPSHOT_NOT_CLINICALLY_VALIDATED' })),
  ...extensions.map(value => ({ ...value, private: false, excerpt: value.text, id: crypto.createHash('sha256').update(value.key + ':' + value.version + ':' + value.text).digest('hex').slice(0, 16) }))
]);
const known = new Map(references.map(value => [value.id, value]));
const corpusHash = crypto.createHash('sha256').update(JSON.stringify(references.map(value => ({ id: value.id, topics: value.topics, focuses: value.focuses })))).digest('hex');
function isKnownPublic(value) { const canonical = known.get(value?.id); return Boolean(canonical && value.private === false && value.excerpt === canonical.excerpt && value.title === canonical.title && value.version === canonical.version && value.sourceUrl === canonical.sourceUrl && !value.documentId); }
module.exports = { references, corpusHash, isKnownPublic };
