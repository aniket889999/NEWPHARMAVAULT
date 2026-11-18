const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { runComparison, canRun, reviewPacket } = require('../benchmark/runComparison');
const { createLedger } = require('../benchmark/approvalLedger');
const { datasetHash } = require('../benchmark/publicComparisonTasks');
const { loadPrivateConfig, inspect } = require('./checkBenchmarkConfig');
async function main() {
  const live = process.argv.includes('--live-approved');
  const root = path.resolve(__dirname, '../..'), folder = path.join(root, 'reports/checkpoints/provider-comparison');
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
  const config = live ? loadPrivateConfig() : null;
  if (live && !canRun(config)) { console.log(JSON.stringify({ status: 'BLOCKED_CONFIGURATION', requestsMade: 0, readiness: inspect(), instruction: 'Configure both keys/model IDs privately and enable BENCHMARK_LIVE_ALLOWED only after user budget approval.' })); process.exitCode = 2; return; }
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (fs.realpathSync(folder) !== folder) throw new Error('Output directory cannot contain symlinks.');
  const directory = path.join(folder, runId); fs.mkdirSync(directory, { mode: 0o700 });
  const journal = fs.openSync(path.join(directory, 'results.partial.local'), 'wx', 0o600);
  let budget, report;
  try {
    if (live) budget = createLedger(path.join(folder, 'approval-2026-11-17-public-12.local'), { runId, datasetHash });
    report = await runComparison({ live, config, budget, progress: value => console.log(JSON.stringify(value)), onRow: value => { fs.writeSync(journal, JSON.stringify(value) + '\n'); fs.fsyncSync(journal); } });
    budget?.close('COMPLETE_WITH_DISCLOSED_FAILURES');
  } catch {
    const attempts = budget?.snapshot() || { total: 0 }; budget?.close('STOPPED');
    console.log(JSON.stringify({ status: 'STOPPED', attempts, reportDirectory: directory, noRetries: true, instruction: 'Completed rows remain in results.partial.local. Inspect the private approval ledger before any further request. No fresh budget is implied by restarting.' })); process.exitCode = 1; return;
  } finally { fs.closeSync(journal); }
  const { packet, mapping } = reviewPacket(report, runId);
  for (const [name, value] of Object.entries({ 'report.json': report, 'blinded-review.json': packet, 'private-unblinding.local': mapping })) fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: live ? 'PILOT_COMPLETE_REVIEW_PENDING' : 'OFFLINE_PLAN_ONLY', reportDirectory: directory, requests: report.attempts, summary: report.summary, superiorityEstablished: false, next: live ? 'Independent blinded review; this pilot alone cannot prove superiority.' : 'Configure credentials and obtain bounded approval before --live-approved.' }, null, 2));
}
if (require.main === module) main().catch(() => { console.error('Comparison setup failed without publishing credential values. No automatic retry.'); process.exitCode = 1; });
module.exports = { main };
