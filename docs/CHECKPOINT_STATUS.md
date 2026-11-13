# Published checkpoint status — integration review update, 13 November 2026

This repository contains reproducible academic engineering checkpoints, not a clinically validated product.

| Checkpoint | Publication | Accepted scope |
|---|---|---|
| Session 1: Foundation | `7cdce5c` on main | 125/125 offline builder, independent adapter and dataset-integrity checks; frozen eight-slot medicine-item contract |
| Session 2: Matching and quantities | `aef0e64` on main | 43/43 builder + 56/56 independent backend + 39/39 consumer checks; Foundation regression preserved; 11 schemas valid |
| Session 3: Case integration / human review | PARTIAL / NOT ACCEPTED on `wip/session-3-integration-review` | Supplied suites pass, but four independent HTTP contract checks fail; see the independent review. Earlier client-only snapshot remains on `wip/session-3-client`. |
| Sessions 4–5 | Not started | Item-bound RAG/freshness and held-out evaluation/demo |

## Reproduce the accepted checks

```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/checkpoint-checks.cjs --report-dir=reports/checkpoints
npm run validate:schemas
node node_modules/typescript/bin/tsc --noEmit -p tests/reconciliation-v2/tsconfig.json
```

The GitHub workflow **Offline checkpoint checks** runs these bounded checks on pushes/PRs and uploads measured group counts and frozen-source integrity. Report-parser tests prevent missing, failed, cancelled, skipped or zero-test runs from being advertised as a complete pass. Generated reports are ignored by Git and attached to the run, not manually edited into a score.

The separate **Session 3 independent contract review** workflow runs actual HTTP regressions with a disposable MongoDB service. Its current four failures are intentionally retained as unresolved acceptance evidence, not skipped or relabelled successful. Read [the independent review](integration-v2/SESSION_3_INDEPENDENT_REVIEW.md) before interpreting any green offline badge.

The README badge describes only this offline job. A green badge does not establish a successful full-app build, real document OCR, clinical accuracy, live integration, research novelty percentage or a paper acceptance score. Wider application strict-type/lint debt and legacy mock evaluation dashboards are not waived by these checks. No held-out product score has been produced.

Original implementation reports are preserved as historical evidence; some describe the earlier active-source location and then-current no-commit state. This publication record and Git history describe what was subsequently published. The original project's Git history, local environment and patient/document storage were not copied.

Follow [checkpoint publication policy](CHECKPOINT_COMMIT_POLICY.md). Complete and inspect real work before publishing the next accepted checkpoint.
