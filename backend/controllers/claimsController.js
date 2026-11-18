'use strict';

/**
 * Claims module: claimant (patient) ↔ insurer (payer) over a consented,
 * pharmacist-verified TrustRAG case. Humans make every claim decision.
 */
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const Claim = require('../models/claimModel');
const CaseShareGrant = require('../models/caseShareGrantModel');
const { SHARE_SCOPES } = require('../models/caseShareGrantModel');
const Notification = require('../models/notificationModel');
const VerificationCase = require('../models/verificationCaseModel');
const Organization = require('../models/organizationModel');
const Document = require('../models/documentModel');
const ExtractedField = require('../models/extractedFieldModel');
const ConsistencyCheck = require('../models/consistencyCheckModel');
const RiskSignal = require('../models/riskSignalModel');
const ReviewDecision = require('../models/reviewDecisionModel');
const auditLoggerService = require('../services/trustRag/auditLoggerService');
const storageService = require('../services/trustRag/storageService');
const sm = require('../services/claims/claimStateMachine');
const { notifyUsers, notifyOrganizationRoles } = require('../services/claims/notificationService');
const { buildClaimBundle } = require('../services/fhir/fhirBundleBuilder');
const { validateBundle } = require('../services/fhir/fhirR4Validator');

const PAYER_ROLES = ['payer_reviewer', 'payer_admin'];
const PHARMACY_STAFF = ['pharmacy', 'pharmacist', 'claims_reviewer', 'org_admin', 'branch_manager'];
const CONSENT_DAYS = 90;
const CONSENT_TEXT = 'I allow the selected insurer to view this verification case (documents, extracted fields, consistency checks, risk signals and pharmacist review decisions) only to review this insurance claim. I can withdraw this consent before a decision is made.';

const notFound = () => sm.controlled(404, 'CLAIM_NOT_FOUND', 'Claim not found.');
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

function sendError(res, err) {
  const status = err.statusCode || 500;
  res.status(status).json({ code: err.code || 'CLAIMS_ERROR', message: status >= 500 ? 'Claims service error.' : err.message });
}

const handle = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.statusCode || err.code) return sendError(res, err);
    throw err;
  }
});

function claimantView(claim) {
  const c = claim.toObject ? claim.toObject() : claim;
  return {
    id: String(c._id), claimReference: c.claimReference, caseId: String(c.caseId), status: c.status,
    policyNumber: c.policyNumber, claimedAmount: c.claimedAmount, currency: c.currency,
    payerOrganizationId: String(c.payerOrganizationId),
    payerName: c.payerOrganizationId?.name,
    queries: (c.queries || []).map((q) => ({ id: String(q._id), question: q.question, askedAt: q.askedAt, answer: q.answer, answeredAt: q.answeredAt })),
    decision: c.decision?.decision ? { decision: c.decision.decision, approvedAmount: c.decision.approvedAmount, reasonCode: c.decision.reasonCode, note: c.decision.note, decidedAt: c.decision.decidedAt } : null,
    settlement: c.settlement?.settledAt ? { reference: c.settlement.reference, settledAt: c.settlement.settledAt, simulated: true } : null,
    history: (c.history || []).map((h) => ({ status: h.status, at: h.at, byRole: h.byRole })),
    createdAt: c.createdAt, updatedAt: c.updatedAt
  };
}

/**
 * Atomic status change guarded by the expected current status (prevents
 * double decisions from two reviewers or two browser tabs).
 */
async function transition(claimId, from, to, req, { set = {}, push = {} } = {}) {
  sm.assertTransition(from, to, req.user.role);
  const updated = await Claim.findOneAndUpdate(
    { _id: claimId, status: from },
    {
      $set: { status: to, ...set },
      $push: { history: { status: to, at: new Date(), byRole: req.user.role, by: req.user._id }, ...push }
    },
    { new: true }
  );
  if (!updated) throw sm.controlled(409, 'CLAIM_CHANGED', 'This claim was changed by someone else. Reload and try again.');
  await auditLoggerService.logEvent({
    caseId: updated.caseId, actorId: req.user._id, actorRole: req.user.role,
    action: `CLAIM_${to}`, targetType: 'Claim', targetId: updated._id,
    metadata: { claimReference: updated.claimReference, from, to }
  });
  return updated;
}

