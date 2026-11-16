# Published checkpoint status — 16 November 2026
This repository contains reproducible academic engineering checkpoints, not a clinically validated product.

| Checkpoint | Publication | Current accepted scope |
|---|---|---|
| Session 1: Foundation | 7cdce5c on main | Frozen eight-slot adapter; 125 offline builder/independent/data-integrity checks |
| Session 2: Matching and quantities | aef0e64 on main | Frozen offline matching/quantity engine and comparison consumer |
| Session 3: Case integration / human review | Accepted prototype scope on wip/session-3-integration-review | Four original HTTP regressions fixed; real synthetic browser walkthrough completed; strict full frontend build repaired; full backend 258/258 and new projection regressions 12/12 pass. See sprint-six/SESSION_3_CLOSURE.md. |
| Session 4: Item-bound RAG / answer freshness | Accepted prototype scope on the review branch | Independently corrected backend + real chat client integration, exact source viewer, unrelated/dependent correction walkthrough. Full backend 270/270; focused acceptance 111/111. See rag-v2/GPT_SESSION_4_REINSPECTION.md. |
| Session 5: Research evaluation / demo | Development runner verified; held-out gate pending | Equal-budget retrieval and same-answer temporal controls preregistered. See rag-v2/EVALUATION_PROTOCOL.md. No novelty/clinical accuracy percentage is claimed. |

Main still contains the accepted earlier checkpoints; WIP publication does not automatically merge feature work. Earlier reports preserve their then-current failures and no-commit statements as historical evidence. Use this status and the linked current reports instead of stale first-pass decisions.

## Reproduce bounded engineering evidence
```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/checkpoint-checks.cjs --report-dir=reports/checkpoints
npm run validate:schemas
npm run validate:contract
npm run build:frontend
node --test tests/rag-v2/consumer.test.cjs tests/rag-v2/store.test.cjs tests/rag-v2/ui.test.cjs tests/rag-v2/schema.test.cjs tests/chatClient.test.cjs
```

Real backend runs also need backend dependencies, loopback MongoDB and a locally provisioned English OCR file. See sprint-six/SESSION_3_CLOSURE.md for the explicit real-OCR opt-in and guarded disposable targets.

The offline GitHub job checks fixed contracts/fingerprints, client acceptance, evaluation bookkeeping/isolation, schemas and the real strict frontend build. The separate integration job uses disposable MongoDB for protected contract, privacy, public-chat, projection and Session 4 backend/HTTP regressions. These are bounded CI scopes, not a claim that every local OCR/device/deployment experiment ran remotely. Generated reports are ignored and uploaded as artifacts, not edited into invented scores.

No held-out product score, clinical validation, production deployment, device acceptance, certified FHIR/NHCX integration or paper-acceptance probability has been established. Legacy illustrative dashboards do not become measured evaluation merely because tests pass. Follow CHECKPOINT_COMMIT_POLICY.md: publish genuine inspected checkpoints, preserve history and never create empty/backdated activity commits.
