'use strict';

// Database-free tests for the claims state machine, TOTP MFA and FHIR validation.
const test = require('node:test');
const assert = require('node:assert/strict');

const sm = require('../services/claims/claimStateMachine');
const totp = require('../utils/totp');
const { buildCaseBundle, buildClaimBundle } = require('../services/fhir/fhirBundleBuilder');
const { validateBundle } = require('../services/fhir/fhirR4Validator');

test('claim state machine: payer opens, queries and decides; claimant cannot decide', () => {
  assert.equal(sm.canTransition('SUBMITTED', 'UNDER_PAYER_REVIEW', 'payer_reviewer'), true);
  assert.equal(sm.canTransition('UNDER_PAYER_REVIEW', 'APPROVED', 'payer_reviewer'), true);
  assert.equal(sm.canTransition('UNDER_PAYER_REVIEW', 'APPROVED', 'patient'), false);
  assert.equal(sm.canTransition('QUERY_RAISED', 'UNDER_PAYER_REVIEW', 'patient'), true);
  assert.equal(sm.canTransition('APPROVED', 'SETTLED', 'payer_reviewer'), false);
  assert.equal(sm.canTransition('APPROVED', 'SETTLED', 'payer_admin'), true);
  assert.equal(sm.canTransition('REJECTED', 'APPROVED', 'payer_admin'), false);
  assert.equal(sm.canTransition('SUBMITTED', 'APPROVED', 'payer_reviewer'), false, 'must open review first');
  assert.throws(() => sm.assertTransition('SETTLED', 'WITHDRAWN', 'patient'), { code: 'INVALID_CLAIM_TRANSITION' });
  assert.equal(sm.isTerminal('WITHDRAWN'), true);
});

test('claim amounts: positive, two decimals, ceiling', () => {
  assert.equal(sm.validateAmount(450.5), 450.5);
  for (const bad of [0, -1, 10.123, NaN, '100', 20_000_000]) {
    assert.throws(() => sm.validateAmount(bad), { code: 'INVALID_AMOUNT' });
  }
});

test('payer decisions require a human note, reason codes and consistent amounts', () => {
  const note = 'Prescription and invoice strengths match.';
  assert.deepEqual(sm.validateDecision({ decision: 'APPROVED', note }, 500), { decision: 'APPROVED', approvedAmount: 500, reasonCode: null, note });
  assert.throws(() => sm.validateDecision({ decision: 'APPROVED', approvedAmount: 400, note }, 500), { code: 'APPROVED_AMOUNT_MISMATCH' });
  assert.throws(() => sm.validateDecision({ decision: 'APPROVED', note: 'ok' }, 500), { code: 'DECISION_NOTE_REQUIRED' });
  assert.throws(() => sm.validateDecision({ decision: 'PARTIALLY_APPROVED', approvedAmount: 500, reasonCode: 'QUANTITY_LIMIT', note }, 500), { code: 'PARTIAL_AMOUNT_INVALID' });
  assert.throws(() => sm.validateDecision({ decision: 'PARTIALLY_APPROVED', approvedAmount: 300, note }, 500), { code: 'REASON_CODE_REQUIRED' });
  assert.equal(sm.validateDecision({ decision: 'PARTIALLY_APPROVED', approvedAmount: 300, reasonCode: 'QUANTITY_LIMIT', note }, 500).approvedAmount, 300);
  assert.equal(sm.validateDecision({ decision: 'REJECTED', reasonCode: 'DOCUMENT_MISMATCH', note }, 500).approvedAmount, 0);
  assert.throws(() => sm.validateDecision({ decision: 'AUTO', note }, 500), { code: 'INVALID_DECISION' });
});

test('TOTP matches RFC 6238 SHA-1 test vectors', () => {
  const secret = totp.base32Encode(Buffer.from('12345678901234567890'));
  const vectors = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']];
  for (const [seconds, expected] of vectors) {
    assert.equal(totp.totp(secret, { time: seconds * 1000, digits: 8 }), expected);
  }
});

test('TOTP verify: drift window, replay protection, bad input', () => {
  const secret = totp.generateSecret();
  const now = 1_800_000_000_000;
  const code = totp.totp(secret, { time: now });
  const counter = totp.verifyTotp(secret, code, { time: now + 25_000 });
  assert.ok(Number.isInteger(counter));
  assert.equal(totp.verifyTotp(secret, code, { time: now, lastUsedCounter: counter }), null, 'replay rejected');
  assert.equal(totp.verifyTotp(secret, code, { time: now + 120_000 }), null, 'outside window');
  assert.equal(totp.verifyTotp(secret, '12ab56', { time: now }), null);
  assert.equal(totp.base32Decode(totp.base32Encode(Buffer.from('hello'))).toString(), 'hello');
});

