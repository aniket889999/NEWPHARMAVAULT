'use strict';

/**
 * Visible development fixture format validation only.
 * Does NOT execute or prove chatbot routing/runtime correctness.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURE_PATH = path.join(__dirname, 'gemini-routing-cases.json');

const VALID_OUTCOMES = new Set([
  'REFUSE',
  'COVERAGE_GAP',
  'SUPPORTED',
  'CLINICAL_REFERRAL',
  'URGENT'
]);

const EXPECTED_CATEGORY_COUNTS = {
  SECURITY_AND_PRIVACY_REFUSAL: { count: 4, outcome: 'REFUSE' },
  UNSUPPORTED_MEDICINE_COVERAGE_GAP: { count: 4, outcome: 'COVERAGE_GAP' },
  SUPPORTED_SINGLE_DETAIL_AND_FOLLOWUP: { count: 4, outcome: 'SUPPORTED' },
  PERSONAL_TREATMENT_CLINICAL_REFERRAL: { count: 2, outcome: 'CLINICAL_REFERRAL' },
  EMERGENCY_SAFETY_ESCALATION: { count: 2, outcome: 'URGENT' }
};

test('Task G1 development routing fixture pack structure and bounds', async (t) => {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const cases = JSON.parse(raw);

  await t.test('1. Contains exactly 16 fixture objects with unique IDs and exact top-level keys', () => {
    assert.equal(Array.isArray(cases), true, 'Fixture root must be a JSON array');
    assert.equal(cases.length, 16, 'Fixture pack must contain exactly 16 test cases');

    const seenIds = new Set();
    for (const item of cases) {
      assert.equal(Boolean(item && typeof item === 'object' && !Array.isArray(item)), true);
      assert.deepEqual(
        Object.keys(item).sort(),
        ['category', 'expected', 'history', 'id', 'message'],
        `Fixture ${item.id} must have exact required keys`
      );
      assert.equal(typeof item.id, 'string');
      assert.match(item.id, /^g1-[a-z]+-\d{2}$/);
      assert.equal(seenIds.has(item.id), false, `Duplicate fixture ID: ${item.id}`);
      seenIds.add(item.id);
    }
  });

  await t.test('2. Enforces bounded message and user-history lengths and valid outcomes', () => {
    for (const item of cases) {
      assert.equal(typeof item.message, 'string');
      const trimmedMsg = item.message.trim();
      assert.ok(
        trimmedMsg.length >= 1 && trimmedMsg.length <= 500,
        `Fixture ${item.id} message must be 1..500 chars`
      );

      assert.equal(Array.isArray(item.history), true, `Fixture ${item.id} history must be an array`);
      assert.ok(
        item.history.length >= 1 && item.history.length <= 10,
        `Fixture ${item.id} history must contain 1..10 turns`
      );

      for (const turn of item.history) {
        assert.equal(Boolean(turn && typeof turn === 'object' && !Array.isArray(turn)), true);
        assert.deepEqual(Object.keys(turn).sort(), ['role', 'text']);
        assert.equal(turn.role, 'user', `Fixture ${item.id} history turns must have role:"user"`);
        assert.equal(typeof turn.text, 'string');
        const trimmedTurn = turn.text.trim();
        assert.ok(
          trimmedTurn.length >= 1 && trimmedTurn.length <= 500,
          `Fixture ${item.id} history text must be 1..500 chars`
        );
      }

      assert.equal(
        Boolean(item.expected && typeof item.expected === 'object' && !Array.isArray(item.expected)),
        true
      );
      assert.deepEqual(Object.keys(item.expected), ['outcome']);
      assert.equal(
        VALID_OUTCOMES.has(item.expected.outcome),
        true,
        `Invalid outcome ${item.expected.outcome} in ${item.id}`
      );
    }
  });

  await t.test('3. Matches exact category distribution (4 refuse, 4 gap, 4 supported, 2 clinical, 2 urgent) and synthetic content rules', () => {
    const observedCounts = {};
    for (const item of cases) {
      const spec = EXPECTED_CATEGORY_COUNTS[item.category];
      assert.ok(spec, `Unexpected category: ${item.category}`);
      assert.equal(
        item.expected.outcome,
        spec.outcome,
        `Category ${item.category} must map to outcome ${spec.outcome}`
      );
      observedCounts[item.category] = (observedCounts[item.category] || 0) + 1;

      // Synthetic input hygiene: no dose numbers (e.g. 500mg) or patient identifiers
      const combined = `${item.message} ${item.history.map((h) => h.text).join(' ')}`;
      assert.equal(
        /\b\d+\s*(?:mg|mcg|ml|g|iu)\b/i.test(combined),
        false,
        `Fixture ${item.id} must not include specific dose quantities`
      );
    }

    for (const [category, spec] of Object.entries(EXPECTED_CATEGORY_COUNTS)) {
      assert.equal(
        observedCounts[category] || 0,
        spec.count,
        `Expected ${spec.count} fixtures for ${category}`
      );
    }
  });
});
