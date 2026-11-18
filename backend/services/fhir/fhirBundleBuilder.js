'use strict';

/**
 * Builds draft FHIR R4 Bundles from plain objects. Pure module (no database).
 *
 * This is an academic, NHCX-aligned structure for interoperability research.
 * It is NOT certified NHCX conformance and must not be described as such.
 */

const CASE_STATUS_TO_TASK_STATUS = Object.freeze({
  DRAFT: 'draft',
  DOCUMENTS_PENDING: 'requested',
  READY_FOR_PROCESSING: 'ready',
  PROCESSING: 'in-progress',
  NEEDS_CORRECTION: 'on-hold',
  NEEDS_REVIEW: 'on-hold',
  VERIFIED: 'completed',
  REJECTED: 'rejected',
  CLOSED: 'completed',
  FAILED: 'failed'
});

const CLAIM_STATUS_TO_OUTCOME = Object.freeze({
  SUBMITTED: 'queued',
  UNDER_PAYER_REVIEW: 'queued',
  QUERY_RAISED: 'queued',
  APPROVED: 'complete',
  PARTIALLY_APPROVED: 'partial',
  REJECTED: 'error',
  SETTLED: 'complete',
  WITHDRAWN: 'error'
});

const DOC_TYPE_TEXT = Object.freeze({
  PRESCRIPTION: 'Prescription',
  PHARMACY_INVOICE: 'Pharmacy invoice',
  INVOICE: 'Pharmacy invoice',
  CLAIM_FORM: 'Claim form'
});

const crypto = require('node:crypto');

