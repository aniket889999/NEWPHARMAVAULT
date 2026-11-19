'use strict';
const crypto = require('node:crypto');
const manifest = require('../data/chatSourceGovernance.json');
const MODES = Object.freeze({ DEMO: 'ACADEMIC_DEMO', REVIEWED: 'REVIEWED_ONLY' });
function sourcePolicy(environment = process.env) {
  // Production cannot opt back into unreviewed medical content through this flag.
  if (environment.NODE_ENV === 'production') return MODES.REVIEWED;
  if (!environment.CHAT_SOURCE_POLICY) return MODES.DEMO;
  return environment.CHAT_SOURCE_POLICY === MODES.DEMO ? MODES.DEMO : MODES.REVIEWED;
}
function contentHash(source) {
  return crypto.createHash('sha256').update(JSON.stringify([source.id, source.title, source.sourceUrl || '', source.version, source.excerpt])).digest('hex');
}
function evaluateSource(source, { environment = process.env, rules = manifest.sources, now = Date.now(), attribute } = {}) {
  const policy = sourcePolicy(environment);
  const result = (eligible, status, reasonCode) => ({ eligible, policy, status, reasonCode });
  if (!source || source.private || source.documentId) return result(false, 'BLOCKED', 'PRIVATE_SOURCE_NOT_PUBLIC_REFERENCE');
  const record = rules[source.key || source.id];
  // Withdrawal applies to all versions of a key and also to first-party guides.
  if (record?.status === 'WITHDRAWN') return result(false, 'WITHDRAWN', 'SOURCE_WITHDRAWN');
  if (source.kind === 'PROJECT_GUIDE') return result(true, 'FIRST_PARTY_PROJECT_GUIDE', 'PROJECT_NOT_CLINICAL_REFERENCE');
  if (record?.status === 'APPROVED') {
    const reviewed = Date.parse(record.reviewedAt), approved = Date.parse(record.approvedAt), due = Date.parse(record.nextReviewAt);
    const bound = record.sourceId === source.id && record.version === source.version && record.contentHash === contentHash(source) && record.sourceUrl === source.sourceUrl;
    const reviewers = typeof record.reviewedBy === 'string' && record.reviewedBy.trim() && typeof record.approvedBy === 'string' && record.approvedBy.trim() && record.reviewedBy.trim() !== record.approvedBy.trim();
    const provenance = typeof record.jurisdiction === 'string' && record.jurisdiction.trim() && record.permittedUse === 'ALLOWED' && typeof record.licenceBasis === 'string' && record.licenceBasis.trim();
    const dates = Number.isFinite(reviewed) && Number.isFinite(approved) && Number.isFinite(due) && reviewed <= approved && approved <= now && due > approved;
    const attributes = ['GENERAL', 'USES', 'SIDE_EFFECTS', 'STORAGE', 'PREVENTION', 'MECHANISM', 'SPECIFIC_FACT'];
    const scope = Array.isArray(record.supportedAttributes) && record.supportedAttributes.length > 0 && record.supportedAttributes.length <= attributes.length && new Set(record.supportedAttributes).size === record.supportedAttributes.length && record.supportedAttributes.every(value => attributes.includes(value));
    if (!bound || !reviewers || !provenance || !dates || !scope) return result(false, 'BLOCKED', 'INVALID_OR_CHANGED_REVIEW_RECORD');
    if (due <= now) return result(false, 'EXPIRED', 'SOURCE_REVIEW_EXPIRED');
    if (attribute && !record.supportedAttributes.includes(attribute)) return result(false, 'BLOCKED', 'QUESTION_OUTSIDE_REVIEW_SCOPE');
    return result(true, 'CURRENT_REVIEW_RECORD', 'REVIEW_RECORD_CURRENT_NOT_PRODUCT_CERTIFICATION');
  }
  if (record && record.status !== 'PENDING') return result(false, 'BLOCKED', 'INVALID_REVIEW_STATUS');
  return policy === MODES.DEMO
    ? result(true, 'NOT_CLINICALLY_APPROVED', 'ACADEMIC_REFERENCE_ONLY')
    : result(false, 'NOT_CLINICALLY_APPROVED', 'CLINICAL_SOURCE_REVIEW_REQUIRED');
}
function sourceSummary(sources, options = {}) {
  const decisions = sources.map(source => evaluateSource(source, options));
  return { schemaVersion: manifest.schemaVersion, mode: sourcePolicy(options.environment),
    registered: sources.length, eligible: decisions.filter(value => value.eligible).length,
    currentReviewRecords: decisions.filter(value => value.status === 'CURRENT_REVIEW_RECORD').length,
    unapproved: decisions.filter(value => value.status === 'NOT_CLINICALLY_APPROVED').length,
    blocked: decisions.filter(value => !value.eligible).length, clinicalValidation: 'NOT_ESTABLISHED' };
}
module.exports = { MODES, sourcePolicy, contentHash, evaluateSource, sourceSummary };
