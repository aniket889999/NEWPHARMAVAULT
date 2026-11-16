# Session 4 — Item-bound, correction-aware case assistant
Date: 16 November 2026. Six-hour sprint scope; not clinical or production approval.

## Ownership and protected baseline
Gemini owns the new backend service/router/tests and its report. GPT owns this contract, frontend/client, independent tests, evaluation gold and publication. Read only the relevant Session 3 snapshot contract and accepted Session 1/2 interfaces. Do not edit frozen files, other agents' files or held-out labels. Preserve all existing dirty work, secrets and patient data. Session 3 compatibility tests remain a separate gate.

Goal: a pharmacist can ask about a specific medicine/document comparison, inspect exact cited fields, then see whether a previously cited answer is still supported after correction. Current case revision alone is NOT a freshness fingerprint. An unrelated edit must not invalidate an unaffected answer.

Private answers remain deterministic/local and bounded. Do not call an external LLM, embeddings API, web search or a remote database with private context. Public conversational RAG remains unchanged.

## Backend endpoints and pure interfaces (Gemini)
Create:
- backend/services/trustRag/caseAssistantService.js
- backend/routes/caseAssistantRoutes.js
- backend/tests/caseAssistant.test.js
- backend/tests/caseAssistantIntegration.test.js
- docs/rag-v2/GEMINI_SESSION_4_REPORT.md

Modify backend/routes/trustRagRoutes.js only to mount:
router.use('/cases/:caseId/assistant', require('./caseAssistantRoutes'));
The child router MUST use express.Router({ mergeParams: true }). Existing app authentication and tenant context stay mandatory. Apply aiLimiter. No other route/controller/model/dependency changes without handoff.

Export pure functions:
buildCaseAnswer({ snapshot, message, medicineItemId = null }) -> AnswerDraft (no token/clock/DB)
buildDependencyIndex(snapshot) -> Map<string,string> (stable dependency key -> SHA256 hex fingerprint)
finalizeCaseAnswer({ draft, snapshot, userId, secret, now = new Date() }) -> CaseAssistantAnswer
checkAnswerFreshness({ snapshot, receipts, userId, secret, now = new Date() }) -> FreshnessResponse

Also export asynchronous answerCase({ caseId, user, tenantContext, message, medicineItemId = null }) and freshnessForCase({ caseId, user, tenantContext, receipts }).
These authorize with the existing private-case scope before any subordinate read, acquire withCaseMutationGuard on the canonical case ID, re-authorize/re-read inside it, then use buildCaseReconciliationSnapshot. Controlled concurrent access returns 409 CASE_BUSY. No case mutation, persistence of chat, or bypass of lifecycle/review rules.

POST /api/v1/cases/{caseId}/assistant/answers
JSON exactly { message: string(1..2000 trimmed), medicineItemId?: null | mi_<24 lowercase hex> }
Do not accept caller role, evidence values, fingerprints, histories or instructions to override policy.
Response 200 CaseAssistantAnswer.

POST /api/v1/cases/{caseId}/assistant/freshness
JSON exactly { receipts: [{ answerId: UUID, bindingToken: string(1..32768) }] }, 1..20 unique answerIds.
Response 200 FreshnessResponse. Authorize case even for invalid tokens; foreign case/user receipt must never cause another case to be loaded. Malformed request ->400; per-receipt invalid/expired signature ->UNVERIFIABLE, no contents leaked. All responses private,no-store.
Use controlled safe errors and 401/403/opaque404 as existing policy; never reflect raw tokens, private text, paths or error stacks.

## Frozen wire response for GPT frontend
CaseAssistantAnswer has ONLY:
{
 schemaVersion: '2.0.0-session4', caseId: 24hex,
 answerId: UUID, generatedAt: ISO UTC, evidenceRevision: integer>=0,
 reply: string<=12000,
 mode: 'LOCAL_CASE_EVIDENCE' | 'CLARIFY' | 'ABSTAIN' | 'SAFETY',
 intent: 'STRENGTH' | 'QUANTITY' | 'IDENTITY' | 'COMPARISON' | 'CASE_STATUS' | 'UNSUPPORTED',
 medicineItemId: mi_id | null,
 choices: [{ itemId: mi_id, label: string<=240, documentType: 'PRESCRIPTION'|'PHARMACY_INVOICE' }], max6,
 sources: [{ citation: 'S1'..'S12', sourceId: string<=160, documentId: 24hex|null,
             fieldId:24hex|null, pageNumber:integer>=1|null, itemId:mi_id|null,
             title:string<=160, excerpt:string<=1000, fingerprint:64 lowercasehex }], max12,
 warnings: string[] (max12; each<=500),
 dependencyKeys: string[] (max64; each<=160),
 bindingToken: string | null (max32768),
 disclaimer: string<=600
}
No internal storage identifier, patient/doctor name, raw OCR paragraph, arbitrary review notes or client-supplied URL. Copy only allow-listed medicine fields/structural metadata from snapshot; sources must identify actual same-case fields. Escape source values when composing Markdown. Missing coordinates remain missing; do not fabricate.

