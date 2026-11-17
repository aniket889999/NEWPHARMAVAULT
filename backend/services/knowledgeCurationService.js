const mongoose = require('mongoose');
const { KnowledgeCuration, KnowledgeCurationCounter } = require('../models/knowledgeCurationModel');
const Feedback = require('../models/chatFeedbackModel');
const { references, corpusHash } = require('./chatReferenceRegistry');
const topics = require('../data/chatTopicRegistry');
const FOCUSES = ['DEFINITION', 'OVERVIEW', 'SIDE_EFFECTS', 'PREVENTION', 'IDENTITY', 'EXPLAIN'];
const ROLES = ['pharmacist', 'claims_reviewer', 'org_admin', 'super_admin', 'admin'];
const fail = (statusCode, code, message) => { throw Object.assign(new Error(message), { statusCode, code }); };
function reviewer(user) {
  if (!user || !ROLES.includes(user.role)) fail(403, 'REVIEWER_REQUIRED', 'An authorized organization reviewer is required.');
  if (!user.organizationId) fail(403, 'ORGANIZATION_REQUIRED', 'An explicit organization membership is required.');
  return { organizationId: user.organizationId };
}
function choices() { return { corpusHash, focuses: FOCUSES, sources: references.map(value => ({ id: value.id, title: value.title, excerpt: value.excerpt, topics: value.topics, focuses: value.focuses, sourceUrl: value.sourceUrl, version: value.version })), topics: topics.filter(topic => references.some(value => value.topics.includes(topic.id))).map(value => ({ id: value.id, label: value.label })) }; }
function validateSelection(body) {
  if (!body || Object.keys(body).some(key => !['topicId', 'focus', 'sourceIds', 'corpusHash'].includes(key)) || body.corpusHash !== corpusHash || !topics.some(value => value.id === body.topicId) || !FOCUSES.includes(body.focus) || !Array.isArray(body.sourceIds) || body.sourceIds.length < 1 || body.sourceIds.length > 2 || new Set(body.sourceIds).size !== body.sourceIds.length) fail(400, 'INVALID_CURATION', 'Choose current public topic/focus references only; no chat or replacement medical text is accepted.');
  for (const id of body.sourceIds) { const source = references.find(value => value.id === id); if (!source || !source.topics.includes(body.topicId) || !source.focuses.includes(body.focus)) fail(400, 'SOURCE_SCOPE_MISMATCH', 'Each selected source must support the same topic and focus.'); }
  return { topicId: body.topicId, focus: body.focus, sourceIds: body.sourceIds, corpusHash };
}
async function createCandidate(user, body) { const scope = reviewer(user); return KnowledgeCuration.create({ ...scope, ...validateSelection(body), createdBy: user._id }); }
async function listCandidates(user) { return KnowledgeCuration.find(reviewer(user)).sort('-createdAt').limit(30).lean(); }
async function listFeedback(user) { return Feedback.find({ ...reviewer(user), rating: 'NOT_HELPFUL' }).select('rating topicIds sourceIds sourceVersions createdAt status').sort('-createdAt').limit(30).lean(); }
async function reviewCandidate(user, id, body) {
  const scope = reviewer(user);
  if (!mongoose.Types.ObjectId.isValid(id)) fail(404, 'CANDIDATE_NOT_FOUND', 'Candidate unavailable.');
  if (!body || Object.keys(body).some(key => !['decision', 'revision', 'reasonCode'].includes(key)) || !['APPROVE', 'REJECT', 'REVOKE'].includes(body.decision) || !Number.isInteger(body.revision) || !['SOURCE_FOCUS_SUPPORTED', 'NOT_RELEVANT', 'NEEDS_SOURCE_REVIEW', 'REVERT_TO_DEFAULT'].includes(body.reasonCode)) fail(400, 'INVALID_REVIEW', 'A decision, current revision and supported reason are required.');
  if ((body.decision === 'APPROVE' && body.reasonCode !== 'SOURCE_FOCUS_SUPPORTED') || (body.decision === 'REVOKE' && body.reasonCode !== 'REVERT_TO_DEFAULT') || (body.decision === 'REJECT' && !['NOT_RELEVANT', 'NEEDS_SOURCE_REVIEW'].includes(body.reasonCode))) fail(400, 'REASON_DECISION_MISMATCH', 'The reason must match the review decision.');
  const candidate = await KnowledgeCuration.findOne({ _id: id, ...scope });
  if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND', 'Candidate unavailable.');
  if (String(candidate.createdBy) === String(user._id)) fail(403, 'SECOND_REVIEWER_REQUIRED', 'A different authorized reviewer must make the decision.');
  if (candidate.corpusHash !== corpusHash) fail(409, 'CORPUS_CHANGED', 'Source registry changed; create a new proposal against current sources.');
  const expectedState = body.decision === 'REVOKE' ? 'APPROVED' : 'PENDING';
  if (candidate.status !== expectedState || candidate.revision !== body.revision) fail(409, 'STALE_CURATION', 'This proposal changed or is already finalized. Refresh it.');
  let approvalVersion = candidate.approvalVersion;
  if (body.decision === 'APPROVE') { const key = String(scope.organizationId) + ':' + candidate.topicId + ':' + candidate.focus; const counter = await KnowledgeCurationCounter.findOneAndUpdate({ _id: key }, { $inc: { value: 1 } }, { upsert: true, new: true }); approvalVersion = counter.value; }
  const at = new Date();
  // Preference activation and its review journal share one atomic document.
  // Counter gaps after a failed CAS cannot activate a preference.
  const saved = await KnowledgeCuration.findOneAndUpdate({ _id: id, ...scope, status: expectedState, revision: body.revision }, { $set: { status: { APPROVE: 'APPROVED', REJECT: 'REJECTED', REVOKE: 'REVOKED' }[body.decision], approvalVersion, reviewedBy: user._id, reviewedAt: at }, $inc: { revision: 1 }, $push: { actions: { actor: user._id, decision: body.decision, reasonCode: body.reasonCode, at } } }, { new: true, runValidators: true });
  if (!saved) fail(409, 'STALE_CURATION', 'This proposal changed. Refresh it.');
  return { candidate: saved, updateType: 'ORG_RETRIEVAL_PREFERENCE_NOT_MODEL_WEIGHTS', modelWeightsChanged: false };
}
async function getPreference(user, topicId, focus) {
  if (!user?.organizationId) return { sourceIds: [], version: 0 };
  const value = await KnowledgeCuration.findOne({ organizationId: user.organizationId, topicId, focus, status: { $in: ['APPROVED', 'REVOKED'] } }).sort({ approvalVersion: -1 }).lean();
  if (!value || value.corpusHash !== corpusHash) return { sourceIds: [], version: 0 };
  if (value.status === 'REVOKED') return { sourceIds: [], version: value.approvalVersion };
  return { sourceIds: value.sourceIds, version: value.approvalVersion };
}
module.exports = { choices, createCandidate, listCandidates, listFeedback, reviewCandidate, getPreference, reviewer };
