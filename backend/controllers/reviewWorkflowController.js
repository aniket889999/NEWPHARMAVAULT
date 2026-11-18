'use strict';

/**
 * Reviewer workflow: take / release a case (time-limited lease) and reopen a
 * finished case. Decisions themselves stay in trustRagController.submitReview.
 */
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const VerificationCase = require('../models/verificationCaseModel');
const Claim = require('../models/claimModel');
const auditLoggerService = require('../services/trustRag/auditLoggerService');
const { REVIEW_ROLES } = require('../services/trustRag/caseReconciliationService');
const { bumpCaseEvidenceRevision } = require('../services/trustRag/caseEvidenceMutationService');
const { withCaseMutationGuard } = require('../services/platform/caseGuard');
const { notifyUsers } = require('../services/claims/notificationService');
const policy = require('../services/review/reviewPolicy');

function sendError(res, err) {
  const status = err.statusCode || 500;
  const body = { code: err.code || 'REVIEW_WORKFLOW_ERROR', message: status >= 500 ? 'Review workflow error.' : err.message };
  if (err.assignment) body.assignment = err.assignment;
  res.status(status).json(body);
}

const handle = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.statusCode || err.code) return sendError(res, err);
    throw err;
  }
});

/** Loads a case inside the reviewer's own organization (fails closed). */
async function staffCase(req) {
  if (!REVIEW_ROLES.includes(req.user.role)) throw policy.controlled(403, 'FORBIDDEN_ROLE', 'Only authorized reviewers can manage case assignment.');
  if (!mongoose.Types.ObjectId.isValid(req.params.caseId)) throw policy.controlled(404, 'CASE_NOT_FOUND', 'Verification case not found');
  const filter = { _id: req.params.caseId };
  if (req.user.role !== 'super_admin') {
    if (!req.tenantContext?.organizationId) throw policy.controlled(403, 'NO_TENANT', 'Staff user has no organization tenant context.');
    filter.organizationId = req.tenantContext.organizationId;
  }
  const vCase = await VerificationCase.findOne(filter);
  if (!vCase) throw policy.controlled(404, 'CASE_NOT_FOUND', 'Verification case not found');
  return vCase;
}

const assignmentView = (vCase, userId) => {
  const active = policy.activeAssignment(vCase);
  return {
    caseId: String(vCase._id),
    status: vCase.status,
    assignment: active
      ? { assignedTo: String(active.assignedTo?._id || active.assignedTo), assignedToMe: policy.sameId(active.assignedTo, userId), assignedAt: active.assignedAt, expiresAt: active.expiresAt }
      : null
  };
};

// POST /api/v1/review/cases/:caseId/assignment  { force?: boolean }
const takeCase = handle(async (req, res) => {
  const vCase = await staffCase(req);
  if (!policy.QUEUE_STATUSES.includes(vCase.status)) throw policy.controlled(409, 'CASE_NOT_REVIEWABLE', `A case in ${vCase.status} status is not in the review queue.`);
  const override = req.body?.force === true;
  if (override && !policy.ASSIGNMENT_OVERRIDE_ROLES.includes(req.user.role)) throw policy.controlled(403, 'FORBIDDEN_ROLE', 'Only an organization admin can reassign a case held by someone else.');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + policy.assignmentMinutes() * 60_000);
  const previous = policy.activeAssignment(vCase, now);
  const updated = await VerificationCase.findOneAndUpdate(
    policy.takeableFilter(vCase._id, req.user._id, { override, now }),
    { $set: { assignedTo: req.user._id, assignedAt: previous && policy.sameId(previous.assignedTo, req.user._id) ? previous.assignedAt : now, assignmentExpiresAt: expiresAt } },
    { new: true, timestamps: false }
  );
  if (!updated) policy.assertNotAssignedToOther(await VerificationCase.findById(vCase._id), req.user._id, now);

  const action = override && previous && !policy.sameId(previous.assignedTo, req.user._id) ? 'REVIEW_CASE_REASSIGNED' : 'REVIEW_CASE_TAKEN';
  await auditLoggerService.logEvent({
    caseId: vCase._id, actorId: req.user._id, actorRole: req.user.role, action, targetType: 'VerificationCase', targetId: vCase._id,
    metadata: { expiresAt: expiresAt.toISOString(), previousAssignee: previous ? String(previous.assignedTo) : null }
  });
  res.json(assignmentView(updated || vCase, req.user._id));
});

