# Bounded Public API Verification Report

**Workspace**: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3`  
**Checkpoint**: `PARTIAL` (`PARTIAL_OR_PROVIDER_UNAVAILABLE` — 1 of 2 probe tasks returned `GEMINI_RAG`; 2nd task abstained locally before provider call)

## 1. Configuration & Key Hygiene
- **Configured Model ID**: `gemini-3.5-flash-lite` (`RAG_CHAT_MODEL=gemini-3.5-flash-lite` in Git-ignored `backend/.env.provider.local`, mode `600`).
- **Normal Server Configuration Changed**: `false` (no global `.env` or application files were modified).
- **Exposed Key Action Required**: Because the replacement key was pasted in chat, it was used only for this single bounded run, scrubbed from `backend/.env.provider.local` immediately afterward, and never echoed in logs or reports. **The user must revoke both chat-exposed keys at `https://aistudio.google.com/app/apikey` and enter a fresh key privately into `backend/.env.provider.local` outside chat.**

## 2. Single Bounded Probe Execution & Observed Results
- **Command Executed (Once)**:
  `node backend/scripts/runAcademicPublicRagProbe.js --env-file backend/.env.provider.local --allow-two-public-calls`
- **Command Exit Status**: `2`
- **Overall Probe Status**: `PARTIAL_OR_PROVIDER_UNAVAILABLE`
- **Actual Provider Request Count**: `1` (of `maxRequests: 2`; `maxOutputTokens: 1024`, `embeddingsRequests: 0`, `retries: 0`, `privateDataSent: false`, `rawHistorySent: false`)

| Task | Prompt Scope | Returned Mode | Model | Source Count | Fallback Reason | Latency (`ms`) | Assessment |
|---|---|---|---|---:|---|---:|---|
| `PUBLIC_PROJECT_GUIDE` | `"Explain human-in-the-loop validation simply."` | `GEMINI_RAG` | `gemini-3.5-flash-lite` | `1` | `null` | `1621` | `CITED_SENTENCE_SUPPORT_NOT_CLINICAL_VALIDATION` |
| `PUBLIC_MEDICINE_OVERVIEW` | `"Explain Metformin."` | `ABSTAIN` | `null` | `0` | `null` | `6` | `null` |

## 3. Interpretation & Next Owner
- **Live Model Availability**: `gemini-3.5-flash-lite` is available and succeeded on the first public project-guide query (`mode: "GEMINI_RAG"`, `1621 ms`, `sourceCount: 1`, `assessment: "CITED_SENTENCE_SUPPORT_NOT_CLINICAL_VALIDATION"`).
- **Remaining Blocker for Codex**: The second probe prompt (`"Explain Metformin."`) returned `mode: "ABSTAIN"` locally in `6 ms` (`sourceCount: 0`) without calling the provider. Per handoff rules, no application files were edited and the probe was not re-run.
- **Next Owner**: **Codex**.
