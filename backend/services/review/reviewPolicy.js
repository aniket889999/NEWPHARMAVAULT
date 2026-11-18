'use strict';

/**
 * Reviewer workflow rules. Pure module (no database), unit-tested.
 *
 * - Four-eyes: the person who created a case or uploaded any of its documents
 *   cannot give it the final VERIFY. Escalate / Return for Correction stay allowed.
 * - Assignment: a reviewer "takes" a case for a time-limited lease. While the
 *   lease is active nobody else can record a decision on it.
 * - Reopen: only an organization admin can reopen a finished case, with a reason,
 *   and never while an insurance claim on it is still open.
 * - Queue paging: bounded page sizes and whitelisted filters.
 */

const DEFAULT_ASSIGNMENT_MINUTES = 30;
const MAX_ASSIGNMENT_MINUTES = 240;
const REOPENABLE_STATUSES = Object.freeze(['VERIFIED', 'REJECTED']);
const REOPEN_ROLES = Object.freeze(['org_admin', 'super_admin']);
const ASSIGNMENT_OVERRIDE_ROLES = Object.freeze(['org_admin', 'super_admin']);
const OPEN_CLAIM_STATUSES = Object.freeze(['SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED', 'APPROVED', 'PARTIALLY_APPROVED', 'APPEALED']);
const QUEUE_STATUSES = Object.freeze(['NEEDS_REVIEW', 'NEEDS_CORRECTION']);

function controlled(statusCode, code, message, extra = {}) {
  return Object.assign(new Error(message), { statusCode, code, ...extra });
}

const sameId = (a, b) => a != null && b != null && String(a?._id ?? a) === String(b?._id ?? b);

/** Returns a violation code or null. Applies only to the final VERIFY action. */
function fourEyesViolation({ action, reviewerId, vCase, documentUploaderIds = [] }) {
  if (action !== 'VERIFY') return null;
  if (sameId(vCase.createdBy, reviewerId)) return 'FOUR_EYES_CASE_CREATOR';
  if (documentUploaderIds.some((id) => sameId(id, reviewerId))) return 'FOUR_EYES_DOCUMENT_UPLOADER';
  return null;
}

/**
 * Applies the organization's single-reviewer setting to a four-eyes violation.
 * Returns { code } to block, or { override: true } when the reviewer confirmed.
 */
function resolveFourEyes(violation, { orgAllowsSingleReviewer = false, confirmed = false } = {}) {
  if (!violation) return { code: null, override: false };
  if (!orgAllowsSingleReviewer) return { code: violation, override: false };
  if (confirmed !== true) return { code: 'FOUR_EYES_CONFIRMATION_REQUIRED', override: false };
  return { code: null, override: true };
}

function assignmentMinutes(env = process.env) {
  const raw = Number(env.REVIEW_ASSIGNMENT_MINUTES);
  if (!Number.isInteger(raw) || raw <= 0) return DEFAULT_ASSIGNMENT_MINUTES;
  return Math.min(raw, MAX_ASSIGNMENT_MINUTES);
}

function activeAssignment(vCase, now = new Date()) {
  if (!vCase?.assignedTo || !vCase.assignmentExpiresAt) return null;
  if (new Date(vCase.assignmentExpiresAt) <= now) return null;
  return { assignedTo: vCase.assignedTo, assignedAt: vCase.assignedAt, expiresAt: vCase.assignmentExpiresAt };
}

/** Throws when someone else holds an active lease on the case. */
function assertNotAssignedToOther(vCase, userId, now = new Date()) {
  const active = activeAssignment(vCase, now);
  if (active && !sameId(active.assignedTo, userId)) {
    throw controlled(409, 'CASE_ASSIGNED_TO_OTHER', 'Another reviewer is working on this case. Wait for them to finish or ask an organization admin to reassign it.', {
      assignment: { expiresAt: active.expiresAt }
    });
  }
}

/** MongoDB filter that only matches a case the user may take now. */
function takeableFilter(caseId, userId, { override = false, now = new Date() } = {}) {
  if (override) return { _id: caseId };
  return {
    _id: caseId,
    $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }, { assignmentExpiresAt: { $lte: now } }, { assignedTo: userId }]
  };
}

function validateReopen({ role, status, reason, openClaimCount }) {
  if (!REOPEN_ROLES.includes(role)) throw controlled(403, 'FORBIDDEN_ROLE', 'Only an organization administrator can reopen a finished case.');
  if (!REOPENABLE_STATUSES.includes(status)) throw controlled(409, 'CASE_NOT_REOPENABLE', `A case in ${status} status cannot be reopened.`);
  const clean = typeof reason === 'string' ? reason.trim() : '';
  if (clean.length < 10 || clean.length > 2000) throw controlled(400, 'REOPEN_REASON_REQUIRED', 'A reopen reason of 10–2000 characters is required.');
  if (openClaimCount > 0) throw controlled(409, 'CLAIM_IN_PROGRESS', 'This case has an insurance claim in progress. It cannot be reopened until the claim is settled, rejected or withdrawn.');
  return clean;
}

function parseQueueQuery(query = {}) {
  const int = (value, fallback, min, max) => {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback;
  };
  const page = int(query.page, 1, 1, 10_000);
  const limit = int(query.limit, 50, 1, 100);
  const status = QUEUE_STATUSES.includes(query.status) ? query.status : null;
  const assigned = ['me', 'unassigned', 'others'].includes(query.assigned) ? query.assigned : null;
  const sort = query.sort === 'newest' ? 'newest' : 'oldest';
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 64) : '';
  return { page, limit, status, assigned, sort, q };
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds the MongoDB filter for a reviewer queue on top of the tenant filter. */
function queueFilter(base, { status, assigned, q }, userId, now = new Date()) {
  const filter = { ...base, status: status ? status : { $in: QUEUE_STATUSES } };
  const and = [];
  if (q) {
    const rx = new RegExp(`^${escapeRegex(q)}`, 'i');
    and.push({ $or: [{ caseReference: rx }, { subjectReference: rx }] });
  }
  const free = { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }, { assignmentExpiresAt: { $lte: now } }] };
  if (assigned === 'me') and.push({ assignedTo: userId, assignmentExpiresAt: { $gt: now } });
  if (assigned === 'unassigned') and.push(free);
  if (assigned === 'others') and.push({ assignedTo: { $nin: [null, userId] }, assignmentExpiresAt: { $gt: now } });
  if (and.length) filter.$and = and;
  return filter;
}

function setPagingHeaders(res, { page, limit, total }) {
  res.setHeader('X-Total-Count', String(total));
  res.setHeader('X-Page', String(page));
  res.setHeader('X-Limit', String(limit));
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Limit');
}

module.exports = {
  DEFAULT_ASSIGNMENT_MINUTES,
  REOPENABLE_STATUSES,
  REOPEN_ROLES,
  ASSIGNMENT_OVERRIDE_ROLES,
  OPEN_CLAIM_STATUSES,
  QUEUE_STATUSES,
  controlled,
  sameId,
  fourEyesViolation,
  resolveFourEyes,
  assignmentMinutes,
  activeAssignment,
  assertNotAssignedToOther,
  takeableFilter,
  validateReopen,
  parseQueueQuery,
  queueFilter,
  setPagingHeaders
};