async function claimantClaim(req) {
  if (!validId(req.params.claimId)) throw notFound();
  const claim = await Claim.findOne({ _id: req.params.claimId, claimantId: req.user._id }).populate('payerOrganizationId', 'name');
  if (!claim) throw notFound();
  return claim;
}

async function payerClaim(req) {
  if (!validId(req.params.claimId)) throw notFound();
  const orgId = req.tenantContext?.organizationId;
  if (!orgId) throw sm.controlled(403, 'NO_TENANT', 'Insurer user has no organization.');
  const claim = await Claim.findOne({ _id: req.params.claimId, payerOrganizationId: orgId });
  if (!claim) throw notFound();
  return claim;
}

async function activeGrantFor(claim) {
  const grant = await CaseShareGrant.findOne({ _id: claim.shareGrantId, caseId: claim.caseId, granteeOrganizationId: claim.payerOrganizationId });
  if (!grant || !grant.isActive()) throw sm.controlled(403, 'CONSENT_INACTIVE', 'The claimant has not granted (or has withdrawn) access to this case.');
  return grant;
}

// ───────────────────────── Claimant (patient) ─────────────────────────

const listPayers = handle(async (req, res) => {
  const payers = await Organization.find({ kind: 'payer', status: 'active' }).select('name').sort('name').lean();
  res.json(payers.map((p) => ({ id: String(p._id), name: p.name })));
});

const listEligibleCases = handle(async (req, res) => {
  const cases = await VerificationCase.find({ createdBy: req.user._id, status: 'VERIFIED' }).select('caseReference status updatedAt').sort('-updatedAt').limit(50).lean();
  res.json(cases.map((c) => ({ id: String(c._id), caseReference: c.caseReference, status: c.status, updatedAt: c.updatedAt })));
});

