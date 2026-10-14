const path = require('path');
const fs = require('fs');

// One configuration interface for original documents and PDF page previews.
// The caller must never include this server-only path in a public response.
function getDocumentStorageRoot(env = process.env) {
  const configured = String(env.DOCUMENT_STORAGE_ROOT || '').trim();
  if (configured && !path.isAbsolute(configured)) {
    const error = new Error('Document storage configuration is invalid.');
    error.statusCode = 503;
    throw error;
  }
  if (!configured && env.NODE_ENV === 'production') {
    const error = new Error('Document storage configuration is required.');
    error.statusCode = 503;
    throw error;
  }
  return configured || path.join(__dirname, '..', 'storage', 'documents');
}

function ensureDocumentStorageRoot(root) {
  try {
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    fs.accessSync(root, fs.constants.R_OK | fs.constants.W_OK);
  } catch (_) {
    const error = new Error('Document storage is unavailable.');
    error.statusCode = 503;
    throw error;
  }
}

module.exports = { getDocumentStorageRoot, ensureDocumentStorageRoot };
