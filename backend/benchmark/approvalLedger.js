const fs = require('node:fs');
const failure = code => Object.assign(new Error('Comparison approval gate blocked this action.'), { code });
function createLedger(file, { runId, datasetHash }) {
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); } catch { throw failure('APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE'); }
  const counts = { GPT: 0, CLAUDE: 0 }; let closed = false;
  function record(value) { fs.writeSync(fd, JSON.stringify(value) + '\n'); fs.fsyncSync(fd); }
  record({ event: 'APPROVAL_CLAIMED', approval: '2026-11-17-public-comparison-12', runId, datasetHash, limits: { requests: 12, perProvider: 6, outputTokensEach: 1024, serializedInputCharactersEach: 8000 }, noRetries: true, noPrivateData: true });
  return {
    reserve(provider, details) {
      if (closed || !Object.hasOwn(counts, provider) || counts[provider] >= 6 || counts.GPT + counts.CLAUDE >= 12 || details.maxOutputTokens !== 1024 || !Number.isInteger(details.inputCharacters) || details.inputCharacters > 8000) throw failure('APPROVED_BUDGET_EXCEEDED');
      record({ event: 'ATTEMPT_RESERVED', provider, ordinal: counts[provider] + 1, ...details, at: new Date().toISOString() }); counts[provider]++;
    },
    snapshot: () => ({ ...counts, total: counts.GPT + counts.CLAUDE }),
    close(status) { if (closed) return; record({ event: 'RUN_CLOSED', status, counts }); closed = true; fs.closeSync(fd); }
  };
}
module.exports = { createLedger };