const submitClaim = handle(async (req, res) => {
  const { caseId, payerOrganizationId, claimedAmount, policyNumber, consent } = req.body || {};
  if (!validId(caseId) || !validId(payerOrganizationId)) throw sm.controlled(400, 'INVALID_INPUT', 'Select a verified case and an insurer.');
  if (consent?.accepted !== true) throw sm.controlled(400, 'CONSENT_REQUIRED', 'You must accept the data-sharing consent to submit a claim.');
  const policy = typeof policyNumber === 'string' ? policyNumber.trim() : '';
  if (!/^[A-Za-z0-9-]{4,64}$/.test(policy)) throw sm.controlled(400, 'INVALID_POLICY', 'Policy number must be 4–64 letters, digits or hyphens (use a synthetic number for demos).');
  const amount = sm.validateAmount(Number(claimedAmount), { field: 'claimedAmount' });

  const vCase = await VerificationCase.findOne({ _id: caseId, createdBy: req.user._id });
  if (!vCase) throw sm.controlled(404, 'CASE_NOT_FOUND', 'Verification case not found.');
  if (vCase.status !== 'VERIFIED') throw sm.controlled(409, 'CASE_NOT_VERIFIED', 'Only a case verified by a pharmacist can be submitted as a claim.');
  const payer = await Organization.findOne({ _id: payerOrganizationId, kind: 'payer', status: 'active' });
  if (!payer) throw sm.controlled(404, 'PAYER_NOT_FOUND', 'Insurer not found.');

  const existing = await Claim.findOne({ caseId, payerOrganizationId, status: { $in: ['SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED'] } });
  if (existing) throw sm.controlled(409, 'DUPLICATE_OPEN_CLAIM', `An open claim (${existing.claimReference}) already exists for this case and insurer.`);

  const session = await mongoose.startSession().catch(() => null);
  let claim;
  try {
    const work = async (s) => {
      const opts = s ? { session: s } : {};
      const [grant] = await CaseShareGrant.create([{
        caseId, granteeOrganizationId: payer._id, grantedBy: req.user._id,
        scope: [...SHARE_SCOPES], consentText: CONSENT_TEXT,
        expiresAt: new Date(Date.now() + CONSENT_DAYS * 86400000)
      }], opts);
      [claim] = await Claim.create([{
        caseId, claimantId: req.user._id, pharmacyOrganizationId: vCase.organizationId,
        payerOrganizationId: payer._id, shareGrantId: grant._id, policyNumber: policy,
        claimedAmount: amount, status: 'SUBMITTED',
        history: [{ status: 'SUBMITTED', at: new Date(), byRole: req.user.role, by: req.user._id }]
      }], opts);
    };
    // Transactions need a replica set; standalone dev MongoDB falls back to sequential writes.
    if (session) {
      try { await session.withTransaction(() => work(session)); }
      catch (err) { if (/replica set|Transaction numbers/i.test(err.message)) await work(null); else throw err; }
    } else {
      await work(null);
    }
  } catch (err) {
    if (err?.code === 11000) throw sm.controlled(409, 'DUPLICATE_OPEN_CLAIM', 'An open claim already exists for this case and insurer.');
    throw err;
  } finally {
    session?.endSession();
  }

  await auditLoggerService.logEvent({
    caseId, actorId: req.user._id, actorRole: req.user.role, action: 'CLAIM_SUBMITTED_WITH_CONSENT',
    targetType: 'Claim', targetId: claim._id, metadata: { claimReference: claim.claimReference, payerOrganizationId: String(payer._id), scope: SHARE_SCOPES, consentDays: CONSENT_DAYS }
  });
  await notifyOrganizationRoles(payer._id, PAYER_ROLES, { type: 'CLAIM_SUBMITTED', title: 'New claim received', body: `Claim ${claim.claimReference} is waiting for review.`, link: `/payer/claims/${claim._id}` });
  await notifyOrganizationRoles(vCase.organizationId, ['pharmacist', 'claims_reviewer', 'org_admin', 'pharmacy'], { type: 'CLAIM_SUBMITTED', title: 'Verified case sent to insurer', body: `Case ${vCase.caseReference} was submitted as claim ${claim.claimReference}.`, link: '/pharmacy/claims' });

  const populated = await Claim.findById(claim._id).populate('payerOrganizationId', 'name');
  res.status(201).json(claimantView(populated));
});

const listMyClaims = handle(async (req, res) => {
  const claims = await Claim.find({ claimantId: req.user._id }).populate('payerOrganizationId', 'name').sort('-createdAt').limit(100);
  res.json(claims.map(claimantView));
});

const getMyClaim = handle(async (req, res) => {
  res.json(claimantView(await claimantClaim(req)));
});

const answerQuery = handle(async (req, res) => {
  const claim = await claimantClaim(req);
  const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
  if (answer.length < 2 || answer.length > 2000) throw sm.controlled(400, 'INVALID_ANSWER', 'Answer must be 2–2000 characters.');
  const query = claim.queries.id(req.params.queryId);
  if (!query || query.answer) throw sm.controlled(404, 'QUERY_NOT_OPEN', 'This query is not open.');
  const index = claim.queries.findIndex((q) => String(q._id) === String(query._id));
  const updated = await transition(claim._id, 'QUERY_RAISED', 'UNDER_PAYER_REVIEW', req, {
    set: { [`queries.${index}.answer`]: answer, [`queries.${index}.answeredAt`]: new Date() }
  });
  await notifyOrganizationRoles(claim.payerOrganizationId, PAYER_ROLES, { type: 'CLAIM_QUERY_ANSWERED', title: 'Claimant answered a query', body: `Claim ${claim.claimReference} has a new answer.`, link: `/payer/claims/${claim._id}` });
  res.json(claimantView(await updated.populate('payerOrganizationId', 'name')));
});

