# Session 6 independent review — bounded, review only

Workspace: /Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT
Branch: feature/session-6-citation-priority. Do not use or overwrite the dirty Downloads checkout.

Read docs/citation-priority/SESSION_6_CONTRACT.md and SESSION_6_CHECKPOINT.md. Review only the new citationPriorityPolicy.js, prioritizedCaseAssistantService.js, prioritizedCaseAssistantRoutes.js, their app.js mount, CaseEvidenceSources.tsx, the caseAssistant/api.ts endpoint change, and the new focused tests. Inspect relevant legacy interfaces only if needed; do not rescan the entire repository.

Try to find concrete failures in citation/source identity preservation, S1/S10/S12 renumbering, multi-document balancing, mixed-attribute questions, ambiguous/unsupported scope, stale receipt handling, cross-tenant access, and hidden/additional source accessibility. Distinguish a heuristic limitation from a security or data-integrity defect. Ranking is source-order prioritization, not newly measured retrieval accuracy.

Run the focused development tests and tests/rag-v2/published-results.test.cjs. Before any database run verify the explicit disposable test guard and scoped cleanup; never share a currently running browser fixture's database cleanup. Do not load held-out labels, rerun old held-out scoring as a new study, edit frozen Session 4 candidate/protocol/data/results, weaken assertions, install dependencies, change .env, commit, push or deploy.

Review only. Do not edit implementation concurrently. Return <=150 words: findings with severity and exact file/line, commands actually run and counts, limitations and next owner GPT. If a defect is found, propose the smallest correction; await handoff before changing code.
