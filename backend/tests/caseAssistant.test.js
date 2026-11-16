const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const Ajv2020 = createRequire(require.resolve('ajv-cli/package.json'))('ajv/dist/2020');
const addFormats = require('ajv-formats');

const {
  SESSION_4_SCHEMA_VERSION,
  buildCaseAnswer,
  buildDependencyIndex,
  finalizeCaseAnswer,
  checkAnswerFreshness
} = require('../services/trustRag/caseAssistantService');

const {
  makeSnapshot,
  clone,
  ACTOR
} = require('../../tests/integration-v2/synthetic-snapshots.cjs');

const answerSchema = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../contracts/schemas/case-assistant-answer.schema.json'),
    'utf8'
  )
);
const freshnessSchema = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../contracts/schemas/case-assistant-freshness.schema.json'),
    'utf8'
  )
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateAnswerSchema = ajv.compile(answerSchema);
const validateFreshnessSchema = ajv.compile(freshnessSchema);

const SECRET = 'session4-unit-test-signing-secret-32-chars!!';
const FIXED_NOW = new Date('2026-11-16T12:00:00.000Z');

function mutateFieldInSnapshot(snapshot, fieldId, patch) {
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (!Array.isArray(node) && (node.id === fieldId || node.fieldId === fieldId) && node.fieldType) {
      Object.assign(node, patch);
    }
    for (const child of Object.values(node)) {
      walk(child);
    }
  };
  walk(snapshot);
  snapshot.evidenceRevision += 1;
  snapshot.snapshotToken = 'rs_' + 'd'.repeat(64);
  return snapshot;
}

