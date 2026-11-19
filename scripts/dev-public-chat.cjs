'use strict';
// Explicit opt-in only. Load only provider fields from the ignored local file;
// database/auth configuration still belongs to backend/.env. Never print keys.
// This command can consume provider credits when a public question is submitted.
const fs = require('node:fs'), path = require('node:path');
const { createRequire } = require('node:module');
const requireBackend = createRequire(path.resolve(__dirname, '../backend/package.json'));
const providerPath = path.resolve(__dirname, '../backend/.env.provider.local');
if (fs.existsSync(providerPath)) {
  const values = requireBackend('dotenv').parse(fs.readFileSync(providerPath));
  for (const key of ['GEMINI_API_KEY', 'RAG_CHAT_MODEL', 'RAG_CHAT_EMBEDDING_MODEL']) if (values[key]) process.env[key] = values[key];
}
if (!requireBackend('./services/chatProviderReadinessService').hasProviderCredential(process.env.GEMINI_API_KEY)) {
  throw new Error('Configure a fresh Gemini key privately in backend/.env.provider.local before starting public generation.');
}
process.env.PHARMAVAULT_PUBLIC_CHAT = '1';
process.env.RAG_CHAT_WEB_ENABLED = 'true';
process.env.RAG_CHAT_WEB_MODE = 'ALWAYS_PUBLIC';
require('./dev-local.cjs');
