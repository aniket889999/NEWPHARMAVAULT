const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');

dotenv.config();

const CanonicalMedicine = require('../models/canonicalMedicineModel');
const ConsistencyCheck = require('../models/consistencyCheckModel');
const RiskSignal = require('../models/riskSignalModel');
const EvidenceItem = require('../models/evidenceItemModel');
const VerificationCase = require('../models/verificationCaseModel');
const Document = require('../models/documentModel');
const ExtractedField = require('../models/extractedFieldModel');
const User = require('../models/userModel');
const Organization = require('../models/organizationModel');

const identityResolutionService = require('../services/trustRag/identityResolutionService');
const consistencyCheckService = require('../services/trustRag/consistencyCheckService');
const riskSignalService = require('../services/trustRag/riskSignalService');
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_trustrag_test';

const { assertTestDatabase } = require('../utils/testDatabaseGuard');
const {
  seedCanonicalCatalogue,
  ACADEMIC_CATALOGUE_VERSION,
  ACADEMIC_SOURCE_NOTE
} = require('../seeders/catalogueSeeder');

test('Work Order 5A: Explainable Medicine Identity Resolution Test Suite', async (t) => {
  let dbConnection;

  t.before(async () => {
    assertTestDatabase(process.env.MONGO_URI);
    dbConnection = await mongoose.connect(process.env.MONGO_URI);
    assertTestDatabase(dbConnection);
    // Wipe relevant collections
    await Promise.all([
      CanonicalMedicine.deleteMany({}),
      ConsistencyCheck.deleteMany({}),
      RiskSignal.deleteMany({}),
      EvidenceItem.deleteMany({}),
      VerificationCase.deleteMany({}),
      Document.deleteMany({}),
      ExtractedField.deleteMany({})
    ]);
  });

  t.after(async () => {
    if (dbConnection) {
      await mongoose.disconnect();
    }
  });

  // 1. Idempotent Explicit Seed Command
  await t.test('1. Seed command is explicit, idempotent, and tags versioned academic notes', async () => {
    // First run
    const result1 = await seedCanonicalCatalogue({ silent: true });
    assert.strictEqual(result1.catalogueVersion, ACADEMIC_CATALOGUE_VERSION);
    assert.strictEqual(result1.sourceNote, ACADEMIC_SOURCE_NOTE);
    const count1 = await CanonicalMedicine.countDocuments();
    assert.ok(count1 >= 15, `Expected at least 15 curated catalogue records, got ${count1}`);

    // Verify all records have mandatory academic boundary fields
    const samples = await CanonicalMedicine.find({});
    for (const record of samples) {
      assert.ok(record.brandName, 'Record must have brandName');
      assert.ok(record.genericName, 'Record must have genericName');
      assert.ok(record.strength, 'Record must have strength');
      assert.ok(record.dosageForm, 'Record must have dosageForm');
      assert.ok(Array.isArray(record.aliases), 'Record must have aliases array');
      assert.strictEqual(record.catalogueVersion, ACADEMIC_CATALOGUE_VERSION);
      assert.strictEqual(record.sourceNote, ACADEMIC_SOURCE_NOTE);
    }

    // Second run must be completely idempotent
    const result2 = await seedCanonicalCatalogue({ silent: true });
    const count2 = await CanonicalMedicine.countDocuments();
    assert.strictEqual(count1, count2, 'Idempotent seeder must not create duplicate records on repeated execution');
    assert.strictEqual(result1.total, result2.total);
  });

  // 2. Cross-brand matching to the same generic medicine
  await t.test('2. Different brand names resolve to same generic medicine and pass consistency check', async () => {
    // Rx: Crocin 500 -> Generic: Paracetamol
    const rxRes = await identityResolutionService.resolveMedicine('Crocin 500mg');
    assert.strictEqual(rxRes.resolved, true);
    assert.strictEqual(rxRes.ambiguous, false);
    assert.strictEqual(rxRes.canonical.genericName, 'Paracetamol');
    assert.strictEqual(rxRes.matchBasis, 'Brand + Strength');
    assert.ok(rxRes.matchScore >= 0.95);

    // Invoice: Dolo 500 -> Generic: Paracetamol
    const invRes = await identityResolutionService.resolveMedicine('Dolo 500');
    assert.strictEqual(invRes.resolved, true);
    assert.strictEqual(invRes.canonical.genericName, 'Paracetamol');

    // Run consistency check with these resolutions
    const caseId = new mongoose.Types.ObjectId();
    const rxDocId = new mongoose.Types.ObjectId();
    const invDocId = new mongoose.Types.ObjectId();

    const documents = [
      { _id: rxDocId, type: 'PRESCRIPTION' },
      { _id: invDocId, type: 'PHARMACY_INVOICE' },
      { _id: new mongoose.Types.ObjectId(), type: 'CLAIM_FORM' }
    ];

    const fields = [
      { _id: new mongoose.Types.ObjectId(), documentId: rxDocId, fieldType: 'medicine_name', rawValue: 'Crocin 500mg' },
      { _id: new mongoose.Types.ObjectId(), documentId: invDocId, fieldType: 'medicine_name', rawValue: 'Dolo 500' },
      { _id: new mongoose.Types.ObjectId(), documentId: rxDocId, fieldType: 'dosage_strength', rawValue: '500mg' },
      { _id: new mongoose.Types.ObjectId(), documentId: invDocId, fieldType: 'dosage_strength', rawValue: '500mg' }
    ];

    const resolutions = {
      PRESCRIPTION: rxRes,
      PHARMACY_INVOICE: invRes
    };

    const checks = await consistencyCheckService.runChecks({
      caseId,
      documents,
      fields,
      resolutions
    });

    const medCheck = checks.find(c => c.checkType === 'MEDICINE_NAME_CONSISTENCY');
    assert.ok(medCheck, 'MEDICINE_NAME_CONSISTENCY check must exist');
    assert.strictEqual(medCheck.status, 'PASS', 'Different brands with identical resolved generic must PASS');
    assert.strictEqual(medCheck.reviewRequired, false);
    assert.ok(medCheck.message.includes('Paracetamol'), 'Check message must cite resolved generic name');

    // Evidence citation states both OCR document evidence and curated local medicine catalogue
    const evidence = await EvidenceItem.findById(medCheck.evidenceItemIds[0]);
    assert.ok(evidence.evidenceText.includes('OCR document evidence'), 'Must cite OCR document evidence');
    assert.ok(evidence.evidenceText.includes('Curated local medicine catalogue'), 'Must cite curated local catalogue');
  });

  // 3. Same generic with different strengths produces strength mismatch FAIL
  await t.test('3. Same generic with different strengths passes medicine name check but fails dosage strength check', async () => {
    const rxRes = await identityResolutionService.resolveMedicine('Crocin 500mg');
    const invRes = await identityResolutionService.resolveMedicine('Dolo 650mg');

    assert.strictEqual(rxRes.canonical.genericName, 'Paracetamol');
    assert.strictEqual(invRes.canonical.genericName, 'Paracetamol');

    const caseId = new mongoose.Types.ObjectId();
    const rxDocId = new mongoose.Types.ObjectId();
    const invDocId = new mongoose.Types.ObjectId();

    const documents = [
      { _id: rxDocId, type: 'PRESCRIPTION' },
      { _id: invDocId, type: 'PHARMACY_INVOICE' },
      { _id: new mongoose.Types.ObjectId(), type: 'CLAIM_FORM' }
    ];

    const fields = [
      { _id: new mongoose.Types.ObjectId(), documentId: rxDocId, fieldType: 'medicine_name', rawValue: 'Crocin 500mg' },
      { _id: new mongoose.Types.ObjectId(), documentId: invDocId, fieldType: 'medicine_name', rawValue: 'Dolo 650mg' },
      { _id: new mongoose.Types.ObjectId(), documentId: rxDocId, fieldType: 'dosage_strength', rawValue: '500mg' },
      { _id: new mongoose.Types.ObjectId(), documentId: invDocId, fieldType: 'dosage_strength', rawValue: '650mg' }
    ];

    const resolutions = {
      PRESCRIPTION: rxRes,
      PHARMACY_INVOICE: invRes
    };

    const checks = await consistencyCheckService.runChecks({
      caseId,
      documents,
      fields,
      resolutions
    });

    // Medicine name check passes because generic matches
    const medCheck = checks.find(c => c.checkType === 'MEDICINE_NAME_CONSISTENCY');
    assert.strictEqual(medCheck.status, 'PASS');

    // Dosage strength check must FAIL
    const strengthCheck = checks.find(c => c.checkType === 'DOSAGE_STRENGTH_CONSISTENCY');
    assert.ok(strengthCheck, 'DOSAGE_STRENGTH_CONSISTENCY check must exist');
    assert.strictEqual(strengthCheck.status, 'FAIL', 'Differing strengths must fail');
    assert.strictEqual(strengthCheck.severity, 'HIGH');
    assert.strictEqual(strengthCheck.reviewRequired, true);

    // Evaluate risk signals
    const signals = await riskSignalService.evaluateRiskSignals({
      caseId,
      documents,
      fields,
      checks,
      resolutions
    });

    const strengthSignal = signals.find(s => s.signalType === 'MEDICINE_STRENGTH_MISMATCH');
    assert.ok(strengthSignal, 'Must trigger MEDICINE_STRENGTH_MISMATCH signal');
    assert.strictEqual(strengthSignal.severity, 'HIGH');

    // Medicine name mismatch must NOT be triggered
    const nameSignal = signals.find(s => s.signalType === 'MEDICINE_NAME_MISMATCH');
    assert.strictEqual(nameSignal, undefined, 'Must NOT trigger MEDICINE_NAME_MISMATCH when generic aligns');
  });

  // 4. Same generic with different dosage form requires review
  await t.test('4. Same generic with different dosage form produces INCONCLUSIVE check requiring review', async () => {
    const rxRes = await identityResolutionService.resolveMedicine('Crocin 500mg'); // Tablet
    const invRes = await identityResolutionService.resolveMedicine('Calpol Suspension'); // Syrup

    assert.strictEqual(rxRes.canonical.genericName, 'Paracetamol');
    assert.strictEqual(invRes.canonical.genericName, 'Paracetamol');
    assert.strictEqual(rxRes.canonical.dosageForm, 'Tablet');
    assert.strictEqual(invRes.canonical.dosageForm, 'Syrup');

    const caseId = new mongoose.Types.ObjectId();
    const rxDocId = new mongoose.Types.ObjectId();
    const invDocId = new mongoose.Types.ObjectId();

    const documents = [
      { _id: rxDocId, type: 'PRESCRIPTION' },
      { _id: invDocId, type: 'PHARMACY_INVOICE' },
      { _id: new mongoose.Types.ObjectId(), type: 'CLAIM_FORM' }
    ];

    const fields = [
      { _id: new mongoose.Types.ObjectId(), documentId: rxDocId, fieldType: 'medicine_name', rawValue: 'Crocin 500mg' },
      { _id: new mongoose.Types.ObjectId(), documentId: invDocId, fieldType: 'medicine_name', rawValue: 'Calpol Suspension' },
      { _id: new mongoose.Types.ObjectId(), documentId: rxDocId, fieldType: 'dosage_form', rawValue: 'Tablet' },
      { _id: new mongoose.Types.ObjectId(), documentId: invDocId, fieldType: 'dosage_form', rawValue: 'Syrup' }
    ];

    const resolutions = {
      PRESCRIPTION: rxRes,
      PHARMACY_INVOICE: invRes
    };

    const checks = await consistencyCheckService.runChecks({
      caseId,
      documents,
      fields,
      resolutions
    });

    const formCheck = checks.find(c => c.checkType === 'DOSAGE_FORM_CONSISTENCY');
    assert.ok(formCheck, 'DOSAGE_FORM_CONSISTENCY check must exist');
    assert.strictEqual(formCheck.status, 'INCONCLUSIVE', 'Differing dosage form must be INCONCLUSIVE');
    assert.strictEqual(formCheck.reviewRequired, true, 'Differing dosage form must require review');

    const signals = await riskSignalService.evaluateRiskSignals({
      caseId,
      documents,
      fields,
      checks,
      resolutions
    });

    const formSignal = signals.find(s => s.signalType === 'DOSAGE_FORM_DISCREPANCY');
    assert.ok(formSignal, 'Must trigger DOSAGE_FORM_DISCREPANCY risk signal');
    assert.strictEqual(formSignal.reviewRequired, true);
  });

  // 5. Ambiguous / Unknown / Weak OCR text produces INCONCLUSIVE check and UNRESOLVED_MEDICINE_IDENTITY signal
  await t.test('5. Weak or unresolvable OCR text produces INCONCLUSIVE check and UNRESOLVED_MEDICINE_IDENTITY signal without calling it a false mismatch', async () => {
    // Weak OCR: text < 3 characters or non-letter gibberish
    const weakRes1 = await identityResolutionService.resolveMedicine('x');
    assert.strictEqual(weakRes1.resolved, false);
    assert.strictEqual(weakRes1.matchBasis, 'Weak OCR Text');
    assert.strictEqual(weakRes1.matchScore, 0);

    const weakRes2 = await identityResolutionService.resolveMedicine('???---');
    assert.strictEqual(weakRes2.resolved, false);
    assert.strictEqual(weakRes2.matchBasis, 'Weak OCR Text');

    // Unknown medicine text
    const unknownRes = await identityResolutionService.resolveMedicine('NonExistentMedicineDrugXYZ');
    assert.strictEqual(unknownRes.resolved, false);
    assert.strictEqual(unknownRes.matchBasis, 'None');
    assert.strictEqual(unknownRes.canonical, null);

    const caseId = new mongoose.Types.ObjectId();
    const rxDocId = new mongoose.Types.ObjectId();
    const invDocId = new mongoose.Types.ObjectId();

    const documents = [
      { _id: rxDocId, type: 'PRESCRIPTION' },
      { _id: invDocId, type: 'PHARMACY_INVOICE' },
      { _id: new mongoose.Types.ObjectId(), type: 'CLAIM_FORM' }
    ];

    const fields = [
      { _id: new mongoose.Types.ObjectId(), documentId: rxDocId, fieldType: 'medicine_name', rawValue: 'NonExistentMedicineDrugXYZ' },
      { _id: new mongoose.Types.ObjectId(), documentId: invDocId, fieldType: 'medicine_name', rawValue: 'Crocin 500mg' }
    ];

    const resolutions = {
      PRESCRIPTION: unknownRes,
      PHARMACY_INVOICE: await identityResolutionService.resolveMedicine('Crocin 500mg')
    };

    const checks = await consistencyCheckService.runChecks({
      caseId,
      documents,
      fields,
      resolutions
    });

    const medCheck = checks.find(c => c.checkType === 'MEDICINE_NAME_CONSISTENCY');
    assert.ok(medCheck);
    assert.strictEqual(medCheck.status, 'INCONCLUSIVE', 'Unresolved medicine identity must be INCONCLUSIVE, never FAIL');
    assert.strictEqual(medCheck.reviewRequired, true);

    const signals = await riskSignalService.evaluateRiskSignals({
      caseId,
      documents,
      fields,
      checks,
      resolutions
    });

    // Must trigger UNRESOLVED_MEDICINE_IDENTITY
    const unresolvedSignal = signals.find(s => s.signalType === 'UNRESOLVED_MEDICINE_IDENTITY');
    assert.ok(unresolvedSignal, 'Must trigger UNRESOLVED_MEDICINE_IDENTITY signal');
    assert.strictEqual(unresolvedSignal.reviewRequired, true);

    // Must NOT assert MEDICINE_NAME_MISMATCH
    const mismatchSignal = signals.find(s => s.signalType === 'MEDICINE_NAME_MISMATCH');
    assert.strictEqual(mismatchSignal, undefined, 'Never call an unresolved identity a mismatch without evidence');
  });

  // 6. Confirmed mismatch between two distinct generics
  await t.test('6. Confirmed conflicting generic medicines trigger FAIL and MEDICINE_NAME_MISMATCH', async () => {
    // Paracetamol vs Atorvastatin
    const rxRes = await identityResolutionService.resolveMedicine('Crocin 500mg');
    const invRes = await identityResolutionService.resolveMedicine('Atorva 10');

    assert.strictEqual(rxRes.canonical.genericName, 'Paracetamol');
    assert.strictEqual(invRes.canonical.genericName, 'Atorvastatin');

    const caseId = new mongoose.Types.ObjectId();
    const rxDocId = new mongoose.Types.ObjectId();
    const invDocId = new mongoose.Types.ObjectId();

    const documents = [
      { _id: rxDocId, type: 'PRESCRIPTION' },
      { _id: invDocId, type: 'PHARMACY_INVOICE' },
      { _id: new mongoose.Types.ObjectId(), type: 'CLAIM_FORM' }
    ];

    const fields = [
      { _id: new mongoose.Types.ObjectId(), documentId: rxDocId, fieldType: 'medicine_name', rawValue: 'Crocin 500mg' },
      { _id: new mongoose.Types.ObjectId(), documentId: invDocId, fieldType: 'medicine_name', rawValue: 'Atorva 10' }
    ];

    const resolutions = {
      PRESCRIPTION: rxRes,
      PHARMACY_INVOICE: invRes
    };

    const checks = await consistencyCheckService.runChecks({
      caseId,
      documents,
      fields,
      resolutions
    });

    const medCheck = checks.find(c => c.checkType === 'MEDICINE_NAME_CONSISTENCY');
    assert.strictEqual(medCheck.status, 'FAIL', 'Conflicting resolved generics must trigger FAIL');
    assert.strictEqual(medCheck.severity, 'HIGH');

    const signals = await riskSignalService.evaluateRiskSignals({
      caseId,
      documents,
      fields,
      checks,
      resolutions
    });

    const mismatchSignal = signals.find(s => s.signalType === 'MEDICINE_NAME_MISMATCH');
    assert.ok(mismatchSignal, 'Must trigger MEDICINE_NAME_MISMATCH on confirmed generic conflict');
  });

  // 7. Academic boundary & Privacy: Zero external HTTP/HTTPS or LLM calls
  await t.test('7. Medicine resolution makes zero outbound HTTP/HTTPS or external LLM calls', async () => {
    let outboundHttpAttempted = false;

    const originalHttpRequest = http.request;
    const originalHttpsRequest = https.request;

    http.request = () => {
      outboundHttpAttempted = true;
      throw new Error('Prohibited external HTTP request during medicine identity resolution');
    };
    https.request = () => {
      outboundHttpAttempted = true;
      throw new Error('Prohibited external HTTPS request during medicine identity resolution');
    };

    try {
      const testQueries = [
        'Crocin 500',
        'Dolo 650',
        'Glycomet 500',
        'Okacet',
        'Azee 500',
        'Pan 40',
        'Augmentin 625 Duo',
        'Atorva 10',
        'Losar 50',
        'Omez 20'
      ];

      for (const q of testQueries) {
        const res = await identityResolutionService.resolveMedicine(q);
        assert.ok(res.resolved, `Query "${q}" should resolve in local catalogue`);
        assert.ok(res.canonical.genericName, `Query "${q}" should have canonical genericName`);
      }

      assert.strictEqual(outboundHttpAttempted, false, 'Zero external network calls must be made');
    } finally {
      http.request = originalHttpRequest;
      https.request = originalHttpsRequest;
    }
  });
});
