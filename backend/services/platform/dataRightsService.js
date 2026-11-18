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


const esc = (v) => String(v ?? '—').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const STATUS_TEXT = {
  DRAFT: 'Draft', DOCUMENTS_PENDING: 'Waiting for documents', READY_FOR_PROCESSING: 'Ready to read', PROCESSING: 'Reading documents',
  NEEDS_CORRECTION: 'Needs your correction', NEEDS_REVIEW: 'With the pharmacist', VERIFIED: 'Verified by pharmacist', REJECTED: 'Not verified',
  CLOSED: 'Closed', FAILED: 'Could not be read', SUBMITTED: 'Sent to insurer', UNDER_PAYER_REVIEW: 'Insurer reviewing', QUERY_RAISED: 'Insurer has a question',
  APPROVED: 'Approved', PARTIALLY_APPROVED: 'Partly approved', SETTLED: 'Settled (simulated)', WITHDRAWN: 'Withdrawn', APPEALED: 'Appealed'
};
const label = (s) => STATUS_TEXT[s] || s;
const table = (head, rows) => rows.length
  ? `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  : '<p class="none">Nothing here.</p>';

/** Plain-language, printable summary of an export (open in a browser, print or save as PDF). */
function exportToHtml(data) {
  const fieldsByCase = new Map();
  for (const f of data.extractedFields) {
    const key = String(f.caseId);
    if (!fieldsByCase.has(key)) fieldsByCase.set(key, []);
    fieldsByCase.get(key).push(f);
  }
  const cases = data.cases.map((c, i) => {
    const docs = data.documents.filter((d) => String(d.caseId) === c.id);
    const decisions = data.reviewDecisions.filter((d) => String(d.caseId) === c.id);
    const fields = fieldsByCase.get(c.id) || [];
    return `<section><h3>Case ${i + 1} · ${esc(label(c.status))}</h3><p class="meta">Started ${day(c.createdAt)} · last change ${day(c.updatedAt)}${c.purgedAt ? ` · documents removed ${day(c.purgedAt)}` : ''}</p>
      <h4>Documents</h4>${table(['Type', 'File', 'Uploaded'], docs.map((d) => [String(d.type).replace(/_/g, ' ').toLowerCase(), d.originalFilename || '—', day(d.createdAt)]))}
      <h4>Details read from your documents</h4>${table(['Field', 'Value'], fields.slice(0, 200).map((f) => [String(f.fieldType).replace(/_/g, ' ').toLowerCase(), f.normalizedValue ?? f.rawValue]))}
      <h4>Pharmacist decisions</h4>${table(['Date', 'Decision', 'Note'], decisions.map((d) => [day(d.createdAt), String(d.decision).replace(/_/g, ' ').toLowerCase(), d.notes]))}</section>`;
  }).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your PharmaVault data</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;max-width:860px;margin:2rem auto;padding:0 1rem;line-height:1.5}h1{font-size:1.6rem}h2{border-bottom:2px solid #0d9488;padding-bottom:.25rem;margin-top:2rem}h3{margin-bottom:0}h4{margin:.75rem 0 .25rem;color:#475569}table{border-collapse:collapse;width:100%;font-size:.9rem;margin-bottom:.5rem}th,td{border:1px solid #e2e8f0;padding:.35rem .5rem;text-align:left;vertical-align:top}th{background:#f8fafc}.meta,.none,.note{color:#64748b;font-size:.85rem}section{border:1px solid #e2e8f0;border-radius:12px;padding:1rem;margin:1rem 0}@media print{.noprint{display:none}}</style></head><body>
<h1>Your PharmaVault data</h1><p class="meta">Created ${day(data.generatedAt)}. ${esc(data.note)}</p>
<p class="noprint note">Tip: use your browser's Print → “Save as PDF” to keep a copy.</p>
<h2>Your account</h2>${table(['Name', 'Email', 'Account type', 'Two-factor sign-in', 'Joined'], [[data.account.name, data.account.email, data.account.role, data.account.mfaEnabled ? 'On' : 'Off', day(data.account.createdAt)]])}
<h2>Your cases (${data.cases.length})</h2>${cases || '<p class="none">No cases.</p>'}
<h2>Insurance claims (${data.claims.length})</h2>${table(['Reference', 'Status', 'Amount claimed', 'Decision', 'Submitted'], data.claims.map((c) => [c.claimReference, label(c.status), `₹${c.claimedAmount}`, c.decision?.decision ? `${label(c.decision.decision)}${c.decision.approvedAmount != null ? ` (₹${c.decision.approvedAmount})` : ''}` : '—', day(c.createdAt)]))}
<h2>Data-sharing consents (${data.consentGrants.length})</h2>${table(['Given', 'Valid until', 'Withdrawn'], data.consentGrants.map((g) => [day(g.createdAt), day(g.expiresAt), g.revokedAt ? day(g.revokedAt) : 'Still active']))}
<h2>Your recent activity</h2>${table(['Date', 'What happened'], data.activity.slice(0, 100).map((a) => [day(a.createdAt), String(a.action).replace(/_/g, ' ').toLowerCase()]))}
<p class="note">The full machine-readable copy is available as JSON from the same page.${data.truncated ? ' Very long lists were shortened.' : ''}</p></body></html>`;
}

module.exports = { ERASURE_DUE_DAYS, OPEN_CLAIM_STATUSES, buildExport, exportToHtml, requestErasure, completeErasure };
