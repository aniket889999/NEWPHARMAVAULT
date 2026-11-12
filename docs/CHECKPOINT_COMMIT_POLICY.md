# Checkpoint commit policy

User instruction recorded 12 November 2026: save every meaningful PharmaVault checkpoint to `https://github.com/aniket889999/NEWPHARMAVAULT`.

## Safe publication

- Active development source: `/Users/aniket/Downloads/PBL 5 TH SEM`. Its older origin/history are preserved and must not be pushed into the clean repository: historical secrets may exist.
- Publication checkout: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT`, origin `https://github.com/aniket889999/NEWPHARMAVAULT.git`.
- Before committing, verify that origin, remote head and local status match the intended target. Preserve other contributors' work. Use one publisher at a time; Gemini hands off its implementation and results for independent inspection.
- Commit coherent, inspected checkpoint changes with accurate messages and actual verification results. Stage an explicit reviewed file list, never the whole dirty development folder.
- Completed, independently accepted work may be fast-forward published on main. Incomplete work belongs on a clearly named WIP/feature branch and stays marked PARTIAL until accepted. A WIP commit does not mean its live workflow passes.
- Run relevant tests on the publication copy, check frozen fingerprints, and screen selected files for credentials/private data. Exclude real environment files, patient uploads, storage, caches, dependencies, build output, personal signing state and secrets.
- No force-push, amended/backdated history, empty activity commits, invented test scores, or relabelling failed/pending work as complete. Do not rewrite the original project history or copy its .git directory.
- Use current configured authorship. Confirm that the remote branch reaches the exact pushed SHA; report commit links and any blockers. Never ask for tokens, passwords or verification codes in chat.
- Honour platform permissions and repository rules. This standing instruction authorises ordinary checkpoint commits/pushes, not destructive operations, unreviewed merges, deployment or handling real clinical records.

## Meaningful analytics

Track actual test groups, passed/failed/pending counts, evidence/coverage limits and remaining release gates. Automated offline-check status is not full-app, clinical, OCR, held-out, research-novelty or production approval. Do not promise a ranking increase or a publication acceptance score from commit volume.
