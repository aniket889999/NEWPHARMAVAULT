// Default: inspect configuration only. An explicit live opt-in permits one public call.
const fs = require('node:fs');
const { runPublicProbe } = require('../services/publicProviderProbeService');

async function main() {
  const args = process.argv.slice(2);
  let envFile, allowProviderCall = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--allow-provider-call') allowProviderCall = true;
    else if (args[i] === '--env-file' && args[i + 1] && !args[i + 1].startsWith('--')) envFile = args[++i];
    else if (args[i] === '--help') {
      console.log('node backend/scripts/checkChatProvider.js [--env-file PATH] [--allow-provider-call]');
      console.log('Default: zero network. Live: at most one public workflow generation, no embeddings/retries/private case or server configuration changes.'); return;
    } else throw new Error('Invalid diagnostic arguments.');
  }
  if (envFile) {
    // Read only explicitly supplied configuration; copy only public-provider keys.
    const parsed = require('dotenv').parse(fs.readFileSync(envFile));
    for (const key of ['GEMINI_API_KEY', 'RAG_CHAT_MODEL', 'RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED']) {
      if (process.env[key] === undefined && parsed[key] !== undefined) process.env[key] = parsed[key];
    }
  }
  // These are child-process restrictions, not edits to the app's environment file.
  process.env.RAG_CHAT_EMBEDDINGS_ENABLED = 'false';
  process.env.TRUSTRAG_LLM_ENABLED = 'false';
  process.env.TRUSTRAG_LLM_EXPORT_ALLOWED = 'false';
  const result = await runPublicProbe({ allowProviderCall });
  console.log(JSON.stringify(result, null, 2));
  if (allowProviderCall && result.status !== 'VERIFIED') process.exitCode = 2;
}
main().catch(() => {
  // Never dump configuration, filenames, upstream response bodies or exceptions.
  console.log(JSON.stringify({ status: 'DIAGNOSTIC_FAILED', liveProviderVerified: false,
    message: 'The bounded diagnostic could not complete. No raw upstream or configuration details are exposed.' }));
  process.exitCode = 2;
});
