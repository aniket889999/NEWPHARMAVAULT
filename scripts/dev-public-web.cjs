'use strict';
// Explicit public-only web mode. The existing local launcher keeps paid model
// generation/embeddings/private export disabled. No .env values are displayed.
process.env.RAG_CHAT_WEB_ENABLED = process.env.RAG_CHAT_WEB_ENABLED || 'true';
process.env.RAG_CHAT_WEB_MODE = process.env.RAG_CHAT_WEB_MODE || 'ALWAYS_PUBLIC';
require('./dev-local.cjs');
