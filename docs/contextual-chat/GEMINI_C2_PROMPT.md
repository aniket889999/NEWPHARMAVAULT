# Gemini handoff — prepare C2, do not implement shared source

The user has reset priorities: chatbot first. Pause records/tracker after your current atomic edit and report those changes. Do not discard work. Canonical repo: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT`, current branch `feature/v2-01-readiness`. Do not rescan the entire repository, switch branches, commit, push, install dependencies, call paid APIs or read/copy `.env`.

Read only `docs/contextual-chat/PLAN.md`, `backend/data/healthChatKnowledge.js`, `backend/data/chatTopicRegistry.js`, and the public chat service boundary needed to understand the handoff. GPT owns production code and C1 acceptance. Do not modify it or frozen research files.

Ownership: create only `docs/contextual-chat/C2_CORPUS_REVIEW.md` and `tests/contextual-chat/c2-corpus-candidates.json`.

Prepare at most 12 candidate public educational source entries, prioritizing medication-error prevention, brand/generic identity caveats, storage and antibiotic stewardship. Use primary official sources, record exact URL, title, date checked, source jurisdiction, permitted-use/licensing notes and a short original summary preserving limitations. Do not invent clinical facts, source review dates, national-database coverage or expert approval. Missing permission or uncertain medical content must remain NOT_APPROVED, not production knowledge. No scraping of commercial monographs.

Also propose the label schema and task-family split for an independently authored gold-standard evaluation. Do not create or score unseen test labels while developing the candidate. Distinguish synthetic document truth from clinical truth requiring a qualified pharmacist. No fabricated superiority/novelty percentage.

Return at most 200 words: exact created files, primary sources checked, validation performed, unresolved content/licensing review and next owner GPT. Stop. Corpus promotion and generation changes need the next bounded contract.
