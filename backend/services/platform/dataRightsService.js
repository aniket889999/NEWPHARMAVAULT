'use strict';

/**
 * Data-principal rights: export of a person's own data and erasure on request.
 *
 * Export: everything the platform holds that the person created or that is about
 * their own cases — never storage keys, password hashes, MFA secrets or other
 * people's account details (reviewers appear by role only).
 *
 * Erasure (processed by a super_admin):
 *  - refused while any claim of the person is still open (they must withdraw it or wait
 *    for the decision), because the insurer is entitled to finish an open claim;
 *  - removes document files and derived evidence of all their cases (case kept as a
 *    tombstone), revokes every consent grant, deletes their notifications;
 *  - anonymises the account (name, email, password, MFA) and deactivates it;
 *  - keeps claims, review decisions and audit events: they hold no document content and are
 *    the accountability record (legal retention basis to be confirmed by counsel).
 */
const crypto = require('node:crypto');

const ERASURE_DUE_DAYS = 30;
const EXPORT_LIMIT = 5000;
const OPEN_CLAIM_STATUSES = ['SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED', 'APPROVED', 'PARTIALLY_APPROVED', 'APPEALED'];

const models = () => ({
  User: require('../../models/userModel'),
  VerificationCase: require('../../models/verificationCaseModel'),
  Document: require('../../models/documentModel'),
  ExtractedField: require('../../models/extractedFieldModel'),
  ReviewDecision: require('../../models/reviewDecisionModel'),
  Claim: require('../../models/claimModel'),
  CaseShareGrant: require('../../models/caseShareGrantModel'),
  Notification: require('../../models/notificationModel'),
  AuditEvent: require('../../models/auditEventModel'),
  DataRequest: require('../../models/dataRequestModel')
});

const controlled = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

async function buildExport(userId) {
  const m = models();
  const user = await m.User.findById(userId).select('name email role organizationId createdAt updatedAt mfa.enabled active').lean();
  if (!user) throw controlled(404, 'USER_NOT_FOUND', 'Account not found.');
  const cases = await m.VerificationCase.find({ createdBy: userId }).limit(EXPORT_LIMIT).lean();
  const caseIds = cases.map((c) => c._id);
  const [documents, fields, decisions, claims, grants, notifications, activity, requests] = await Promise.all([
    m.Document.find({ caseId: { $in: caseIds } }).select('caseId type originalFilename mimeType sizeBytes pageCount uploadStatus processingStatus createdAt').lean(),
    m.ExtractedField.find({ caseId: { $in: caseIds } }).select('caseId documentId fieldType rawValue normalizedValue pageNumber extractionConfidence needsCorrection correctedAt resolution').limit(EXPORT_LIMIT * 4).lean(),
    m.ReviewDecision.find({ caseId: { $in: caseIds } }).select('caseId decision reasonCode notes createdAt').lean(),
    m.Claim.find({ claimantId: userId }).select('-history.by -queries.askedBy -decision.decidedBy -appeal.previousDecision.decidedBy').lean(),
    m.CaseShareGrant.find({ grantedBy: userId }).select('caseId granteeOrganizationId purpose scope consentText expiresAt revokedAt createdAt').lean(),
    m.Notification.find({ userId }).select('-userId').sort({ createdAt: -1 }).limit(EXPORT_LIMIT).lean(),
    m.AuditEvent.find({ actorId: userId }).select('caseId action targetType createdAt').sort({ createdAt: -1 }).limit(EXPORT_LIMIT).lean(),
    m.DataRequest.find({ userId }).select('-userId -processedBy').lean()
  ]);
  return {
    format: 'pharmavault-personal-data-export/v1',
    generatedAt: new Date().toISOString(),
    note: 'Your own data held by PharmaVault. Original document files are not included; download them from each case. Reviewer and insurer staff identities are not included.',
    account: { id: String(user._id), name: user.name, email: user.email, role: user.role, mfaEnabled: Boolean(user.mfa?.enabled), createdAt: user.createdAt },
    cases: cases.map((c) => ({ id: String(c._id), status: c.status, createdAt: c.createdAt, updatedAt: c.updatedAt, purgedAt: c.purgedAt || null, title: c.title || null })),
    documents, extractedFields: fields, reviewDecisions: decisions, claims, consentGrants: grants, notifications, activity, dataRequests: requests,
    truncated: [cases, notifications, activity].some((list) => list.length >= EXPORT_LIMIT)
  };
}

