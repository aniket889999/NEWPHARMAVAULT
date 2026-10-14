const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';

const {
  extractDatabaseName,
  isTestDatabase,
  assertTestDatabase,
  DISPOSABLE_TEST_DATABASES,
  PROTECTED_DATABASES
} = require('../utils/testDatabaseGuard');

test('Focused Database-Free Test Database Guard Suite (U1.1)', async (t) => {
  // 1. Rejection of Ambiguous / Substring-Match Databases
  await t.test('1. Strictly rejects substring-match and ambiguous names (billing_latest, production_test, etc.)', () => {
    const dangerousTargets = [
      'billing_latest',
      'pharmavault_latest',
      'production_test',
      'prod_test',
      'dev_test',
      'my_test_database',
      'test_production',
      'analytics_test'
    ];

    for (const name of dangerousTargets) {
      const uri = `mongodb://127.0.0.1:27017/${name}`;
      assert.strictEqual(
        isTestDatabase(uri),
        false,
        `Expected '${name}' via URI to be rejected by isTestDatabase`
      );
      assert.strictEqual(
        isTestDatabase(name),
        false,
        `Expected plain name '${name}' to be rejected by isTestDatabase`
      );
      assert.throws(
        () => assertTestDatabase(uri),
        /DANGEROUS DATABASE TARGET REJECTED/,
        `Expected assertTestDatabase to throw on '${name}'`
      );
    }
  });

  // 2. Rejection of Protected Database Names
  await t.test('2. Strictly rejects protected production/development database targets', () => {
    for (const protectedName of PROTECTED_DATABASES) {
      const uri = `mongodb://127.0.0.1:27017/${protectedName}`;
      assert.strictEqual(
        isTestDatabase(uri),
        false,
        `Protected database '${protectedName}' must be rejected`
      );
      assert.throws(
        () => assertTestDatabase(uri),
        /DANGEROUS DATABASE TARGET REJECTED/,
        `assertTestDatabase must throw on protected target '${protectedName}'`
      );
    }
  });

  // 3. Rejection of Missing or Empty Database Names
  await t.test('3. Strictly rejects missing, empty, or unparseable database targets', () => {
    const missingTargets = [
      '',
      '   ',
      'mongodb://127.0.0.1:27017/',
      'mongodb://127.0.0.1:27017',
      'mongodb+srv://cluster0.example.com/',
      'mongodb+srv://cluster0.example.com',
      { name: '' },
      { db: { databaseName: '' } },
      { connection: { name: '' } },
      { connections: [{ name: '' }] },
      {}
    ];

    for (const target of missingTargets) {
      assert.strictEqual(
        isTestDatabase(target),
        false,
        `Missing target ${JSON.stringify(target)} must be rejected`
      );
      assert.throws(
        () => assertTestDatabase(target),
        /DANGEROUS DATABASE TARGET REJECTED/,
        `assertTestDatabase must throw on missing target`
      );
    }
  });

  // 4. Acceptance of Legitimate Project Disposable Test Databases
  await t.test('4. Accepts legitimate project disposable test targets across URI, Connection, and Mongoose instance formats', () => {
    for (const allowedName of DISPOSABLE_TEST_DATABASES) {
      // 4a. URI format (standard)
      const standardUri = `mongodb://127.0.0.1:27017/${allowedName}`;
      assert.strictEqual(extractDatabaseName(standardUri), allowedName);
      assert.strictEqual(isTestDatabase(standardUri), true);
      assert.doesNotThrow(() => assertTestDatabase(standardUri));

      // 4b. URI format with query options
      const uriWithOptions = `mongodb://127.0.0.1:27017/${allowedName}?authSource=admin&replicaSet=rs0`;
      assert.strictEqual(extractDatabaseName(uriWithOptions), allowedName);
      assert.strictEqual(isTestDatabase(uriWithOptions), true);
      assert.doesNotThrow(() => assertTestDatabase(uriWithOptions));

      // 4c. Connection object with `name`
      const connWithName = { name: allowedName };
      assert.strictEqual(extractDatabaseName(connWithName), allowedName);
      assert.strictEqual(isTestDatabase(connWithName), true);
      assert.doesNotThrow(() => assertTestDatabase(connWithName));

      // 4d. Connection object with `db.databaseName`
      const connWithDb = { db: { databaseName: allowedName } };
      assert.strictEqual(extractDatabaseName(connWithDb), allowedName);
      assert.strictEqual(isTestDatabase(connWithDb), true);
      assert.doesNotThrow(() => assertTestDatabase(connWithDb));

      // 4e. Mongoose instance with `connection.name`
      const mongooseWithConn = { connection: { name: allowedName } };
      assert.strictEqual(extractDatabaseName(mongooseWithConn), allowedName);
      assert.strictEqual(isTestDatabase(mongooseWithConn), true);
      assert.doesNotThrow(() => assertTestDatabase(mongooseWithConn));

      // 4f. Mongoose instance with `connections[0].name`
      const mongooseWithConnArr = { connections: [{ name: allowedName }] };
      assert.strictEqual(extractDatabaseName(mongooseWithConnArr), allowedName);
      assert.strictEqual(isTestDatabase(mongooseWithConnArr), true);
      assert.doesNotThrow(() => assertTestDatabase(mongooseWithConnArr));
    }
  });

  // 5. Strict NODE_ENV=test Enforcement
  await t.test('5. Rejects cleanup if NODE_ENV is not strictly test, even for allowed database names', () => {
    const validTarget = 'mongodb://127.0.0.1:27017/pharmavault_trustrag_test';
    const originalEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';
      assert.throws(
        () => assertTestDatabase(validTarget),
        /NODE_ENV is 'development', expected 'test'/
      );

      process.env.NODE_ENV = 'production';
      assert.throws(
        () => assertTestDatabase(validTarget),
        /NODE_ENV is 'production', expected 'test'/
      );

      process.env.NODE_ENV = '';
      assert.throws(
        () => assertTestDatabase(validTarget),
        /NODE_ENV is '', expected 'test'/
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }

    // Restored test env passes
    assert.doesNotThrow(() => assertTestDatabase(validTarget));
  });
});
