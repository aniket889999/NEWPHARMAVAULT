function validateEnv() {
  const required = ['MONGO_URI', 'JWT_SECRET', 'GEMINI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

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
