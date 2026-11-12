# Session 3 client publication — PARTIAL

Publication branch: `wip/session-3-client`. Date: 12 November 2026.

This is a recoverable work-in-progress checkpoint, **not an accepted live Session 3 release**. It contains only GPT's case-page, grouping, source-viewer, correction/review client, client tests and contract/prompt documentation. Gemini's in-progress backend was deliberately not copied or labelled complete.

Measured in this clean publication checkout:

- Client acceptance: 54/54 passing, using authored synthetic snapshots, injected requests and React static rendering.
- Strict integration typecheck: pass.
- Owned frontend diagnostics under the real full-app strict compiler: zero.
- Full-app strict compiler: **89 other diagnostics; not passing**. The original active-source report's 82 count describes that different working checkout, not this publication copy.
- Accepted Foundation and reconciliation regressions remain separate from live workflow acceptance. Frozen Session 1/2 source hashes are verified by the shared checkpoint runner.

Case snapshots, grouping and snapshot-bound corrections/reviews need the Session 3 backend API. The older published backend does not implement that completed contract. The client fails closed when the fresh API is unavailable; do not demo a successful review or merge this WIP branch on that basis.

Open gates: inspect Gemini's finished implementation, safe isolated-database/router checks, real printed-file OCR/completeness, field/group invalidation and stale/finalised-state enforcement, creation-screen optional-claim alignment, and actual browser/reviewer walkthrough. Existing wider-app lint/type debt and clinical/held-out/production evaluation remain open.

The original [GPT implementation checkpoint](GPT_SESSION_3_CHECKPOINT.md) is preserved with its active-source measurements. [Published checkpoint status](../CHECKPOINT_STATUS.md) and Git history distinguish accepted offline work from this WIP snapshot. No score, novelty percentage or production readiness is inferred from committing the files.