const withdrawClaim = handle(async (req, res) => {
  const claim = await claimantClaim(req);
  const updated = await transition(claim._id, claim.status, 'WITHDRAWN', req);
  await CaseShareGrant.updateOne({ _id: claim.shareGrantId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy: req.user._id } });
  await auditLoggerService.logEvent({ caseId: claim.caseId, actorId: req.user._id, actorRole: req.user.role, action: 'CASE_SHARE_REVOKED', targetType: 'CaseShareGrant', targetId: claim.shareGrantId, metadata: { claimReference: claim.claimReference } });
  await notifyOrganizationRoles(claim.payerOrganizationId, PAYER_ROLES, { type: 'CLAIM_WITHDRAWN', title: 'Claim withdrawn', body: `Claim ${claim.claimReference} was withdrawn and case access revoked.`, link: '/payer/claims' });
  res.json(claimantView(await updated.populate('payerOrganizationId', 'name')));
});

// ───────────────────────── Insurer (payer) ─────────────────────────

const payerListClaims = handle(async (req, res) => {
  const filter = { payerOrganizationId: req.tenantContext.organizationId };
  if (req.query.status && sm.CLAIM_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const claims = await Claim.find(filter).populate('caseId', 'caseReference').sort('-createdAt').limit(200).lean();
  res.json(claims.map((c) => ({
    id: String(c._id), claimReference: c.claimReference, caseReference: c.caseId?.caseReference, status: c.status,
    claimedAmount: c.claimedAmount, currency: c.currency, openQueries: (c.queries || []).filter((q) => !q.answer).length,
    createdAt: c.createdAt, ageHours: Math.round((Date.now() - new Date(c.createdAt).getTime()) / 3600000)
  })));
});

const payerGetClaim = handle(async (req, res) => {
  const claim = await payerClaim(req);
  const grant = await activeGrantFor(claim);
  const scope = new Set(grant.scope);
  const caseId = claim.caseId;
  const vCase = await VerificationCase.findById(caseId).select('caseReference status subjectReference updatedAt').lean();

  const [documents, fields, checks, signals, reviews, pharmacyOrg] = await Promise.all([
    scope.has('documents') ? Document.find({ caseId }).select('type mimeType sizeBytes pageCount processedPageCount omittedPageCount uploadStatus processingStatus createdAt').lean() : [],
    scope.has('extracted_fields') ? ExtractedField.find({ caseId }).select('documentId fieldType normalizedValue rawValue pageNumber extractionConfidence needsCorrection correctedAt').lean() : [],
    scope.has('consistency_checks') ? ConsistencyCheck.find({ caseId }).select('checkType status severity message reviewRequired').lean() : [],
    scope.has('risk_signals') ? RiskSignal.find({ caseId }).select('signalType severity description reviewRequired').lean() : [],
    scope.has('review_decisions') ? ReviewDecision.find({ caseId }).select('decision reasonCode notes createdAt').lean() : [],
    Organization.findById(claim.pharmacyOrganizationId).select('name').lean()
  ]);

  await auditLoggerService.logEvent({ caseId, actorId: req.user._id, actorRole: req.user.role, action: 'PAYER_VIEWED_CASE', targetType: 'Claim', targetId: claim._id, metadata: { claimReference: claim.claimReference } });

  const strip = (rows) => rows.map(({ _id, ...rest }) => ({ id: String(_id), ...rest }));
  res.json({
    claim: { ...claimantView(claim), payerName: undefined },
    consent: { grantedAt: grant.createdAt, expiresAt: grant.expiresAt, scope: grant.scope },
    pharmacyName: pharmacyOrg?.name || 'Pharmacy',
    case: vCase ? { id: String(vCase._id), caseReference: vCase.caseReference, status: vCase.status, subjectReference: vCase.subjectReference, updatedAt: vCase.updatedAt } : null,
    documents: strip(documents),
    extractedFields: strip(fields).map((f) => ({ ...f, documentId: String(f.documentId) })),
    consistencyChecks: strip(checks),
    riskSignals: strip(signals),
    reviewDecisions: strip(reviews),
    reasonCodes: { rejected: sm.REJECTION_REASON_CODES, partial: sm.PARTIAL_REASON_CODES }
  });
});

const payerDocumentContent = handle(async (req, res) => {
  const claim = await payerClaim(req);
  const grant = await activeGrantFor(claim);
  if (!grant.scope.includes('documents') || !validId(req.params.documentId)) throw notFound();
  const doc = await Document.findOne({ _id: req.params.documentId, caseId: claim.caseId });
  if (!doc) throw notFound();
  const buffer = await storageService.getDocumentBuffer(claim.caseId, doc.objectStorageKey);
  await auditLoggerService.logEvent({ caseId: claim.caseId, actorId: req.user._id, actorRole: req.user.role, action: 'PAYER_VIEWED_DOCUMENT', targetType: 'Document', targetId: doc._id, metadata: { claimReference: claim.claimReference } });
  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(buffer);
});

const payerStartReview = handle(async (req, res) => {
  const claim = await payerClaim(req);
  await activeGrantFor(claim);
  const updated = await transition(claim._id, 'SUBMITTED', 'UNDER_PAYER_REVIEW', req, { set: { reviewStartedAt: new Date() } });
  await notifyUsers([claim.claimantId], { type: 'CLAIM_UNDER_REVIEW', title: 'Your claim is under review', body: `Claim ${claim.claimReference} is being reviewed by the insurer.`, link: '/patient/claims' });
  res.json(claimantView(updated));
});

const payerRaiseQuery = handle(async (req, res) => {
  const claim = await payerClaim(req);
  await activeGrantFor(claim);
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (question.length < 5 || question.length > 2000) throw sm.controlled(400, 'INVALID_QUESTION', 'Question must be 5–2000 characters.');
  const updated = await transition(claim._id, 'UNDER_PAYER_REVIEW', 'QUERY_RAISED', req, {
    push: { queries: { question, askedBy: req.user._id, askedAt: new Date() } }
  });
  await notifyUsers([claim.claimantId], { type: 'CLAIM_QUERY_RAISED', title: 'Insurer has a question', body: `Please answer the query on claim ${claim.claimReference}.`, link: '/patient/claims' });
  res.json(claimantView(updated));
});

const payerDecide = handle(async (req, res) => {
  const claim = await payerClaim(req);
  await activeGrantFor(claim);
  const decision = sm.validateDecision(req.body || {}, claim.claimedAmount);
  const updated = await transition(claim._id, 'UNDER_PAYER_REVIEW', decision.decision, req, {
    set: { decision: { ...decision, decidedBy: req.user._id, decidedAt: new Date() } }
  });
  const label = { APPROVED: 'approved', PARTIALLY_APPROVED: 'partially approved', REJECTED: 'not approved' }[decision.decision];
  await notifyUsers([claim.claimantId], { type: 'CLAIM_DECIDED', title: 'Claim decision recorded', body: `Claim ${claim.claimReference} was ${label} by the insurer.`, link: '/patient/claims' });
  res.json(claimantView(updated));
});

const payerSettle = handle(async (req, res) => {
  const claim = await payerClaim(req);
  const reference = `SIM-SETTLE-${Date.now().toString(36).toUpperCase()}`;
  const updated = await transition(claim._id, claim.status, 'SETTLED', req, { set: { settlement: { reference, settledAt: new Date(), simulated: true } } });
  await notifyUsers([claim.claimantId], { type: 'CLAIM_SETTLED', title: 'Claim settled (demo)', body: `Claim ${claim.claimReference} was marked settled. This is a simulated settlement; no money moved.`, link: '/patient/claims' });
  res.json(claimantView(updated));
});

const payerFhirBundle = handle(async (req, res) => {
  const claim = await payerClaim(req);
  const grant = await activeGrantFor(claim);
  const [vCase, documents, pharmacyOrg, payerOrg] = await Promise.all([
    VerificationCase.findById(claim.caseId).lean(),
    grant.scope.includes('documents') ? Document.find({ caseId: claim.caseId }).select('type mimeType sha256').lean() : [],
    Organization.findById(claim.pharmacyOrganizationId).select('name').lean(),
    Organization.findById(claim.payerOrganizationId).select('name').lean()
  ]);
  const bundle = buildClaimBundle({
    claim: { ...claim.toObject(), id: String(claim._id) },
    verificationCase: { ...vCase, id: String(vCase._id) },
    documents: documents.map((d) => ({ id: String(d._id), type: d.type, mimeType: d.mimeType, sha256: d.sha256 })),
    pharmacyOrg: pharmacyOrg && { id: String(pharmacyOrg._id), name: pharmacyOrg.name },
    payerOrg: payerOrg && { id: String(payerOrg._id), name: payerOrg.name }
  });
  const validation = validateBundle(bundle);
  res.setHeader('X-PharmaVault-FHIR-Validation', validation.valid ? 'structural-pass' : 'structural-fail');
  res.json({ bundle, validation, disclaimer: 'Draft FHIR R4, NHCX-aligned academic export. Not certified NHCX conformance.' });
});

const payerAnalytics = handle(async (req, res) => {
  const orgId = new mongoose.Types.ObjectId(String(req.tenantContext.organizationId));
  const [byStatus, decided] = await Promise.all([
    Claim.aggregate([{ $match: { payerOrganizationId: orgId } }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$claimedAmount' } } }]),
    Claim.aggregate([
      { $match: { payerOrganizationId: orgId, 'decision.decidedAt': { $ne: null } } },
      { $project: { hours: { $divide: [{ $subtract: ['$decision.decidedAt', '$createdAt'] }, 3600000] }, queried: { $gt: [{ $size: '$queries' }, 0] } } },
      { $group: { _id: null, decided: { $sum: 1 }, avgHours: { $avg: '$hours' }, withQuery: { $sum: { $cond: ['$queried', 1, 0] } } } }
    ])
  ]);
  const d = decided[0] || { decided: 0, avgHours: null, withQuery: 0 };
  res.json({
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, { count: s.count, claimedAmount: s.amount }])),
    decidedCount: d.decided,
    averageDecisionHours: d.avgHours === null ? null : Math.round(d.avgHours * 10) / 10,
    queryRate: d.decided ? Math.round((d.withQuery / d.decided) * 1000) / 10 : null,
    note: 'Counts come from recorded claims in this organization only.'
  });
});

