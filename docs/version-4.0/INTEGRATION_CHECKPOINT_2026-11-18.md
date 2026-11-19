# Version 4.0 integration checkpoint — 18 November 2026

## Result and recovery

Integrated upstream `origin/version-4.0` at **de60459** into the new local `version-4.0` branch, tracking the same remote branch. The local `version-3.0` branch remains at merged-main base `fe21ef6`. The 44-file upstream change set was fast-forwarded; there were no merge conflicts.

Existing local chatbot wording, evidence, provenance, history, governance and privacy work was preserved. Only three overlapping tracked files were temporarily saved and reapplied: `backend/.env.example`, `backend/data/chatTopicRegistry.js`, `package.json`. The recovery stash remains available: **544ad7a9a2fc450aa9623699305b958e23bf9ac6**. No reset, broad stash, reseeding or deletion of existing preview records occurred. No new commit/push was performed; additional local work remains uncommitted.

## Upstream features imported

- Claimant login tab and shared Reviewer & Insurer layout, with existing role-specific routes and data permissions retained.
- Server-priced, stock-reserving orders, prescription-required checks and pharmacy review/status synchronisation.
- Inventory markdown, recall and reorder-request actions.
- Local rule-based prescription extraction and daily reminder reset/delivery changes.
- Updated nearby-inventory/empty states; consultation marked future work instead of simulating a completed video service.
- Eight public symptom/condition search topics and the developer-labelled 30-question chatbot evaluation.

Importing these features is not proof that every workflow has been exercised against this existing database.

## Local integration repairs

1. Updated the still-old gateway to expose **Claimant** and the combined **Reviewer & Insurer** entry, using the existing visual design. Claimant remains a patient account; no new privileges were granted.
2. Fixed order quantity coercion: fractional values, malformed strings and nonnumeric types are rejected; duplicate rows cannot exceed the per-medicine limit of 100.
3. Order lookup now excludes recalled and expired inventory before stock reservation.
4. A real `What is fever?` check initially mixed the general topic with hemorrhagic-fever results and unnecessary advice. New symptom routes now require an exact registered topic title on official web passages. General definition questions select direct topic-definition sentences, not incidental treatment sentences. The second live run returned the short matching fever definition with one MedlinePlus citation and no related-disease drift.
5. Updated the temporary preview wrapper to use v4 metadata, enable local prescription analysis with `PRESCRIPTION_LLM_ENABLED=false`, and start the in-app reminder scheduler. Public model generation, embeddings, private export, email and text notifications remain disabled. Other legacy external-provider routes remain blocked in this isolated preview.

## Actual verification

| Check | Result and boundary |
| --- | --- |
| Final focused run, 13 files | **206/206 passed**, 0 failed. Includes 178 existing chatbot checks, 12 client integration checks, 10 new order/parser checks, 4 new symptom-scope checks and 2 reminder checks. |
| New order/parser tests | Mocked model I/O, no DB/HTTP/real orders. Checks strict quantities, merged quantities, server totals, pharmacy split, prescription ownership/review state, shortage compensation, inventory eligibility filters and local parsing. These are not end-to-end order tests. |
| Frontend | TypeScript and Vite production build passed after gateway changes. Existing bundle-size/Browserslist warnings remain. |
| Backend syntax | Passed, 305 JavaScript files. |
| Local authenticated API smoke | Synthetic prescription text → HTTP 200, `local-rules`, one parsed item. Patient order list → HTTP 200, array response. No order was placed. |
| Real browser | Updated gateway/sign-in tabs and synthetic patient login observed. Final fever request → `PRECISE_WEB_EVIDENCE`, `RETRIEVED`, one source at `https://medlineplus.gov/fever.html`. |
| Teammate's offline demo evaluation | **23/30** outcome matches; **14/19** expected-answer items answered with the expected content/citations; **5/5** safety referrals and **0/5** unsafe direct answers on those five scenarios. Web/model disabled; developer labels unchanged and not independently reviewed. |
| Data/provider boundary | Same existing synthetic preview DB reused. Zero paid model requests. No private data exported. No seed scripts run. |

The final 206 checks are one focused denominator, not the full repository suite or a clinical accuracy score. The offline evaluation was not rerun with altered labels: three differences are intentional brand-label clarification; other differences include missing storage evidence and generic/no-topic phrasing gaps.

## Running preview

- Branch/base: `version-4.0`, `de60459` plus local changes.
- App: `http://127.0.0.1:5173/auth`.
- API: `http://127.0.0.1:5001/api`.
- DB: `pharmavault_v3_preview_20261118_0353c7bb04` (preserved).
- Temporary wrapper: `/private/tmp/pharmavault-v3-preview.B4epop/launch.cjs`.
- Terminal session: `62385` (ephemeral).
- Synthetic demo accounts/passwords remain as previously configured. Showcase-specific fixtures/Pune inventory may not exist in the preserved older DB; do not run `seed:all` against it to hide that difference.

Proof screenshots outside the project worktree:

- `/Users/aniket/Documents/Codex/2026-07-26/y/deliverables/pharmavault-v4-gateway-2026-11-18.jpg`
- `/Users/aniket/Documents/Codex/2026-07-26/y/deliverables/pharmavault-v4-fever-web-2026-11-18.jpg` (final corrected result).

## Remaining limits

- The full new order → pharmacy decision → patient notification journey, multi-pharmacy prescription handling and concurrent cancellation/stock restoration were not validated with real database writes in this integration. Multi-document order creation still needs transaction/failure recovery and idempotency hardening.
- The new legacy prescription parser uses heuristic confidence, shorthand-to-time rules and name-based inventory association; it can infer a unit for a bare strength and defaults a missing date. This is not validated OCR accuracy or safe product-equivalence proof. Human confirmation and stronger strength/form matching remain necessary.
- Existing patient-dashboard illustrative values and the old reminder `COMING SOON` badge are not evidence of measured live state. They were not rewritten in this integration.
- General internet browsing is not implemented. Public web lookup is the fixed MedlinePlus connector; narrow topic-title matching may abstain on a valid differently titled page. Multi-detail answers and broader medicine-specific evidence coverage remain open.
- Paid medicine-generation acceptance, independent academic grading, clinical review and production deployment approval remain pending. Do not describe this checkpoint as all features verified or industry launch approved.
