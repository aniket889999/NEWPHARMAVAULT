/**
 * Safe Test Database Isolation Guard
 * Enforces strict environment and database-name checks before permitting
 * any test-database connection or collection cleanup.
 *
 * Prevents accidental destructive cleanup against development, production,
 * or ambiguous/non-test databases.
 */

// Explicit allow-list of the project's disposable local test databases
const DISPOSABLE_TEST_DATABASES = new Set([
  'pharmavault_test',
  'pharmavault_trustrag_test',
  'pharmavault_trustrag_ocr_test',
  'pharmavault_trustrag_evidence_test',
  'pharmavault_smoke_test'
]);

// Explicitly protected databases
const PROTECTED_DATABASES = new Set([
  'pharmavault',
  'production',
  'prod',
  'dev',
  'development',
  'admin',
  'local',
  'config'
]);

/**
 * Extracts database name from connection, URI string, or environment
 */
function extractDatabaseName(target) {
  if (target === undefined || target === null) {
    target = process.env.MONGO_URI;
  }

  if (typeof target === 'string') {
    const trimmed = target.trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed.replace(/^mongodb(\+srv)?:\/\//, 'http://'));
      const pathname = parsed.pathname.replace(/^\//, '');
      return pathname.split('?')[0].split('/')[0] || '';
    } catch {
      const match = trimmed.match(/\/([^/?]+)(?:\?|$)/);
      return match ? match[1] : '';
    }
  }

  if (target && typeof target === 'object') {
    if (target.name) return target.name;
    if (target.connection && target.connection.name) return target.connection.name;
    if (target.connection && target.connection.db && target.connection.db.databaseName) return target.connection.db.databaseName;
    if (Array.isArray(target.connections) && target.connections[0] && target.connections[0].name) return target.connections[0].name;
    if (target.db && target.db.databaseName) return target.db.databaseName;
  }

  return '';
}

/**
 * Evaluates whether a database target is an allowed disposable test database.
 * Strictly checks against the project's explicit allow-list.
 */
function isTestDatabase(target) {
  const dbName = extractDatabaseName(target).toLowerCase();

  // Missing or empty database name is strictly rejected
  if (!dbName) return false;

  // Protected databases are strictly rejected
  if (PROTECTED_DATABASES.has(dbName)) return false;

  // Must strictly match one of the project's explicit disposable test databases
  return DISPOSABLE_TEST_DATABASES.has(dbName);
}

/**
 * Throws a fatal error if target is not a confirmed isolated test database.
 */
function assertTestDatabase(target) {
  const nodeEnv = process.env.NODE_ENV;
  const dbName = extractDatabaseName(target);

  if (nodeEnv !== 'test') {
    throw new Error(
      `DANGEROUS DATABASE TARGET REJECTED: NODE_ENV is '${nodeEnv}', expected 'test'. Test cleanup blocked.`
    );
  }

  if (!isTestDatabase(target)) {
    throw new Error(
      `DANGEROUS DATABASE TARGET REJECTED: Refusing destructive operation/cleanup on non-test database '${dbName || 'unknown'}'. Target must be an explicit disposable test database.`
    );
  }

  return true;
}

/**
 * Executes collection cleanup only after confirming database isolation.
 */
async function safeClearCollections(models, connection) {
  assertTestDatabase(connection);

  const modelList = Array.isArray(models) ? models : Object.values(models);
  await Promise.all(
    modelList.map(m => {
      if (m && typeof m.deleteMany === 'function') {
        return m.deleteMany({});
      }
      return Promise.resolve();
    })
  );
}

module.exports = {
  extractDatabaseName,
  isTestDatabase,
  assertTestDatabase,
  safeClearCollections,
  DISPOSABLE_TEST_DATABASES,
  PROTECTED_DATABASES
};
