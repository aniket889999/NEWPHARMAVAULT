# Published checkpoint status — 16 November 2026
This repository contains reproducible academic engineering checkpoints, not a clinically validated product.

| Checkpoint | Publication | Current accepted scope |
|---|---|---|
| Session 1: Foundation | 7cdce5c on main | Frozen eight-slot adapter; 125 offline builder/independent/data-integrity checks |
| Session 2: Matching and quantities | aef0e64 on main | Frozen offline matching/quantity engine and comparison consumer |
| Session 3: Case integration / human review | Accepted prototype scope on main through 6630f21 | Four original HTTP regressions fixed; real synthetic browser walkthrough completed; strict full frontend build repaired; full backend 258/258 and new projection regressions 12/12 pass. See sprint-six/SESSION_3_CLOSURE.md. |
| Session 4: Item-bound RAG / answer freshness | Accepted prototype scope on main through 6630f21 | Independently corrected backend + real chat client integration, exact source viewer, unrelated/dependent correction walkthrough. Full backend 270/270; focused acceptance 111/111. See rag-v2/GPT_SESSION_4_REINSPECTION.md. |
| Session 5: Research evaluation / demo | Completed bounded synthetic feasibility track | Implementation frozen before scoring; 24 development and 16 held-out structured scenarios, exact denominators and limitations published. See rag-v2/SESSION_5_RESEARCH_RESULTS.md and rag-v2/MENTOR_DEMO_GUIDE.md. |
| Session 6: Attribute-first citation priority | Merged into main at 1a3f09f | New compatible protected endpoint and complete expandable source panel. Full backend 286/286 and client regression 110/110 pass; live synthetic source-link walkthrough. No new research score claimed. See citation-priority/SESSION_6_CHECKPOINT.md. |
| Main-project integration / feature audit | Reviewed integration checkpoint | Shared portal links, authenticated legacy requests, role routing, honest research dashboard, organization null-state fix and one-command local startup. See PROJECT_INTEGRATION_AUDIT.md for tested and incomplete features. |

Sessions 3–5 were explicitly approved and fast-forward merged into main at 6630f21 on 16 November 2026. The user's later main-project integration request authorized the Session 6 fast-forward merge at 1a3f09f. Earlier reports preserve their then-current failures, branch locations and no-commit statements as historical evidence. Use this status and the linked current reports instead of stale first-pass decisions.

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

Published held-out results measure bounded synthetic source retrieval and freshness controls only, not overall product or clinical accuracy. No clinical validation, production deployment, device acceptance, certified FHIR/NHCX integration or paper-acceptance probability has been established. Legacy illustrative dashboards do not become measured evaluation merely because tests pass. Follow CHECKPOINT_COMMIT_POLICY.md: publish genuine inspected checkpoints, preserve history and never create empty/backdated activity commits.