async function requestErasure(user, reason) {
  const { DataRequest } = models();
  if (user.role !== 'patient') throw controlled(403, 'ERASURE_PATIENT_ONLY', 'Staff accounts are removed by your organization administrator (Team & Access).');
  const text = typeof reason === 'string' ? reason.trim().slice(0, 1000) : '';
  try {
    return await DataRequest.create({ userId: user._id, type: 'ERASURE', reason: text || null, dueBy: new Date(Date.now() + ERASURE_DUE_DAYS * 86_400_000) });
  } catch (error) {
    if (error?.code === 11000) throw controlled(409, 'ERASURE_ALREADY_REQUESTED', 'You already have an open deletion request.');
    throw error;
  }
}

async function completeErasure(requestId, admin, note) {
  const m = models();
  const { purgeCaseContent } = require('./retentionService');
  const request = await m.DataRequest.findById(requestId);
  if (!request || request.type !== 'ERASURE') throw controlled(404, 'DATA_REQUEST_NOT_FOUND', 'Deletion request not found.');
  if (request.status !== 'OPEN') throw controlled(409, 'DATA_REQUEST_CLOSED', `This request is already ${request.status.toLowerCase()}.`);
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length < 10 || text.length > 2000) throw controlled(400, 'NOTE_REQUIRED', 'Add a processing note (10–2000 characters).');

  const userId = request.userId;
  const openClaims = await m.Claim.countDocuments({ claimantId: userId, status: { $in: OPEN_CLAIM_STATUSES } });
  if (openClaims > 0) {
    await m.DataRequest.updateOne({ _id: request._id }, { $set: { 'outcome.openClaims': openClaims, 'outcome.note': `Waiting: ${openClaims} open claim(s). ${text}`.slice(0, 2000) } });
    throw controlled(409, 'ERASURE_BLOCKED_OPEN_CLAIMS', `The person has ${openClaims} open claim(s). They must be withdrawn or decided before erasure.`);
  }

  const cases = await m.VerificationCase.find({ createdBy: userId, purgedAt: null }).select('_id').lean();
  for (const c of cases) await purgeCaseContent(c._id);
  const grants = await m.CaseShareGrant.updateMany({ grantedBy: userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy: admin._id } });
  const notes = await m.Notification.deleteMany({ userId });
  await m.User.updateOne({ _id: userId }, {
    $set: {
      name: 'Erased user',
      email: `erased-${String(userId)}@erased.invalid`,
      password: await require('bcryptjs').hash(crypto.randomBytes(32).toString('hex'), 10),
      active: false, deactivatedAt: new Date(), deactivatedBy: admin._id,
      'mfa.enabled': false, 'mfa.secretEnc': null, 'mfa.pendingSecretEnc': null, 'mfa.recoveryCodeHashes': [],
      metadata: {}
    },
    $inc: { sessionVersion: 1 }
  });
  const outcome = { note: text, casesPurged: cases.length, grantsRevoked: grants.modifiedCount || 0, notificationsDeleted: notes.deletedCount || 0, openClaims: 0 };
  await m.DataRequest.updateOne({ _id: request._id }, { $set: { status: 'COMPLETED', processedBy: admin._id, processedAt: new Date(), outcome } });
  return { id: String(request._id), status: 'COMPLETED', outcome };
}

module.exports = { ERASURE_DUE_DAYS, OPEN_CLAIM_STATUSES, buildExport, requestErasure, completeErasure };
