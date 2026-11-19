'use strict';
const crypto = require('node:crypto');
const data = require('../data/chatMedicineEvidence.v1.json');
const topics = new Set(['ibuprofen', 'atorvastatin', 'losartan', 'omeprazole', 'pantoprazole', 'azithromycin']);
const attributes = new Set(['USES', 'SIDE_EFFECTS']);

// Only the reviewed, checked-in academic derivative is loaded. Gemini's
// preparation directory is never a runtime ingestion or approval mechanism.
function buildMedicineEvidencePack(pack) {
  if (pack?.schemaVersion !== 'academic-medicine-evidence-v1' || pack.reviewStatus !== 'ACADEMIC_SOURCE_CHECKED_NOT_CLINICAL_APPROVAL' ||
      pack.publisher !== 'NHS' || pack.jurisdiction !== 'UK' || !/^\d{4}-\d{2}-\d{2}$/.test(pack.checkedAt || '') ||
      !Number.isFinite(Date.parse(pack.checkedAt)) || typeof pack.licenceBasis !== 'string' || !pack.licenceBasis.trim() ||
      !Array.isArray(pack.records) || pack.records.length !== topics.size * attributes.size) throw new Error('Invalid academic medicine evidence pack.');
  const keys = new Set(), slots = new Set();
  const passages = pack.records.map(record => {
    const slot = record.topicId + ':' + record.attribute;
    if (!topics.has(record.topicId) || !attributes.has(record.attribute) || slots.has(slot) || keys.has(record.key) ||
        !/^academic-[a-z-]+-v1$/.test(record.key || '') || typeof record.title !== 'string' || !record.title.trim() || record.title.length > 120 ||
        typeof record.text !== 'string' || !record.text.trim() || record.text.split(/\s+/).length > 90 ||
        !/^https:\/\/www\.nhs\.uk\/medicines\/[a-z-]+\/(?:[a-z-]+\/)?$/.test(record.sourceUrl || '') ||
        !record.sourceUrl.includes('/' + record.topicId + (record.topicId === 'ibuprofen' ? '-for-adults/' : '/'))) throw new Error('Invalid academic medicine evidence record.');
    keys.add(record.key); slots.add(slot);
    const version = pack.schemaVersion + '; source checked ' + pack.checkedAt;
    const id = crypto.createHash('sha256').update(JSON.stringify([record.key, version, record.text, record.sourceUrl])).digest('hex').slice(0, 16);
    return Object.freeze({ key: record.key, id, title: record.title, excerpt: record.text, version,
      kind: 'HEALTH_REFERENCE', private: false, topics: Object.freeze([record.topicId]),
      focuses: Object.freeze(record.attribute === 'USES' ? ['OVERVIEW', 'DEFINITION', 'EXPLAIN'] : ['SIDE_EFFECTS']),
      supportedAttributes: Object.freeze([record.attribute]), checkedAt: pack.checkedAt,
      sourceUrl: record.sourceUrl, publisher: pack.publisher, jurisdiction: pack.jurisdiction,
      licensingNote: pack.licenceBasis, reviewStatus: pack.reviewStatus });
  });
  return Object.freeze(passages);
}
const passages = buildMedicineEvidencePack(data);
module.exports = { buildMedicineEvidencePack, passages };
