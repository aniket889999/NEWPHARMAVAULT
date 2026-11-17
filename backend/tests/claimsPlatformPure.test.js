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