// ───────────────────────── Pharmacy staff (read-only status) ─────────────────────────

const pharmacyLinkedClaims = handle(async (req, res) => {
  const claims = await Claim.find({ pharmacyOrganizationId: req.tenantContext.organizationId })
    .populate('caseId', 'caseReference').populate('payerOrganizationId', 'name').sort('-updatedAt').limit(200).lean();
  res.json(claims.map((c) => ({
    id: String(c._id), claimReference: c.claimReference, caseId: String(c.caseId?._id || c.caseId), caseReference: c.caseId?.caseReference,
    payerName: c.payerOrganizationId?.name, status: c.status, openQueries: (c.queries || []).filter((q) => !q.answer).length, updatedAt: c.updatedAt
  })));
});

// ───────────────────────── Notifications (all roles) ─────────────────────────

const listNotifications = handle(async (req, res) => {
  const items = await Notification.find({ userId: req.user._id }).sort('-createdAt').limit(50).lean();
  res.json({
    unread: items.filter((n) => !n.readAt).length,
    items: items.map((n) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body, link: n.link, readAt: n.readAt, createdAt: n.createdAt, emailDelivery: n.delivery?.email }))
  });
});

const markNotificationRead = handle(async (req, res) => {
  if (!validId(req.params.notificationId)) throw notFound();
  await Notification.updateOne({ _id: req.params.notificationId, userId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});

const markAllNotificationsRead = handle(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});

module.exports = {
  PAYER_ROLES,
  PHARMACY_STAFF,
  listPayers, listEligibleCases, submitClaim, listMyClaims, getMyClaim, answerQuery, withdrawClaim,
  payerListClaims, payerGetClaim, payerDocumentContent, payerStartReview, payerRaiseQuery, payerDecide, payerSettle, payerFhirBundle, payerAnalytics,
  pharmacyLinkedClaims,
  listNotifications, markNotificationRead, markAllNotificationsRead
};
