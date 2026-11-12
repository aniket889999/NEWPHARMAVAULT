'use strict';
// Reproducible offline engineering evidence, never a clinical/research quality score.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function parseTestCounts(output, exitCode) {
  const counts = {};
  for (const name of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...output.matchAll(new RegExp('^# ' + name + ' (\\d+)\\s*$', 'gm'))];
    if (!matches.length) return { status: 'FAIL', counts: null, reason: 'Test summary missing; no score inferred.' };
    counts[name] = Number(matches[matches.length - 1][1]);
  }
  const complete = counts.tests === counts.pass + counts.fail + counts.cancelled + counts.skipped + counts.todo;
  const status = exitCode !== 0 || !counts.tests || !complete || counts.fail || counts.cancelled ? 'FAIL' : counts.skipped || counts.todo ? 'PARTIAL' : 'PASS';
  return { status, counts };
}
function runTests(label, files) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { label, scope: 'offline engineering acceptance', ...parseTestCounts(result.stdout || '', result.status), exitCode: result.status, error: result.error ? 'Test process did not finish normally.' : null };
}
function frozenFingerprints() {
  const failures = [];
  for (const file of ['docs/foundation-v2/SESSION_1_CONTRACT_FREEZE.json', 'docs/reconciliation-v2/SESSION_2_CONTRACT_FREEZE.json']) {
    const freeze = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    for (const [relative, expected] of Object.entries(freeze.reviewedSha256)) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
      if (actual !== expected) failures.push(relative);
    }
  }
  return { status: failures.length ? 'FAIL' : 'PASS', changedFiles: failures };
}
function main() {
  const groups = [
    runTests('Foundation', ['backend/tests/foundationMedicineItems.test.js', 'tests/foundation-v2/adapter.acceptance.test.cjs', 'tests/foundation-v2/manifest.test.cjs']),
    runTests('Medicine matching and quantities', ['backend/tests/medicineQuantity.test.js', 'backend/tests/medicineReconciliation.test.js', 'tests/reconciliation-v2/backend.acceptance.test.cjs', 'tests/reconciliation-v2/consumer.test.cjs']),
    runTests('Report integrity', ['tests/checkpoint-report.test.cjs']),
  ];
  const integrationPath = 'tests/integration-v2/consumer.acceptance.test.cjs';
  if (fs.existsSync(path.join(root, integrationPath))) groups.push(runTests('Session 3 client only — live integration pending', [integrationPath]));
  let fingerprints;
  try { fingerprints = frozenFingerprints(); } catch { fingerprints = { status: 'FAIL', changedFiles: [], error: 'Frozen evidence could not be checked.' }; }
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const report = { schemaVersion: 'checkpoint-evidence/1.0.0', generatedAt: new Date().toISOString(), commit: revision.status === 0 ? revision.stdout.trim() : null,
    scope: 'Offline checkpoint checks only; not a full-app build or product performance score.',
    status: fingerprints.status === 'PASS' && groups.every(group => group.status === 'PASS') ? 'PASS' : 'FAIL', groups, fingerprints,
    notEvaluated: ['Full-application release readiness', 'Session 3 live API/database and browser workflow', 'OCR or clinical accuracy', 'Held-out research performance', 'Research novelty percentage', 'Production deployment and FHIR/NHCX certification'] };
  const rows = groups.map(group => `| ${group.label} | ${group.status} | ${group.counts?.pass ?? 'unknown'} | ${group.counts?.fail ?? 'unknown'} | ${group.counts?.skipped ?? 'unknown'} |`);
  const summary = ['# Offline checkpoint evidence', '', report.scope, '', '| Group | Result | Passed | Failed | Skipped |', '|---|---|---:|---:|---:|', ...rows, '', `Frozen fingerprints: ${fingerprints.status}`, '', 'Live integration, clinical/OCR accuracy, held-out performance and production readiness remain unmeasured.', ''].join('\n');
  process.stdout.write('\n' + summary);
  const reportArgument = process.argv.find(arg => arg.startsWith('--report-dir='));
  if (reportArgument) {
    const directory = path.resolve(root, reportArgument.slice('--report-dir='.length));
    if (directory !== path.join(root, 'reports/checkpoints')) throw new Error('Use the dedicated reports/checkpoints output directory.');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(directory, 'summary.md'), summary);
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}
if (require.main === module) main();
module.exports = { parseTestCounts, frozenFingerprints };
