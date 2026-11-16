// Explicit local-development opt-in. Never used by the production start command.
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
  throw new Error('The public-reference chat demo may only run in development.');
}
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.PORT || '5001';
process.env.FRONTEND_URL = 'http://127.0.0.1:5173';
process.env.CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:5173,http://localhost:5173';
process.env.RAG_CHAT_LLM_ENABLED = 'true';
process.env.RAG_CHAT_PUBLIC_EXPORT_ALLOWED = 'true';
process.env.RAG_CHAT_EMBEDDINGS_ENABLED = 'true';
process.env.RAG_CHAT_MODEL = process.env.RAG_CHAT_MODEL || 'gemini-2.5-flash';
// Public knowledge egress must not enable private case summaries or legacy AI.
process.env.TRUSTRAG_LLM_ENABLED = 'false';
process.env.TRUSTRAG_LLM_EXPORT_ALLOWED = 'false';
require('../server');