// Deterministic RFC 4122-shaped UUID (name-based, SHA-1) so urn:uuid references are valid.
function uuidFrom(id) {
  const h = crypto.createHash('sha1').update(`pharmavault:${id}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
const urn = (id) => `urn:uuid:${uuidFrom(String(id))}`;
const iso = (value) => new Date(value || Date.now()).toISOString();
const dateOnly = (value) => iso(value).slice(0, 10);

function organizationEntry(id, name, typeCode) {
  return {
    fullUrl: urn(id),
    resource: {
      resourceType: 'Organization',
      id: String(id),
      active: true,
      type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: typeCode }] }],
      name
    }
  };
}

function patientEntry(id, pseudonym) {
  return {
    fullUrl: urn(id),
    resource: {
      resourceType: 'Patient',
      id: String(id),
      // Pseudonymous identifier only; no name, phone or address leaves PharmaVault.
      identifier: [{ system: 'https://pharmavault.example/pseudonymous-subject', value: pseudonym }]
    }
  };
}

function documentEntries(relatedTaskId, documents, patientId) {
  return (documents || []).map((doc) => ({
    fullUrl: urn(doc.id),
    resource: {
      resourceType: 'DocumentReference',
      id: String(doc.id),
      status: 'current',
      type: { text: DOC_TYPE_TEXT[doc.type] || 'Supporting document' },
      subject: { reference: urn(patientId) },
      ...(relatedTaskId ? { context: { related: [{ reference: urn(relatedTaskId) }] } } : {}),
      content: [{
        attachment: {
          contentType: doc.mimeType || 'application/octet-stream',
          ...(doc.sha256 ? { hash: Buffer.from(doc.sha256, 'hex').toString('base64') } : {}),
          title: DOC_TYPE_TEXT[doc.type] || 'Supporting document'
        }
      }]
    }
  }));
}

/**
 * Bundle for a verification case (pharmacy side).
 */
function buildCaseBundle({ verificationCase, documents = [], pharmacyOrg }) {
  const caseId = String(verificationCase.id);
  const patientId = `${caseId}-subject`;
  const orgId = String(pharmacyOrg?.id || 'pharmacy-org');
  return {
    resourceType: 'Bundle',
    id: `case-${caseId}`,
    meta: { tag: [{ system: 'https://pharmavault.example/tags', code: 'draft-nhcx-aligned', display: 'Draft NHCX-aligned academic export' }] },
    type: 'collection',
    timestamp: iso(),
    entry: [
      {
        fullUrl: urn(caseId),
        resource: {
          resourceType: 'Task',
          id: caseId,
          identifier: [{ system: 'https://pharmavault.example/cases', value: verificationCase.caseReference }],
          status: CASE_STATUS_TO_TASK_STATUS[verificationCase.status] || 'draft',
          intent: 'order',
          description: 'TrustRAG multi-document verification case',
          for: { reference: urn(patientId) },
          owner: { reference: urn(orgId) },
          authoredOn: iso(verificationCase.createdAt)
        }
      },
      patientEntry(patientId, verificationCase.subjectReference || 'patient-pseudonymous'),
      organizationEntry(orgId, pharmacyOrg?.name || 'Pharmacy', 'prov'),
      ...documentEntries(caseId, documents, patientId)
    ]
  };
}

/**
 * Bundle for an insurance claim: Claim + Coverage + optional ClaimResponse.
 */
function buildClaimBundle({ claim, verificationCase, documents = [], pharmacyOrg, payerOrg }) {
  const claimId = String(claim.id);
  const caseId = String(verificationCase.id);
  const patientId = `${caseId}-subject`;
  const coverageId = `${claimId}-coverage`;
  const pharmacyId = String(pharmacyOrg?.id || 'pharmacy-org');
  const payerId = String(payerOrg?.id || 'payer-org');
  // The case Task is not part of a claim bundle, so documents carry no Task link here.
  const docEntries = documentEntries(null, documents, patientId);

  const entries = [
    {
      fullUrl: urn(claimId),
      resource: {
        resourceType: 'Claim',
        id: claimId,
        identifier: [{ system: 'https://pharmavault.example/claims', value: claim.claimReference }],
        status: claim.status === 'WITHDRAWN' ? 'cancelled' : 'active',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'pharmacy' }] },
        use: 'claim',
        patient: { reference: urn(patientId) },
        created: iso(claim.createdAt),
        insurer: { reference: urn(payerId) },
        provider: { reference: urn(pharmacyId) },
        priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
        supportingInfo: docEntries.map((entry, index) => ({
          sequence: index + 1,
          category: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claiminformationcategory', code: 'attachment' }] },
          valueReference: { reference: entry.fullUrl }
        })),
        insurance: [{ sequence: 1, focal: true, coverage: { reference: urn(coverageId) } }],
        total: { value: claim.claimedAmount, currency: claim.currency || 'INR' }
      }
    },
    {
      fullUrl: urn(coverageId),
      resource: {
        resourceType: 'Coverage',
        id: coverageId,
        status: 'active',
        identifier: [{ system: 'https://pharmavault.example/synthetic-policy', value: claim.policyNumber }],
        beneficiary: { reference: urn(patientId) },
        payor: [{ reference: urn(payerId) }]
      }
    },
    patientEntry(patientId, verificationCase.subjectReference || 'patient-pseudonymous'),
    organizationEntry(pharmacyId, pharmacyOrg?.name || 'Pharmacy', 'prov'),
    organizationEntry(payerId, payerOrg?.name || 'Insurer', 'pay'),
    ...docEntries
  ];

  if (claim.decision?.decision) {
    entries.push({
      fullUrl: urn(`${claimId}-response`),
      resource: {
        resourceType: 'ClaimResponse',
        id: `${claimId}-response`,
        status: 'active',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'pharmacy' }] },
        use: 'claim',
        patient: { reference: urn(patientId) },
        created: iso(claim.decision.decidedAt),
        insurer: { reference: urn(payerId) },
        request: { reference: urn(claimId) },
        outcome: CLAIM_STATUS_TO_OUTCOME[claim.status] || 'queued',
        disposition: claim.decision.note,
        payment: claim.decision.approvedAmount > 0
          ? { amount: { value: claim.decision.approvedAmount, currency: claim.currency || 'INR' }, date: dateOnly(claim.decision.decidedAt) }
          : undefined
      }
    });
    if (!entries[entries.length - 1].resource.payment) delete entries[entries.length - 1].resource.payment;
  }

  return {
    resourceType: 'Bundle',
    id: `claim-${claimId}`,
    meta: { tag: [{ system: 'https://pharmavault.example/tags', code: 'draft-nhcx-aligned', display: 'Draft NHCX-aligned academic export' }] },
    type: 'collection',
    timestamp: iso(),
    entry: entries
  };
}

module.exports = { uuidFrom, buildCaseBundle, buildClaimBundle, CASE_STATUS_TO_TASK_STATUS, CLAIM_STATUS_TO_OUTCOME };
