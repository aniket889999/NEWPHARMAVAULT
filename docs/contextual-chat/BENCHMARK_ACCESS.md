# Secure provider-comparison setup

Local private file: `backend/.env.benchmark.local`. It is ignored by Git and should have mode 600. Fill it yourself; never paste credentials into chat or put them in a frontend `VITE_` variable. Existing credential files are not overwritten.

- `OPENAI_API_KEY` and `OPENAI_BENCHMARK_MODEL`: use your authorized project API key and an exact model ID available to your account.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_BENCHMARK_MODEL`: use a Claude API credential and an exact model ID available to your account. A workspace header may be required for your key's scope; set `ANTHROPIC_WORKSPACE_ID` only if needed.
- Model IDs are deliberately not guessed from ChatGPT/Claude subscription names. A product subscription is not a recorded API benchmark configuration.
- Keep `BENCHMARK_LIVE_ALLOWED=false`. This setup does not authorize paid calls. A separate bounded call count/token budget and public-only dataset must be agreed before direct cross-provider scoring.

Run `node backend/scripts/checkBenchmarkConfig.js`. It reports presence/permissions only, makes zero external requests and never prints credential values. Configured does not mean the API account/model has been verified. Do not run shell commands that echo keys or paste them into a terminal command that will enter history.

Primary documentation checked 17 November 2026: [OpenAI API authentication](https://developers.openai.com/api/reference/overview), [Claude authentication](https://platform.claude.com/docs/en/manage-claude/authentication). Both support server-side credentials; secrets must not be exposed in a browser or committed. No OpenAI/Claude API call has been made by this setup.
