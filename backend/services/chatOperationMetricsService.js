'use strict';
// Aggregate server measurements only: never messages, identities, source IDs,
// credentials, raw errors, URLs or per-patient labels. Exposed to super-admins.
const MODES = new Set(['ABSTAIN', 'SAFETY', 'CLARIFY', 'CONVERSATIONAL_HELP', 'LOCAL_EXTRACTIVE', 'LOCAL_CASE_EVIDENCE', 'PRECISE_LOCAL_EVIDENCE', 'PRECISE_WEB_EVIDENCE', 'GEMINI_RAG']);
function createChatMetrics({ now = () => performance.now() } = {}) {
  let total = 0, failed = 0, cancelled = 0;
  const modes = {}, buckets = [0, 0, 0, 0, 0];
  function begin() {
    const started = now(); let finished = false;
    return (result, outcome = 'SUCCESS') => {
      if (finished) return; finished = true; total++;
      if (outcome === 'CANCELLED') cancelled++; else if (outcome !== 'SUCCESS') failed++;
      const mode = MODES.has(result?.mode) ? result.mode : 'OTHER'; modes[mode] = (modes[mode] || 0) + 1;
      const elapsed = Math.max(0, now() - started);
      buckets[elapsed <= 100 ? 0 : elapsed <= 500 ? 1 : elapsed <= 2000 ? 2 : elapsed <= 10000 ? 3 : 4]++;
    };
  }
  const snapshot = () => ({ scope: 'PROCESS_LOCAL_METADATA_ONLY', total, failed, cancelled, modes: { ...modes },
    latencyBucketsMs: { le100: buckets[0], le500: buckets[1], le2000: buckets[2], le10000: buckets[3], over10000: buckets[4] } });
  return { begin, snapshot };
}
const chatMetrics = createChatMetrics();
module.exports = { createChatMetrics, chatMetrics };