FreshnessResponse:
{
 schemaVersion:'2.0.0-session4', caseId, checkedAt:ISO UTC, evidenceRevision:integer>=0,
 results:[{ answerId:UUID, status:'FRESH'|'STALE'|'UNVERIFIABLE',
            changedDependencyKeys:string[] (max64), reasonCode:
            'UNCHANGED_DEPENDENCIES'|'EVIDENCE_CHANGED'|'DEPENDENCY_MISSING'|
            'INVALID_RECEIPT'|'RECEIPT_EXPIRED'|'CASE_PROCESSING' }]
}
Only a valid, same-user/same-case receipt whose complete relevant dependencies remain unchanged can be FRESH. PROCESSING -> UNVERIFIABLE, not FRESH. Expiry (12 hours) uses server time. An initially stale answer remains historical; never silently rewrite it.

## Answer and dependency policy
Support explicitly bounded document questions: recorded strength, quantity, identity, current cross-document comparison, and case status. No diagnosis, dose selection, substitution, fraud conclusions or claim approval. Unsupported/clinical/off-topic -> honest ABSTAIN or SAFETY without private citations. If medicine selection is invalid or unrelated to the question, clarify rather than silently switch medicines. Multiple candidates and no unambiguous scope -> CLARIFY with choices; a whole-case comparison/status query can cover the bounded case.

Use current Session 3 snapshot and frozen reconciler outputs, not old checks or a general medicine example. Do not invent resolved identity or declare a mismatch consistent. Unconfirmed grouping, unknown identity, low confidence, missing fields and incomplete coverage stay explicit and conservative. A factual quotation can be shown as uncertain, but must not become a verified clinical claim.

Dependency keys are domain-separated, stable and server-computed. Fingerprint canonical allow-listed CONTENT (including normalized value, correction/certainty, exact document/field/page identity and relevant grouping membership), not updatedAt, full-case snapshot token, case evidenceRevision or current time.
For strength answers: depend on the selected item(s)' identity fields, requested strength fields, source grouping membership and relevant source coverage. A quantity-only edit to a different medicine must leave a strength answer FRESH. Changing a cited strength, name, source page, grouping membership, source deletion or reprocessing must invalidate it.
For comparison answers: depend on all relevant compared identity/attribute fields and complete source set/coverage; include new/missing items. For case status: depend on the actual status/review flag, not unrelated medicine values.
If a dependency no longer exists, return STALE/DEPENDENCY_MISSING; never fall back to a similarly named new field.
Include a document-source lifecycle fingerprint sufficient to detect reprocessing/deletion even when displayed values coincide, but not an unrelated field-value edit.
An optional CLAIM_FORM's coverage is part of any whole-case all-clear dependency, but need not invalidate a narrow quotation that never relies on the claim.

A bindingToken is a domain-separated HMAC-SHA256 signed bounded receipt containing caseId, userId, answerId, relevant key/hash pairs and issued/expiry timestamps. Use a derived key from the required server JWT_SECRET, timingSafeEqual, no fallback secret, no logs. The frontend receives no signing secret. A client-provided dependencyKeys list is not authoritative; freshness validates the signed receipt. CLARIFY/ABSTAIN/SAFETY have no sources/dependencies/token. Receipts are memory-only in the browser; no durable chat/audit storage is claimed.

## Required acceptance
- Supported same-case exact field citations; strength mismatch remains mismatch.
- Multiple medicines -> clarification unless explicit scope; wrong medicine/item fails closed.
- Dependent edit ->STALE; unrelated edit ->FRESH.
- Source deletion/group change/reprocess ->not fresh.
- Forged/cross-user/cross-case/expired receipt ->UNVERIFIABLE.
- Current case authorization applies to every freshness read (including revoked access).
- Patient read-only; no review/correction mutation.
- No private external egress, even with public Gemini flags enabled.
- Concurrent read ->controlled409; provider not called.
Use development fixtures and a guarded disposable DB only. No skips, baseline weakening, unsupported percentages or held-out tuning.

## Session 5 preregistration (before evaluation)
Given the six-hour limit, private evaluation compares the same local deterministic renderer on:
A. lexical BM25 retrieval baseline;
B. item-scoped retrieval without dependency freshness;
C. item-scoped retrieval with signed dependency freshness.
Public hybrid/vector RAG is a separate existing feature and is NOT conflated with these private results. Never call offline lexical/fixture vectors a measured semantic embedding improvement.
GPT freezes answer/reference/freshness gold before running the held-out split. Report denominators, coverage, wrong-entity retrieval, dependent/unrelated-edit freshness and failures. Small synthetic results are feasibility evidence, not clinical accuracy or guaranteed novelty.