test('MFA secrets are encrypted at rest and need a configured key', () => {
  const previous = process.env.MFA_ENCRYPTION_KEY;
  delete process.env.MFA_ENCRYPTION_KEY;
  assert.throws(() => totp.encryptSecret('ABC'), { statusCode: 503 });
  process.env.MFA_ENCRYPTION_KEY = 'test-only-mfa-key-0123456789-abcdef';
  const sealed = totp.encryptSecret('JBSWY3DPEHPK3PXP');
  assert.notEqual(sealed, 'JBSWY3DPEHPK3PXP');
  assert.equal(totp.decryptSecret(sealed), 'JBSWY3DPEHPK3PXP');
  const parts = sealed.split('.');
  const flipped = Buffer.from(parts[3], 'base64');
  flipped[0] ^= 0xff;
  parts[3] = flipped.toString('base64');
  assert.throws(() => totp.decryptSecret(parts.join('.')), 'tampered ciphertext is rejected');
  if (previous === undefined) delete process.env.MFA_ENCRYPTION_KEY; else process.env.MFA_ENCRYPTION_KEY = previous;
});

const fixtureCase = { id: '65a000000000000000000001', caseReference: 'CASE-20261117-DEMO1', status: 'NEEDS_REVIEW', subjectReference: 'patient-demo01', createdAt: '2026-11-17T10:00:00Z' };
const fixtureDocs = [
  { id: '65a000000000000000000011', type: 'PRESCRIPTION', mimeType: 'application/pdf', sha256: 'a'.repeat(64) },
  { id: '65a000000000000000000012', type: 'PHARMACY_INVOICE', mimeType: 'image/png' }
];

test('case bundle maps internal statuses to valid FHIR Task codes', () => {
  const bundle = buildCaseBundle({ verificationCase: fixtureCase, documents: fixtureDocs, pharmacyOrg: { id: 'org1', name: 'Demo Pharmacy' } });
  const result = validateBundle(bundle);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.equal(bundle.entry[0].resource.status, 'on-hold');
});

test('claim bundle with decision validates; broken bundles are caught', () => {
  const claim = {
    id: '65a000000000000000000099', claimReference: 'CLM-DEMO-1', status: 'PARTIALLY_APPROVED', policyNumber: 'SYN-POL-001',
    claimedAmount: 500, currency: 'INR', createdAt: '2026-11-17T11:00:00Z',
    decision: { decision: 'PARTIALLY_APPROVED', approvedAmount: 300, note: 'Quantity above policy limit.', decidedAt: '2026-11-17T12:00:00Z' }
  };
  const bundle = buildClaimBundle({ claim, verificationCase: fixtureCase, documents: fixtureDocs, pharmacyOrg: { id: 'org1', name: 'Demo Pharmacy' }, payerOrg: { id: 'org2', name: 'Demo Insurer' } });
  const ok = validateBundle(bundle);
  assert.equal(ok.valid, true, JSON.stringify(ok.issues));
  assert.ok(bundle.entry.some((e) => e.resource.resourceType === 'ClaimResponse' && e.resource.outcome === 'partial'));

  const broken = JSON.parse(JSON.stringify(bundle));
  broken.entry[0].resource.status = 'needs_review';
  delete broken.entry[1].resource.payor;
  broken.entry[0].resource.patient.reference = 'urn:uuid:00000000-0000-5000-8000-000000000000';
  const bad = validateBundle(broken);
  assert.equal(bad.valid, false);
  const messages = bad.issues.map((i) => i.message).join('\n');
  assert.match(messages, /not a valid Claim.status/);
  assert.match(messages, /payor is required/);
  assert.match(messages, /does not resolve/);
});

// ── Claimant ↔ insurer workflow gaps closed in version-4.0 ──
const { claimEligibility, amountBlocker, approvedAmountOf } = require('../services/claims/claimEligibility');

