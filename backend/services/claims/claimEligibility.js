'use strict';

/**
 * Can this verified case be claimed (again), and up to what amount?
 * Pure module: callers pass the case's existing claims and its verified bill total.
 *
 * Rules (one pharmacy bill must never be paid twice):
 *  - only one open claim per case, across all insurers;
 *  - an insurer that already decided a claim on this case is not asked again (appeal instead);
 *  - the amount still claimable is the verified bill minus what insurers already approved.
 */

const OPEN_STATUSES = Object.freeze(['SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED', 'APPEALED']);
const DECIDED_STATUSES = Object.freeze(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED']);
const PAYABLE_STATUSES = Object.freeze(['APPROVED', 'PARTIALLY_APPROVED', 'SETTLED']);

const round2 = (n) => Math.round(n * 100) / 100;
const sameId = (a, b) => a != null && b != null && String(a?._id ?? a) === String(b?._id ?? b);

function approvedAmountOf(claim) {
  if (!PAYABLE_STATUSES.includes(claim.status)) return 0;
  const settled = claim.settlement?.amount;
  if (typeof settled === 'number' && Number.isFinite(settled)) return settled;
  const approved = claim.decision?.approvedAmount;
  return typeof approved === 'number' && Number.isFinite(approved) ? approved : 0;
}

/**
 * @param {object} p
 * @param {number|null} p.invoiceTotal verified bill total, or null when unknown
 * @param {Array} p.claims existing claims on the case ({ status, payerOrganizationId, claimReference, decision, settlement })
 * @param {string} [p.payerOrganizationId] the insurer the claimant is about to choose
 * @returns {{ claimable: boolean, code: string|null, message: string|null, approvedSoFar: number, remainingAmount: number|null, openClaimReference: string|null }}
 */
function claimEligibility({ invoiceTotal = null, claims = [], payerOrganizationId = null }) {
  const approvedSoFar = round2(claims.reduce((sum, c) => sum + approvedAmountOf(c), 0));
  const remainingAmount = invoiceTotal === null || invoiceTotal === undefined ? null : Math.max(0, round2(invoiceTotal - approvedSoFar));
  const base = { approvedSoFar, remainingAmount, openClaimReference: null };

  const open = claims.find((c) => OPEN_STATUSES.includes(c.status));
  if (open) {
    const samePayer = payerOrganizationId && sameId(open.payerOrganizationId, payerOrganizationId);
    return {
      ...base,
      claimable: false,
      openClaimReference: open.claimReference || null,
      code: samePayer ? 'DUPLICATE_OPEN_CLAIM' : 'CASE_HAS_OPEN_CLAIM',
      message: samePayer
        ? `An open claim (${open.claimReference}) already exists for this case and insurer.`
        : `Claim ${open.claimReference} on this case is still open. Wait for its decision or withdraw it first.`
    };
  }
  if (payerOrganizationId) {
    const decided = claims.find((c) => DECIDED_STATUSES.includes(c.status) && sameId(c.payerOrganizationId, payerOrganizationId));
    if (decided) {
      return {
        ...base,
        claimable: false,
        code: 'ALREADY_DECIDED_BY_PAYER',
        message: `This insurer already decided claim ${decided.claimReference} on this case. Appeal that decision instead of claiming again.`
      };
    }
  }
  if (remainingAmount !== null && remainingAmount <= 0) {
    return { ...base, claimable: false, code: 'CASE_FULLY_CLAIMED', message: 'The verified bill for this case has already been fully approved by an insurer.' };
  }
  return { ...base, claimable: true, code: null, message: null };
}

/** Throws-free amount check against what is still claimable. Returns an error code or null. */
function amountBlocker(amount, { remainingAmount }) {
  if (remainingAmount === null || remainingAmount === undefined) return null;
  return amount > remainingAmount + 0.005 ? 'CLAIM_EXCEEDS_INVOICE' : null;
}

module.exports = { claimEligibility, amountBlocker, approvedAmountOf, OPEN_STATUSES, DECIDED_STATUSES, PAYABLE_STATUSES };
