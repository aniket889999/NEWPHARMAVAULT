const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_trustrag_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-u1-safety';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';

const app = require('../app');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');
const VerificationCase = require('../models/verificationCaseModel');
const ExtractedField = require('../models/extractedFieldModel');
const ReviewDecision = require('../models/reviewDecisionModel');

const {
  assertTestDatabase,
  isTestDatabase,
  extractDatabaseName
} = require('../utils/testDatabaseGuard');

const createAuthToken = (user) => {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('U1: Authorization, Lifecycle Enforcement, and Safe Database Isolation Suite', async (t) => {
  let dbConnection;
  let testOrgA, testOrgB;
  let patientUser, orgAdminUser, pharmacistUser, claimsUser, unassignedStaffUser, evaluatorUser;
  let patientToken, orgAdminToken, pharmacistToken, claimsToken, unassignedStaffToken, evaluatorToken;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    dbConnection = await mongoose.connect(process.env.MONGO_URI);
    assertTestDatabase(dbConnection);

    // Wipe test collections
    await Promise.all([
      User.deleteMany({}),
      Organization.deleteMany({}),
      VerificationCase.deleteMany({}),
      ExtractedField.deleteMany({}),
      ReviewDecision.deleteMany({})
    ]);

    // Create test organizations
    testOrgA = await Organization.create({
      name: 'U1 Test Healthcare Org A',
      owner: new mongoose.Types.ObjectId(),
      plan: 'Enterprise',
      status: 'active'
    });

    testOrgB = await Organization.create({
      name: 'U1 Test Healthcare Org B',
      owner: new mongoose.Types.ObjectId(),
      plan: 'Enterprise',
      status: 'active'
    });

    // Create test users
    patientUser = await User.create({
      name: 'Patient Alice',
      email: 'alice.u1@example.com',
      password: 'password123',
      role: 'patient'
    });
    patientToken = createAuthToken(patientUser);

    orgAdminUser = await User.create({
      name: 'Admin Bob',
      email: 'bob.admin@example.com',
      password: 'password123',
      role: 'org_admin',
      organizationId: testOrgA._id
    });
    orgAdminToken = createAuthToken(orgAdminUser);

    pharmacistUser = await User.create({
      name: 'Pharmacist Carol',
      email: 'carol.pharm@example.com',
      password: 'password123',
      role: 'pharmacist',
      organizationId: testOrgA._id
    });
    pharmacistToken = createAuthToken(pharmacistUser);

    claimsUser = await User.create({
      name: 'Reviewer Dave',
      email: 'dave.claims@example.com',
      password: 'password123',
      role: 'claims_reviewer',
      organizationId: testOrgA._id
    });
    claimsToken = createAuthToken(claimsUser);

    unassignedStaffUser = await User.create({
      name: 'Unassigned Staff Eve',
      email: 'eve.unassigned@example.com',
      password: 'password123',
      role: 'pharmacist',
      organizationId: null
    });
    unassignedStaffToken = createAuthToken(unassignedStaffUser);

    evaluatorUser = await User.create({
      name: 'Researcher Frank',
      email: 'frank.evaluator@example.com',
      password: 'password123',
      role: 'research_evaluator'
    });
    evaluatorToken = createAuthToken(evaluatorUser);
  });

  t.after(async () => {
    if (dbConnection) {
      await mongoose.disconnect();
    }
  });

  // 1. Safe Test Database Isolation Guard
  await t.test('1. Test-database guard strictly rejects development/production targets and non-test environments', async () => {
    // Assert helper extracts correct database names
    assert.strictEqual(extractDatabaseName('mongodb://127.0.0.1:27017/pharmavault'), 'pharmavault');
    assert.strictEqual(extractDatabaseName('mongodb://127.0.0.1:27017/pharmavault_trustrag_test'), 'pharmavault_trustrag_test');

    // Protected / development / production / substring-match names are strictly rejected
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/pharmavault'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/production'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/dev'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/development'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/billing_latest'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/pharmavault_latest'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/production_test'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/prod_test'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/dev_test'), false);
    assert.strictEqual(isTestDatabase('mongodb://127.0.0.1:27017/pharmavault_trustrag_test'), true);

    // assertTestDatabase throws descriptive fatal error on non-test DB
    assert.throws(
      () => assertTestDatabase('mongodb://127.0.0.1:27017/pharmavault'),
      /DANGEROUS DATABASE TARGET REJECTED.*pharmavault/
    );

    assert.throws(
      () => assertTestDatabase('mongodb://127.0.0.1:27017/billing_latest'),
      /DANGEROUS DATABASE TARGET REJECTED.*billing_latest/
    );

    assert.throws(
      () => assertTestDatabase('mongodb://127.0.0.1:27017/production_test'),
      /DANGEROUS DATABASE TARGET REJECTED.*production_test/
    );

    assert.throws(
      () => assertTestDatabase('mongodb://127.0.0.1:27017/production'),
      /DANGEROUS DATABASE TARGET REJECTED.*production/
    );

    // If NODE_ENV is changed, guard throws immediately
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      assert.throws(
        () => assertTestDatabase('mongodb://127.0.0.1:27017/pharmavault_trustrag_test'),
        /NODE_ENV is 'development'/
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // 2. Public Self-Registration & Staff Provisioning
  await t.test('2. Public self-registration permits submitter role only; staff roles require org administrator', async () => {
    // 2a. Registering with role 'patient' succeeds
    const regPatient = await request(app)
      .post('/api/users/register')
      .send({
        name: 'Self Registered Patient',
        email: 'self.patient@example.com',
        password: 'password123',
        role: 'patient'
      });
    assert.strictEqual(regPatient.status, 201);
    assert.strictEqual(regPatient.body.role, 'patient');

    // 2b. Registering with role 'pharmacist' returns HTTP 403 Forbidden
    const regPharm = await request(app)
      .post('/api/users/register')
      .send({
        name: 'Attacker Pharmacist',
        email: 'attacker.pharm@example.com',
        password: 'password123',
        role: 'pharmacist'
      });
    assert.strictEqual(regPharm.status, 403);
    assert.match(regPharm.body.message, /Public self-registration only permits the submitter/i);

    // 2c. Registering with role 'org_admin' returns HTTP 403 Forbidden
    const regAdmin = await request(app)
      .post('/api/users/register')
      .send({
        name: 'Attacker Admin',
        email: 'attacker.admin@example.com',
        password: 'password123',
        role: 'org_admin'
      });
    assert.strictEqual(regAdmin.status, 403);

    // 2d. Patient attempting to provision staff returns HTTP 403 Forbidden
    const patientProv = await request(app)
      .post('/api/users/provision-staff')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        name: 'Illegitimate Staff',
        email: 'illegitimate.staff@example.com',
        password: 'password123',
        role: 'pharmacist'
      });
    assert.strictEqual(patientProv.status, 403);

    // 2e. Org Admin successfully provisions staff with explicit organization membership
    const adminProv = await request(app)
      .post('/api/users/provision-staff')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        name: 'Provisioned Pharmacist 2',
        email: 'prov.pharm2@example.com',
        password: 'password123',
        role: 'pharmacist'
      });
    assert.strictEqual(adminProv.status, 201);
    assert.strictEqual(adminProv.body.role, 'pharmacist');
    assert.strictEqual(adminProv.body.organizationId.toString(), testOrgA._id.toString());
  });

  // 3. Staff Tenant Scoping & Missing Tenant Context Denial
  await t.test('3. Staff with missing tenant context receive 403 denial, not demo fallback or global query', async () => {
    // Unassigned staff calling /review-queue returns 403
    const queueRes = await request(app)
      .get('/api/v1/review-queue')
      .set('Authorization', `Bearer ${unassignedStaffToken}`);
    assert.strictEqual(queueRes.status, 403);
    assert.match(queueRes.body.message, /organization tenant context/i);

    // Unassigned staff calling /cases returns 403
    const listRes = await request(app)
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${unassignedStaffToken}`);
    assert.strictEqual(listRes.status, 403);
    assert.match(listRes.body.message, /organization tenant context/i);

    // Verify unassigned staff was NOT silently assigned to a demo organization
    const eveDb = await User.findById(unassignedStaffUser._id);
    assert.strictEqual(eveDb.organizationId || null, null);
  });

  // 4. Lifecycle Enforcement & Patient Final Status Denial
  await t.test('4. Patient cannot set VERIFIED/REJECTED; Case PATCH cannot bypass ReviewDecision or inject internal metadata', async () => {
    // Patient creates a case
    const createCaseRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ subjectReference: 'patient-u1-lifecycle-test' });
    assert.strictEqual(createCaseRes.status, 201);
    const caseId = createCaseRes.body.id || createCaseRes.body._id;

    // 4a. Patient cannot patch case to set status='VERIFIED' -> 403 Forbidden
    const patientVerified = await request(app)
      .patch(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ status: 'VERIFIED' });
    assert.strictEqual(patientVerified.status, 403);

    // 4b. Patient cannot patch case to set status='REJECTED' -> 403 Forbidden
    const patientRejected = await request(app)
      .patch(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ status: 'REJECTED' });
    assert.strictEqual(patientRejected.status, 403);

    // 4c. Patient cannot call submitReview -> 403 Forbidden
    const patientReview = await request(app)
      .post(`/api/v1/cases/${caseId}/reviews`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ action: 'VERIFY', reasonCode: 'PATIENT_ATTEMPTED_REVIEW' });
    assert.strictEqual(patientReview.status, 403);

    // 4d. Staff attempting to patch case directly to VERIFIED -> 400 Bad Request
    const staffPatchVerified = await request(app)
      .patch(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ status: 'VERIFIED' });
    assert.strictEqual(staffPatchVerified.status, 400);
    assert.match(staffPatchVerified.body.message, /ReviewDecision/i);

    // 4e. Staff attempting to inject internal explanation metadata -> 400 Bad Request
    const staffInjectExplanation = await request(app)
      .patch(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ metadata: { explanation: { text: 'fake injected explanation' } } });
    assert.strictEqual(staffInjectExplanation.status, 400);
    assert.match(staffInjectExplanation.body.message, /Injecting internal explanation or resolution metadata/i);

    // 4f. Staff attempting to inject internal resolution metadata -> 400 Bad Request
    const staffInjectResolution = await request(app)
      .patch(`/api/v1/cases/${caseId}`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ metadata: { resolutions: [{ genericName: 'Injected' }] } });
    assert.strictEqual(staffInjectResolution.status, 400);
    assert.match(staffInjectResolution.body.message, /Injecting internal explanation or resolution metadata/i);
  });

  // 5. Correction and Review Permissions
  await t.test('5. Extracted field corrections and reviews strictly enforce authorization matrix', async () => {
    // Create case in NEEDS_CORRECTION
    const hitlCase = await VerificationCase.create({
      organizationId: testOrgA._id,
      createdBy: patientUser._id,
      status: 'NEEDS_CORRECTION',
      reviewRequired: true,
      schemaVersion: '1.0'
    });

    const field = await ExtractedField.create({
      caseId: hitlCase._id,
      documentId: new mongoose.Types.ObjectId(),
      fieldName: 'MEDICINE_NAME',
      fieldType: 'MEDICINE_NAME',
      rawValue: 'Paractamol 500mg',
      normalizedValue: 'Paractamol 500mg',
      confidence: 0.45,
      needsCorrection: true,
      boundingBox: [10, 10, 100, 30]
    });

    // 5a. Patient attempting to correct field -> 403 Forbidden
    const patientCorrect = await request(app)
      .patch(`/api/v1/cases/${hitlCase._id}/extracted-fields/${field._id}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ normalizedValue: 'Paracetamol 500mg' });
    assert.strictEqual(patientCorrect.status, 403);
    assert.match(patientCorrect.body.message, /healthcare staff/i);

    // 5b. Pharmacist in Org A corrects field -> 200 OK
    const pharmCorrect = await request(app)
      .patch(`/api/v1/cases/${hitlCase._id}/extracted-fields/${field._id}`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ normalizedValue: 'Paracetamol 500mg' });
    assert.strictEqual(pharmCorrect.status, 200);
    assert.strictEqual(pharmCorrect.body.needsCorrection, false);
    assert.strictEqual(pharmCorrect.body.normalizedValue, 'Paracetamol 500mg');

    // 5c. Research evaluator access without de-identification pipeline -> 403 Forbidden
    const evalRes = await request(app)
      .get(`/api/v1/cases/${hitlCase._id}`)
      .set('Authorization', `Bearer ${evaluatorToken}`);
    assert.strictEqual(evalRes.status, 403);
    assert.match(evalRes.body.message, /Research-evaluator access requires de-identification/i);
  });
});