test('claim eligibility: one pharmacy bill is never paid twice', () => {
  const A = 'a'.repeat(24);
  const B = 'b'.repeat(24);
  // Fresh case: claimable up to the whole bill.
  let e = claimEligibility({ invoiceTotal: 230, claims: [] });
  assert.deepEqual([e.claimable, e.remainingAmount, e.approvedSoFar], [true, 230, 0]);
  assert.equal(amountBlocker(230, e), null);
  assert.equal(amountBlocker(230.01, e), 'CLAIM_EXCEEDS_INVOICE');

  // Open claim with insurer A blocks a second claim with A *and* with B (no parallel double claim).
  const open = [{ status: 'UNDER_PAYER_REVIEW', payerOrganizationId: A, claimReference: 'CLM-1' }];
  assert.equal(claimEligibility({ invoiceTotal: 230, claims: open, payerOrganizationId: A }).code, 'DUPLICATE_OPEN_CLAIM');
  assert.equal(claimEligibility({ invoiceTotal: 230, claims: open, payerOrganizationId: B }).code, 'CASE_HAS_OPEN_CLAIM');
  assert.equal(claimEligibility({ invoiceTotal: 230, claims: [{ ...open[0], status: 'APPEALED' }] }).claimable, false);

  // Settled in full: nothing left to claim with anyone.
  const settled = [{ status: 'SETTLED', payerOrganizationId: A, claimReference: 'CLM-1', decision: { approvedAmount: 230 }, settlement: { amount: 230 } }];
  assert.equal(claimEligibility({ invoiceTotal: 230, claims: settled }).code, 'CASE_FULLY_CLAIMED');
  assert.equal(claimEligibility({ invoiceTotal: 230, claims: settled, payerOrganizationId: B }).code, 'CASE_FULLY_CLAIMED');

  // Partial approval by A: same insurer cannot be asked again; insurer B only for the remainder.
  const partial = [{ status: 'PARTIALLY_APPROVED', payerOrganizationId: A, claimReference: 'CLM-1', decision: { approvedAmount: 150 } }];
  assert.equal(claimEligibility({ invoiceTotal: 230, claims: partial, payerOrganizationId: A }).code, 'ALREADY_DECIDED_BY_PAYER');
  e = claimEligibility({ invoiceTotal: 230, claims: partial, payerOrganizationId: B });
  assert.deepEqual([e.claimable, e.remainingAmount, e.approvedSoFar], [true, 80, 150]);
  assert.equal(amountBlocker(80, e), null);
  assert.equal(amountBlocker(80.5, e), 'CLAIM_EXCEEDS_INVOICE');

  // Rejected and withdrawn claims approve nothing; rejected insurer still cannot be re-asked.
  const rejected = [{ status: 'REJECTED', payerOrganizationId: A, claimReference: 'CLM-1', decision: { approvedAmount: 0 } }, { status: 'WITHDRAWN', payerOrganizationId: B, claimReference: 'CLM-2' }];
  assert.equal(claimEligibility({ invoiceTotal: 230, claims: rejected, payerOrganizationId: A }).code, 'ALREADY_DECIDED_BY_PAYER');
  assert.equal(claimEligibility({ invoiceTotal: 230, claims: rejected, payerOrganizationId: B }).remainingAmount, 230);
  assert.equal(approvedAmountOf({ status: 'WITHDRAWN', decision: { approvedAmount: 99 } }), 0);

  // Unknown bill total: no amount ceiling, but the open/decided rules still apply.
  e = claimEligibility({ invoiceTotal: null, claims: [] });
  assert.deepEqual([e.claimable, e.remainingAmount, amountBlocker(1e6, e)], [true, null, null]);
});

test('appeal window and settlement of partial approvals protect the claimant', () => {
  const decidedAt = new Date('2026-11-01T10:00:00Z');
  const in3Days = new Date('2026-11-04T10:00:00Z');
  const in8Days = new Date('2026-11-09T10:00:00Z');
  const reason = 'The quantity limit does not apply to this chronic prescription.';
  assert.equal(sm.APPEAL_WINDOW_DAYS, 7);
  assert.equal(sm.appealDeadline(decidedAt).toISOString(), '2026-11-08T10:00:00.000Z');
  assert.equal(sm.validateAppeal({ status: 'REJECTED', reason, decidedAt, now: in3Days }), reason);
  assert.throws(() => sm.validateAppeal({ status: 'REJECTED', reason, decidedAt, now: in8Days }), { code: 'APPEAL_WINDOW_CLOSED' });
  assert.throws(() => sm.validateAppeal({ status: 'PARTIALLY_APPROVED', reason, decidedAt, decisionAcceptedAt: in3Days, now: in3Days }), { code: 'DECISION_ACCEPTED' });

  // Full approval settles at once; a partial waits for accept / appeal / window end.
  assert.equal(sm.settlementBlocker({ status: 'APPROVED', decidedAt, now: in3Days }), null);
  assert.equal(sm.settlementBlocker({ status: 'PARTIALLY_APPROVED', decidedAt, now: in3Days }), 'APPEAL_WINDOW_OPEN');
  assert.equal(sm.settlementBlocker({ status: 'PARTIALLY_APPROVED', decidedAt, decisionAcceptedAt: in3Days, now: in3Days }), null);
  assert.equal(sm.settlementBlocker({ status: 'PARTIALLY_APPROVED', decidedAt, appealCount: 1, now: in3Days }), null);
  assert.equal(sm.settlementBlocker({ status: 'PARTIALLY_APPROVED', decidedAt, now: in8Days }), null);
  assert.equal(sm.settlementBlocker({ status: 'REJECTED', decidedAt, now: in8Days }), 'NOT_SETTLEABLE');
});