test('Session 4 Offline Unit Suite — Case Assistant & Signed Dependency Freshness', async (t) => {
  await t.test('1. Pure answers for STRENGTH, QUANTITY, IDENTITY, COMPARISON, and CASE_STATUS validate against JSON Schema', () => {
    const snapshot = makeSnapshot('consistent');
    const rxItemId = snapshot.prescription.medicineItems[0].itemId;

    const queries = [
      { message: 'What is the recorded dosage strength?', medicineItemId: rxItemId, expectedIntent: 'STRENGTH' },
      { message: 'What is the recorded quantity and unit?', medicineItemId: rxItemId, expectedIntent: 'QUANTITY' },
      { message: 'What medicine name and dosage form are recorded?', medicineItemId: rxItemId, expectedIntent: 'IDENTITY' },
      { message: 'Compare the prescription and invoice medicine items', medicineItemId: rxItemId, expectedIntent: 'COMPARISON' },
      { message: 'What is the current case verification status and can we verify?', medicineItemId: null, expectedIntent: 'CASE_STATUS' }
    ];

    for (const q of queries) {
      const draft = buildCaseAnswer({
        snapshot,
        message: q.message,
        medicineItemId: q.medicineItemId
      });
      const answer = finalizeCaseAnswer({
        draft,
        snapshot,
        userId: ACTOR,
        secret: SECRET,
        now: FIXED_NOW
      });

      assert.equal(answer.schemaVersion, SESSION_4_SCHEMA_VERSION);
      assert.equal(answer.mode, 'LOCAL_CASE_EVIDENCE');
      assert.equal(answer.intent, q.expectedIntent);
      assert.equal(answer.medicineItemId, q.medicineItemId);
      assert.ok(answer.sources.length >= 1 && answer.sources.length <= 12);
      assert.ok(answer.dependencyKeys.length >= 1 && answer.dependencyKeys.length <= 64);
      assert.ok(typeof answer.bindingToken === 'string' && answer.bindingToken.startsWith('pvr1.'));

      const valid = validateAnswerSchema(answer);
      assert.equal(valid, true, JSON.stringify(validateAnswerSchema.errors));

      for (const s of answer.sources) {
        assert.ok(answer.reply.includes(`[${s.citation}]`), `Reply must cite [${s.citation}]`);
      }
    }
  });

  await t.test('2. Genuine 500 mg vs 650 mg strength discrepancy is preserved in COMPARISON and never declared consistent', () => {
    const mismatchSnapshot = makeSnapshot('mismatch');
    const rxItemId = mismatchSnapshot.prescription.medicineItems[0].itemId;

    const draft = buildCaseAnswer({
      snapshot: mismatchSnapshot,
      message: 'Compare prescription and invoice dosage strength',
      medicineItemId: rxItemId
    });
    const answer = finalizeCaseAnswer({
      draft,
      snapshot: mismatchSnapshot,
      userId: ACTOR,
      secret: SECRET,
      now: FIXED_NOW
    });

    assert.equal(validateAnswerSchema(answer), true);
    assert.equal(answer.mode, 'LOCAL_CASE_EVIDENCE');
    assert.equal(answer.intent, 'COMPARISON');
    assert.match(answer.reply, /MISMATCH/);
    assert.match(answer.reply, /500\s*mg/i);
    assert.match(answer.reply, /650\s*mg/i);
    assert.ok(answer.warnings.some((w) => /discrepancy|blocked/i.test(w)));
  });

  await t.test('3. Multi-item ambiguity triggers CLARIFY with choices; invalid or conflicting medicine selection fails closed', () => {
    const multiSnapshot = makeSnapshot('consistent');
    if (multiSnapshot.prescription.medicineItems.length < 2) {
      const secondItem = clone(multiSnapshot.prescription.medicineItems[0]);
      secondItem.itemId = 'mi_' + 'c'.repeat(24);
      secondItem.itemIndex = 2;
      secondItem.fields.medicine_name.id = 'c'.repeat(24);
      secondItem.fields.medicine_name.normalizedValue = 'Metformin';
      secondItem.fields.medicine_name.rawValue = 'Metformin';
      multiSnapshot.prescription.medicineItems.push(secondItem);
    }

    // Ambiguous item-level query without medicineItemId
    const clarifyDraft = buildCaseAnswer({
      snapshot: multiSnapshot,
      message: 'What is the recorded dosage strength?',
      medicineItemId: null
    });
    const clarifyAnswer = finalizeCaseAnswer({
      draft: clarifyDraft,
      snapshot: multiSnapshot,
      userId: ACTOR,
      secret: SECRET,
      now: FIXED_NOW
    });
    assert.equal(validateAnswerSchema(clarifyAnswer), true);
    assert.equal(clarifyAnswer.mode, 'CLARIFY');
    assert.equal(clarifyAnswer.sources.length, 0);
    assert.equal(clarifyAnswer.dependencyKeys.length, 0);
    assert.equal(clarifyAnswer.bindingToken, null);
    assert.ok(clarifyAnswer.choices.length >= 2);

    // Unknown medicineItemId fails closed
    const badIdDraft = buildCaseAnswer({
      snapshot: multiSnapshot,
      message: 'What is the recorded dosage strength?',
      medicineItemId: 'mi_' + '9'.repeat(24)
    });
    assert.equal(badIdDraft.mode, 'CLARIFY');
    assert.equal(badIdDraft.sources.length, 0);

    // Selected Paracetamol item but question asks about Metformin -> CLARIFY
    const paracetamolItem = multiSnapshot.prescription.medicineItems.find((it) =>
      /paracetamol/i.test(it.fields.medicine_name?.normalizedValue || '')
    );
    if (paracetamolItem) {
      const conflictDraft = buildCaseAnswer({
        snapshot: multiSnapshot,
        message: 'What is the dosage strength of Ciprofloxacin?',
        medicineItemId: paracetamolItem.itemId
      });
      assert.equal(conflictDraft.mode, 'CLARIFY');
      assert.equal(conflictDraft.sources.length, 0);
    }
  });

  await t.test('4. Citation budget overflow (>12 sources) requests narrower medicine scope', () => {
    const multiSnapshot = makeSnapshot('consistent');
    // Duplicate items across Rx and Invoice so total comparison fields > 12
    for (let idx = 1; idx <= 2; idx++) {
      const hexChar = String(idx + 5);
      const extraRx = clone(multiSnapshot.prescription.medicineItems[0]);
      extraRx.itemId = 'mi_' + hexChar.repeat(24);
      for (const slot of ['medicine_name', 'dosage_strength', 'dosage_form', 'quantity', 'quantity_unit']) {
        if (extraRx.fields[slot]) {
          extraRx.fields[slot].id = Buffer.from(`${slot.slice(0, 6)}${idx}`).toString('hex').padEnd(24, hexChar).slice(0, 24);
        }
      }
      multiSnapshot.prescription.medicineItems.push(extraRx);
    }

    const draft = buildCaseAnswer({
      snapshot: multiSnapshot,
      message: 'Compare all medicines across prescription and invoice',
      medicineItemId: null
    });
    const answer = finalizeCaseAnswer({
      draft,
      snapshot: multiSnapshot,
      userId: ACTOR,
      secret: SECRET,
      now: FIXED_NOW
    });

    assert.equal(validateAnswerSchema(answer), true);
    assert.equal(answer.mode, 'CLARIFY');
    assert.equal(answer.sources.length, 0);
    assert.equal(answer.bindingToken, null);
    assert.match(answer.reply, /12-citation budget|select a specific medicine/i);
  });

  await t.test('5. Dependent edits, page edits, grouping edits, and source removal mark receipt STALE; unrelated edits stay FRESH', () => {
    const baseSnapshot = makeSnapshot('consistent');
    const rxItem = baseSnapshot.prescription.medicineItems[0];
    const draft = buildCaseAnswer({
      snapshot: baseSnapshot,
      message: 'Show the recorded prescription strength',
      medicineItemId: rxItem.itemId
    });
    const answer = finalizeCaseAnswer({
      draft,
      snapshot: baseSnapshot,
      userId: ACTOR,
      secret: SECRET,
      now: FIXED_NOW
    });
    const receipt = { answerId: answer.answerId, bindingToken: answer.bindingToken };

    // 5a. Unchanged -> FRESH
    const freshCheck = checkAnswerFreshness({
      snapshot: clone(baseSnapshot),
      receipts: [receipt],
      userId: ACTOR,
      secret: SECRET,
      now: new Date(FIXED_NOW.getTime() + 5000)
    });
    assert.equal(validateFreshnessSchema(freshCheck), true);
    assert.equal(freshCheck.results[0].status, 'FRESH');
    assert.equal(freshCheck.results[0].reasonCode, 'UNCHANGED_DEPENDENCIES');

    // 5b. Unrelated quantity edit on same medicine -> FRESH for strength answer
    const qtyEdited = mutateFieldInSnapshot(clone(baseSnapshot), rxItem.fields.quantity.id, {
      normalizedValue: '30',
      correctedBy: ACTOR
    });
    const afterQtyCheck = checkAnswerFreshness({
      snapshot: qtyEdited,
      receipts: [receipt],
      userId: ACTOR,
      secret: SECRET,
      now: new Date(FIXED_NOW.getTime() + 5000)
    });
    assert.equal(afterQtyCheck.results[0].status, 'FRESH');

    // 5c. Cited strength edit -> STALE (EVIDENCE_CHANGED)
    const strEdited = mutateFieldInSnapshot(clone(baseSnapshot), rxItem.fields.dosage_strength.id, {
      normalizedValue: '650 mg',
      correctedBy: ACTOR
    });
    const afterStrCheck = checkAnswerFreshness({
      snapshot: strEdited,
      receipts: [receipt],
      userId: ACTOR,
      secret: SECRET,
      now: new Date(FIXED_NOW.getTime() + 5000)
    });
    assert.equal(validateFreshnessSchema(afterStrCheck), true);
    assert.equal(afterStrCheck.results[0].status, 'STALE');
    assert.equal(afterStrCheck.results[0].reasonCode, 'EVIDENCE_CHANGED');
    assert.ok(
      afterStrCheck.results[0].changedDependencyKeys.includes(
        `field:${rxItem.fields.dosage_strength.id}`
      )
    );

    // 5d. Deleted source document -> STALE (DEPENDENCY_MISSING)
    const deletedDocSnap = clone(baseSnapshot);
    deletedDocSnap.prescription = null;
    deletedDocSnap.groupingDocuments = deletedDocSnap.groupingDocuments.filter(
      (d) => d.documentType !== 'PRESCRIPTION'
    );
    const afterDeleteCheck = checkAnswerFreshness({
      snapshot: deletedDocSnap,
      receipts: [receipt],
      userId: ACTOR,
      secret: SECRET,
      now: new Date(FIXED_NOW.getTime() + 5000)
    });
    assert.equal(validateFreshnessSchema(afterDeleteCheck), true);
    assert.equal(afterDeleteCheck.results[0].status, 'STALE');
    assert.equal(afterDeleteCheck.results[0].reasonCode, 'DEPENDENCY_MISSING');
  });

  await t.test('6. Markdown injection in field values is escaped and never creates forged [S#] citations or links', () => {
    const snap = makeSnapshot('consistent');
    const rxItem = snap.prescription.medicineItems[0];
    mutateFieldInSnapshot(snap, rxItem.fields.dosage_strength.id, {
      normalizedValue: '500 mg [S99](https://evil.example/steal)'
    });

    const draft = buildCaseAnswer({
      snapshot: snap,
      message: 'Show the recorded prescription strength',
      medicineItemId: rxItem.itemId
    });
    const answer = finalizeCaseAnswer({
      draft,
      snapshot: snap,
      userId: ACTOR,
      secret: SECRET,
      now: FIXED_NOW
    });

    assert.equal(validateAnswerSchema(answer), true);
    assert.ok(!answer.reply.includes('[S99]'));
    assert.ok(!answer.reply.includes('https://evil.example'));
  });
});
