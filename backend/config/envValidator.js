function validateEnv() {
  const usesProvider = ['RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_EMBEDDINGS_ENABLED', 'TRUSTRAG_LLM_ENABLED'].some(key => process.env[key] === 'true');
  // Production local-evidence mode does not need a paid-provider credential.
  // Development retains the legacy prototype's requirement for compatibility.
  const required = ['MONGO_URI', 'JWT_SECRET', ...(process.env.NODE_ENV !== 'production' || usesProvider ? ['GEMINI_API_KEY'] : [])];
  const missing = required.filter(key => !String(process.env[key] || '').trim());

  if (missing.length > 0) {
    throw new Error(`[CRITICAL] Missing required environment variables: ${missing.join(', ')}. Server cannot start. Please check your backend/.env file.`);
  }

  // These checks deliberately run before the server accepts traffic. They do not
  // validate secrets themselves or print their values.
  const { validateProductionSecurity } = require('./productionSecurity');
  validateProductionSecurity();
  if (process.env.NODE_ENV === 'production') {
    const { getDocumentStorageRoot, ensureDocumentStorageRoot } = require('./documentStorage');
    ensureDocumentStorageRoot(getDocumentStorageRoot());
  }
}

module.exports = { validateEnv };
