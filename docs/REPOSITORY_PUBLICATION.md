# Clean source publication — 14 October 2026

Target: https://github.com/aniket889999/NEWPHARMAVAULT (main).

Publication status: clean local `main` checkpoint prepared. GitHub's connected integration rejected the contents write with HTTP 403 (`Resource not accessible by integration`), and the GitHub CLI is not logged in. The remote is still empty; uploading requires an authorized write-capable connection or CLI login. Do not describe this checkpoint as already pushed.

The target was empty when inspected. Publish a new source snapshot, not the old repository's Git history: earlier history may contain exposed keys and generated dependency/build files. The original local checkout and its origin/history remain preserved. A fresh snapshot does not revoke exposed credentials; rotate them separately.

Included: frontend/backend source, locked dependencies, academic reference catalogue, contracts, tests, deployment examples, SwiftUI source and checkpoint documentation. Blank/safe `.env.example` templates are included.

Excluded: real `.env` files, dependencies/builds, document storage, OCR language data/cache, editor/scaffolding files, iOS personal signing/build state, logs and private credentials. No local source, user environment file or uploaded document is deleted by publication.

The `.bolt` template metadata is omitted from the new snapshot; original local files are retained. Legacy evaluation fixture values remain for compatibility but are labelled unmeasured. No runtime feature cleanup or force-push/history replacement is authorized.

Current boundary: U3 real OCR/PDF fixes pending; U4 device build/testing pending; U5 real acceptance failing. This commit is a source checkpoint, not a production release or research accuracy claim. Exact validation results are recorded in `U4_U5_HANDOFF.md` and the publication report.
