# Gemini — bounded public API verification only

Workspace: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3`.

Own this task only. Codex owns chatbot/retrieval/history integration. Do not scan the repository, change application files, install packages, run broad tests, commit, or push.

## Current budget / resume instruction

**An initial report already exists at `docs/chatbot-next/gemini/API_REPORT.md`. Do not run the original two-task command again.** It reports one actual project-guide provider request succeeded; the medicine task abstained before provider egress. Codex has now fixed the tiny-pool retrieval issue and checked the medicine route locally. Maximum remaining provider requests: **ONE**, still capped at 1,024 output tokens and 8,000 input characters. Do not reuse any chat-exposed key. A fresh key must be entered privately by the user; if absent, write BLOCKED / zero new requests and stop.

For the remaining medicine task ONLY, run once:

`node backend/scripts/runAcademicPublicRagProbe.js --env-file backend/.env.provider.local --allow-two-public-calls --only-public-medicine`

Write `docs/chatbot-next/gemini/API_FOLLOWUP_REPORT.md` with actual new request count, cumulative count (prior reported 1 + new), model/mode/source count/latency/fallback/exit status. Do not overwrite the first report or retry. The script's historical authorization flag retains its old name, but `--only-public-medicine` sets a hard one-request cap. Do not change normal app configuration.

## Original initial-run instructions (historical; already consumed)

1. The API key previously pasted in chat is exposed. Do not reuse, echo, log or copy it. Ask the user to revoke it in Google AI Studio and enter a replacement privately into ignored `backend/.env.provider.local`. Never request the key in chat. Preserve unrelated environment settings. Ensure this file stays Git-ignored and mode 600; never stage it.
2. Configure `RAG_CHAT_MODEL=gemini-3.5-flash-lite` there. This stable ID was selected from official Google model documentation. If unavailable to this account, report that blocker; do not try other models or extra requests automatically.
3. Read only `backend/scripts/runAcademicPublicRagProbe.js` and this handoff before running it. First confirm that the secret file is ignored and the key is non-empty without printing its value.
4. Run ONCE from the workspace:
   `node backend/scripts/runAcademicPublicRagProbe.js --env-file backend/.env.provider.local --allow-two-public-calls`
   The user approves at most TWO provider requests TOTAL, each capped at 1,024 output tokens and 8,000 input characters. Only the script's fixed public reference questions are authorized. No patient documents, private case information, personal identifiers, raw chat history, embeddings, web tools, retries or additional provider probes. A failed request consumes the budget. Do not run the probe a second time.
5. Do not enable paid generation globally or alter the running app's environment; these two calls are acceptance checks only. A successful request does not establish clinical accuracy or superiority over GPT/Claude.
6. Write a short secret-free `docs/chatbot-next/gemini/API_REPORT.md`: checkpoint PASS/PARTIAL/BLOCKED, exact model ID, actual request count, returned modes/fallback reasons/latencies/source counts, command exit status, and whether any configuration changed. Never include key values, request headers, upstream response bodies or user credentials. State explicitly if zero requests ran. Stop after the report.

Google key management: https://aistudio.google.com/app/apikey
Model documentation: https://aistudio.google.com/docs/models/gemini-3.5-flash-lite