// DELETE /api/v1/review/cases/:caseId/assignment
const releaseCase = handle(async (req, res) => {
  const vCase = await staffCase(req);
  const filter = { _id: vCase._id };
  if (!policy.ASSIGNMENT_OVERRIDE_ROLES.includes(req.user.role)) filter.assignedTo = req.user._id;
  const updated = await VerificationCase.findOneAndUpdate(filter, { $set: { assignedTo: null, assignedAt: null, assignmentExpiresAt: null } }, { new: true, timestamps: false });
  if (!updated) throw policy.controlled(409, 'NOT_ASSIGNED_TO_YOU', 'You do not hold this case.');
  await auditLoggerService.logEvent({ caseId: vCase._id, actorId: req.user._id, actorRole: req.user.role, action: 'REVIEW_CASE_RELEASED', targetType: 'VerificationCase', targetId: vCase._id, metadata: {} });
  res.json(assignmentView(updated, req.user._id));
});

// GET /api/v1/review/cases/:caseId/assignment
const getAssignment = handle(async (req, res) => {
  const vCase = await staffCase(req);
  await vCase.populate('assignedTo', 'name role');
  const view = assignmentView(vCase, req.user._id);
  if (view.assignment) view.assignment.assigneeName = vCase.assignedTo?.name || null;
  res.json(view);
});

// POST /api/v1/review/cases/:caseId/reopen  { reason }
const reopenCase = handle(async (req, res) => {
  const initial = await staffCase(req);
  const result = await withCaseMutationGuard(initial._id, async () => {
    const vCase = await VerificationCase.findById(initial._id);
    const openClaimCount = await Claim.countDocuments({ caseId: vCase._id, status: { $in: policy.OPEN_CLAIM_STATUSES } });
    const reason = policy.validateReopen({ role: req.user.role, status: vCase.status, reason: req.body?.reason, openClaimCount });
    const previousStatus = vCase.status;
    vCase.status = 'NEEDS_REVIEW';
    vCase.reviewRequired = true;
    vCase.reopenCount = (vCase.reopenCount || 0) + 1;
    vCase.assignedTo = null;
    vCase.assignedAt = null;
    vCase.assignmentExpiresAt = null;
    // New evidence revision: every snapshotToken issued before the reopen becomes stale.
    bumpCaseEvidenceRevision(vCase);
    await vCase.save();
    await auditLoggerService.logEvent({
      caseId: vCase._id, actorId: req.user._id, actorRole: req.user.role, action: 'CASE_REOPENED', targetType: 'VerificationCase', targetId: vCase._id,
      metadata: { previousStatus, reason, reopenCount: vCase.reopenCount, evidenceRevision: vCase.evidenceRevision }
    });
    return { vCase, previousStatus };
  });
  await notifyUsers([result.vCase.createdBy], {
    type: 'CASE_REOPENED', title: 'Your verification case was reopened',
    body: `Case ${result.vCase.caseReference} is back in review. You will be notified of the new decision.`, link: `/cases/${result.vCase._id}`
  });
  res.json({ caseId: String(result.vCase._id), status: result.vCase.status, previousStatus: result.previousStatus, reopenCount: result.vCase.reopenCount, evidenceRevision: result.vCase.evidenceRevision });
});

module.exports = { takeCase, releaseCase, getAssignment, reopenCase };
