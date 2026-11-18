'use strict';

/**
 * Claim lifecycle for the claimant ↔ insurer (payer) workflow.
 * Pure module: no database, safe to unit test anywhere.
 *
 * Every decision is recorded by a human. Nothing here approves or rejects
 * a claim automatically.
 */

const CLAIM_STATUSES = Object.freeze([
  'SUBMITTED',
  'UNDER_PAYER_REVIEW',
  'QUERY_RAISED',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'SETTLED',
  'WITHDRAWN',
  'APPEALED'
]);

const DECISION_STATUSES = Object.freeze(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED']);
// REJECTED is final once the single appeal has been used (see isTerminal).
const TERMINAL_STATUSES = Object.freeze(['SETTLED', 'WITHDRAWN']);
const MAX_APPEALS = 1;

const CLAIMANT_ROLES = Object.freeze(['patient']);
const PAYER_ROLES = Object.freeze(['payer_reviewer', 'payer_admin']);

// from -> to -> roles allowed to make that move
const TRANSITIONS = Object.freeze({
  SUBMITTED: {
    UNDER_PAYER_REVIEW: PAYER_ROLES,
    WITHDRAWN: CLAIMANT_ROLES
  },
  UNDER_PAYER_REVIEW: {
    QUERY_RAISED: PAYER_ROLES,
    APPROVED: PAYER_ROLES,
    PARTIALLY_APPROVED: PAYER_ROLES,
    REJECTED: PAYER_ROLES,
    WITHDRAWN: CLAIMANT_ROLES
  },
  QUERY_RAISED: {
    UNDER_PAYER_REVIEW: [...CLAIMANT_ROLES, ...PAYER_ROLES],
    WITHDRAWN: CLAIMANT_ROLES
  },
  APPROVED: { SETTLED: ['payer_admin'] },
  // The claimant may appeal a partial or negative decision once (see MAX_APPEALS).
  PARTIALLY_APPROVED: { SETTLED: ['payer_admin'], APPEALED: CLAIMANT_ROLES },
  REJECTED: { APPEALED: CLAIMANT_ROLES },
  APPEALED: {
    UNDER_PAYER_REVIEW: PAYER_ROLES,
    WITHDRAWN: CLAIMANT_ROLES
  },
  SETTLED: {},
  WITHDRAWN: {}
});

const REJECTION_REASON_CODES = Object.freeze([
  'DOCUMENT_MISMATCH',
  'MISSING_DOCUMENT',
  'NOT_COVERED_UNDER_POLICY',
  'DUPLICATE_CLAIM',
  'POLICY_INACTIVE',
  'OTHER'
]);

const PARTIAL_REASON_CODES = Object.freeze([
  'ITEM_NOT_COVERED',
  'QUANTITY_LIMIT',
  'AMOUNT_ABOVE_LIMIT',
  'DOCUMENT_MISMATCH',
  'OTHER'
]);

function controlled(status, code, message) {
  return Object.assign(new Error(message), { statusCode: status, code });
}

function canTransition(from, to, role) {
  const allowed = TRANSITIONS[from]?.[to];
  return Array.isArray(allowed) && allowed.includes(role);
}

function assertTransition(from, to, role) {
  if (!CLAIM_STATUSES.includes(from) || !CLAIM_STATUSES.includes(to)) {
    throw controlled(400, 'UNKNOWN_CLAIM_STATUS', 'Unknown claim status.');
  }
  if (!canTransition(from, to, role)) {
    throw controlled(409, 'INVALID_CLAIM_TRANSITION', `A ${role} cannot move a claim from ${from} to ${to}.`);
  }
}

function toPaise(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return NaN;
  return Math.round(amount * 100);
}

/**
 * Validates a claim amount in rupees: positive, at most 2 decimals, below a sane ceiling.
 */
function validateAmount(amount, { field = 'amount', max = 10_000_000 } = {}) {
  const paise = toPaise(amount);
  if (!Number.isInteger(paise) || paise <= 0 || Math.abs(amount * 100 - paise) > 1e-6 || amount > max) {
    throw controlled(400, 'INVALID_AMOUNT', `${field} must be a positive rupee amount with at most two decimals.`);
  }
  return paise / 100;
}

/**
 * Validates a human payer decision. Returns the normalized decision.
 */
function validateDecision({ decision, approvedAmount, reasonCode, note }, claimedAmount) {
  if (!DECISION_STATUSES.includes(decision)) {
    throw controlled(400, 'INVALID_DECISION', `decision must be one of ${DECISION_STATUSES.join(', ')}.`);
  }
  const cleanNote = typeof note === 'string' ? note.trim() : '';
  if (cleanNote.length < 10 || cleanNote.length > 2000) {
    throw controlled(400, 'DECISION_NOTE_REQUIRED', 'A decision note of 10–2000 characters is required.');
  }
  if (decision === 'APPROVED') {
    const amount = approvedAmount === undefined ? claimedAmount : validateAmount(approvedAmount, { field: 'approvedAmount' });
    if (toPaise(amount) !== toPaise(claimedAmount)) {
      throw controlled(400, 'APPROVED_AMOUNT_MISMATCH', 'Full approval must equal the claimed amount; use PARTIALLY_APPROVED otherwise.');
    }
    return { decision, approvedAmount: amount, reasonCode: null, note: cleanNote };
  }
  if (decision === 'PARTIALLY_APPROVED') {
    const amount = validateAmount(approvedAmount, { field: 'approvedAmount' });
    if (toPaise(amount) >= toPaise(claimedAmount)) {
      throw controlled(400, 'PARTIAL_AMOUNT_INVALID', 'Partial approval must be less than the claimed amount.');
    }
    if (!PARTIAL_REASON_CODES.includes(reasonCode)) {
      throw controlled(400, 'REASON_CODE_REQUIRED', `reasonCode must be one of ${PARTIAL_REASON_CODES.join(', ')}.`);
    }
    return { decision, approvedAmount: amount, reasonCode, note: cleanNote };
  }
  if (!REJECTION_REASON_CODES.includes(reasonCode)) {
    throw controlled(400, 'REASON_CODE_REQUIRED', `reasonCode must be one of ${REJECTION_REASON_CODES.join(', ')}.`);
  }
  return { decision, approvedAmount: 0, reasonCode, note: cleanNote };
}

function isTerminal(status, appealCount = 0) {
  if (status === 'REJECTED') return appealCount >= MAX_APPEALS;
  return TERMINAL_STATUSES.includes(status);
}

function validateAppeal({ status, appealCount = 0, reason }) {
  if (!['REJECTED', 'PARTIALLY_APPROVED'].includes(status)) {
    throw controlled(409, 'NOT_APPEALABLE', 'Only a rejected or partially approved claim can be appealed.');
  }
  if (appealCount >= MAX_APPEALS) throw controlled(409, 'APPEAL_ALREADY_USED', 'This claim has already been appealed once.');
  const clean = typeof reason === 'string' ? reason.trim() : '';
  if (clean.length < 20 || clean.length > 2000) throw controlled(400, 'APPEAL_REASON_REQUIRED', 'Explain the appeal in 20–2000 characters.');
  return clean;
}

module.exports = {
  CLAIM_STATUSES,
  DECISION_STATUSES,
  TERMINAL_STATUSES,
  CLAIMANT_ROLES,
  PAYER_ROLES,
  TRANSITIONS,
  REJECTION_REASON_CODES,
  PARTIAL_REASON_CODES,
  canTransition,
  assertTransition,
  validateAmount,
  validateDecision,
  isTerminal,
  validateAppeal,
  MAX_APPEALS,
  controlled
};
