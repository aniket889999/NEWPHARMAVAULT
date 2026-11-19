'use strict';

/**
 * Evidence assistant for insurer reviewers.
 *
 * Answers questions about ONE claim's verification case, from the case evidence the
 * claimant consented to share (CaseShareGrant), with citations to the prescription
 * and invoice fields. It reuses the reviewed TrustRAG case-assistant pipeline
 * (local, deterministic: no web search, no external LLM) without any shortcut into
 * /cases/*: the caller must already have resolved the claim inside the insurer's
 * tenant and checked that the grant is active.
 *
 * It never approves, rejects, settles or judges fraud. Humans decide.
 */

const VerificationCase = require('../../models/verificationCaseModel');
const { buildCaseAnswer, finalizeCaseAnswer, DISCLAIMER } = require('../trustRag/caseAssistantService');
const { buildCaseReconciliationSnapshot } = require('../trustRag/caseReconciliationService');
const { withCaseMutationGuard, createControlledError } = require('../trustRag/caseEvidenceMutationService');
const { prioritizeCaseAnswerSources } = require('../trustRag/citationPriorityPolicy');

// Everything the answer may cite must be inside the consent scope.
const REQUIRED_SCOPES = Object.freeze(['documents', 'extracted_fields', 'consistency_checks', 'risk_signals']);
const MEDICINE_ITEM_ID = /^mi_[a-f0-9]{24}$/;
const DECISION_REQUEST = /\b(?:(?:should|can|could|do|shall) (?:i|we) (?:approve|accept|reject|deny|decline|settle|pay|reimburse)|(?:approve|accept|reject|deny|decline|settle|pay) (?:this|the) claim|is (?:this|it|the claim) (?:fraud\w*|fake|genuine|forged|legit\w*)|fraud\w*)\b/i;

const PAYER_DISCLAIMER = `${DISCLAIMER} Insurer view: answers use only the evidence the claimant consented to share for this claim.`;

const SUGGESTED_QUESTIONS = Object.freeze([
  'What strength is on the prescription and the invoice?',
  'Does the quantity match between prescription and invoice?',
  'Which medicine is on this case?',
  'What is the case verification status?'
]);

function validateQuestion(message, medicineItemId) {
  if (typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 2000) {
    throw createControlledError(400, 'INVALID_ASSISTANT_REQUEST', 'message must be between 1 and 2000 characters.');
  }
  if (medicineItemId !== null && medicineItemId !== undefined && !(typeof medicineItemId === 'string' && MEDICINE_ITEM_ID.test(medicineItemId))) {
    throw createControlledError(400, 'INVALID_ASSISTANT_REQUEST', 'medicineItemId is not valid.');
  }
  return message.trim();
}

function decisionRefusal(caseId) {
  return {
    caseId: String(caseId),
    reply: 'I cannot approve, reject, settle or judge fraud on a claim. That decision belongs to you, the insurer reviewer, with a written note. '
      + 'I can point you to the evidence: ask about the medicine, strength, quantity or the case status, and review the consistency checks and risk signals on this page. '
      + 'Risk signals are review prompts, not proof of fraud.',
    mode: 'SAFETY',
    intent: 'UNSUPPORTED',
    medicineItemId: null,
    choices: [],
    sources: [],
    warnings: [],
    disclaimer: PAYER_DISCLAIMER
  };
}

/**
 * @param {object} p
 * @param {object} p.claim  Claim already resolved inside the insurer's tenant
 * @param {object} p.grant  Active CaseShareGrant for that claim (checked by the caller)
 * @param {object} p.user   Insurer user (payer_reviewer / payer_admin)
 */
async function answerForPayer({ claim, grant, user, message, medicineItemId = null }) {
  if (!grant || typeof grant.isActive !== 'function' || !grant.isActive()) {
    throw createControlledError(403, 'CONSENT_INACTIVE', 'The claimant has not granted (or has withdrawn) access to this case.');
  }
  if (String(grant.caseId) !== String(claim.caseId) || String(grant.granteeOrganizationId) !== String(claim.payerOrganizationId)) {
    throw createControlledError(403, 'CONSENT_INACTIVE', 'Consent does not cover this claim.');
  }
  if (!REQUIRED_SCOPES.every((s) => grant.scope.includes(s))) {
    throw createControlledError(403, 'CONSENT_SCOPE', 'The claimant did not share enough evidence for the assistant.');
  }
  const question = validateQuestion(message, medicineItemId);
  const base = { audience: 'PAYER', claimReference: claim.claimReference, suggestedQuestions: SUGGESTED_QUESTIONS };
  if (DECISION_REQUEST.test(question)) return { ...decisionRefusal(claim.caseId), ...base };

  const caseId = String(claim.caseId);
  const snapshot = await withCaseMutationGuard(caseId, async () => {
    const vCase = await VerificationCase.findById(caseId);
    if (!vCase) throw createControlledError(404, 'CASE_NOT_FOUND', 'Verification case not found.');
    return buildCaseReconciliationSnapshot({ vCase, user });
  });
  const draft = buildCaseAnswer({ snapshot, message: question, medicineItemId: medicineItemId ?? null });
  const finalized = finalizeCaseAnswer({ draft, snapshot, userId: String(user._id), secret: process.env.JWT_SECRET, now: new Date() });
  const answer = prioritizeCaseAnswerSources({ answer: finalized, message: question });
  // Freshness receipts belong to the pharmacy case API, which insurers never call.
  return { ...answer, bindingToken: null, dependencyKeys: [], disclaimer: PAYER_DISCLAIMER, ...base };
}

module.exports = { answerForPayer, SUGGESTED_QUESTIONS, DECISION_REQUEST };
