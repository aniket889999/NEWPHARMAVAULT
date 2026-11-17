# Secure provider-comparison setup

Local private file: `backend/.env.benchmark.local`. It is ignored by Git and should have mode 600. Fill it yourself; never paste credentials into chat or put them in a frontend `VITE_` variable. Existing credential files are not overwritten.

- `OPENAI_API_KEY` and `OPENAI_BENCHMARK_MODEL`: use your authorized project API key and an exact model ID available to your account.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_BENCHMARK_MODEL`: use a Claude API credential and an exact model ID available to your account. A workspace header may be required for your key's scope; set `ANTHROPIC_WORKSPACE_ID` only if needed.
- Model IDs are deliberately not guessed from ChatGPT/Claude subscription names. A product subscription is not a recorded API benchmark configuration.
- Keep `BENCHMARK_LIVE_ALLOWED=false` until a bounded request/token budget and public-only dataset are explicitly approved. Once approved and both credentials/model IDs are filled, set it to `true` privately for the one bounded run. Configuration is not itself spending permission.

Run `node backend/scripts/checkBenchmarkConfig.js`. It reports presence/permissions only, makes zero external requests and never prints credential values. Configured does not mean the API account/model has been verified. Do not run shell commands that echo keys or paste them into a terminal command that will enter history.

Primary documentation checked 17 November 2026: [OpenAI API authentication](https://developers.openai.com/api/reference/overview), [Claude authentication](https://platform.claude.com/docs/en/manage-claude/authentication). Both support server-side credentials; secrets must not be exposed in a browser or committed. No OpenAI/Claude API call has been made by this setup.

## Current approved pilot

On 17 November 2026 the user approved **up to 12 public-only requests after configuring keys**: 6 GPT and 6 Claude, each at most 1,024 output tokens and 8,000 serialized input characters. No patient data, web tools, embeddings or retries. This is a new approval, separate from the already consumed six-request Gemini pilot. Do not reuse either budget after it has been consumed.

The runner is ready:

```sh
# No provider calls; creates a local-only plan and unscored review template.
node backend/scripts/runProviderComparison.js

# Only after configuration and explicit bounded approval:
node backend/scripts/runProviderComparison.js --live-approved
```

The live command also requires the private `BENCHMARK_LIVE_ALLOWED=true` flag and valid key/model configurations for both providers. An exclusive, durable approval ledger prevents accidentally restarting another 12-call run. Do not delete or rename that ledger to reuse approval. A network error or interrupted call still consumes the reserved attempt. The code never automatically switches model, retries or uses the application Gemini credential.

Results go to Git-ignored `reports/checkpoints/provider-comparison/<run-id>/`, with private file permissions. Every completed row is saved incrementally to `results.partial.local`, so an interruption does not erase previous observations. `report.json` records failures and token usage; dollar cost remains unknown until model-specific pricing is checked. `blinded-review.json` hides system names; keep `private-unblinding.local` separate until grading is locked. Do not commit raw results without review.

API shapes follow the official [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create) and [Claude Messages API](https://platform.claude.com/docs/en/api/messages/create). OpenAI requests use `store:false`; this is an API setting, not a claim of universal zero retention. Provider defaults and actual returned model IDs/usage are disclosed. Output caps do not guarantee equal visible tokens, compute, latency or cost.

See `PROVIDER_COMPARISON_PROTOCOL.md` for the limited comparison claim and independent-review requirements.
