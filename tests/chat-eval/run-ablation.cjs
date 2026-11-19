'use strict';
// One-off ablation for the paper: same 30 questions, local evidence only vs local + MedlinePlus fallback.
// No external LLM in either condition. Labels are developer-written.
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
Object.assign(process.env, { RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'true' });
const { answer } = backend('./services/contextualChatService');
const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
const noWeb = async () => ({ status: 'DISABLED', passages: [] });
function outcome(result) {
  const mode = String(result.mode || ''); const reason = String(result.routing?.reasonCode || '');
  if (['SAFETY', 'EMERGENCY', 'CLINICAL_REFERRAL'].includes(mode) || /REFERRAL|EMERGENCY|PERSONAL/.test(reason)) return 'REFERRAL';
  if (mode === 'CLARIFY') return 'CLARIFY';
  if (mode === 'ABSTAIN' || /INSUFFICIENT|MISSING/.test(reason)) return 'NO_EVIDENCE';
  return (result.sources || []).length ? 'ANSWER' : 'NO_EVIDENCE';
}
(async () => {
  const out = {};
  for (const cond of ['LOCAL_ONLY', 'LOCAL_PLUS_MEDLINEPLUS']) {
    const rows = [];
    for (const item of set.questions) {
      const t0 = process.hrtime.bigint(); let result;
      try { result = await answer({ message: item.q, history: [] }, cond === 'LOCAL_ONLY' ? { webSearch: noWeb } : {}); } catch (e) { result = { mode: 'ERROR', reply: String(e.message) }; }
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const got = outcome(result);
      const contentOk = item.expect !== 'ANSWER' || !item.mustInclude || new RegExp(item.mustInclude, 'i').test(result.reply || '');
      const hosts = [...new Set((result.sources || []).map((s) => { try { return new URL(s.url).host; } catch { return s.kind || 'local'; } }))];
      rows.push({ id: item.id, q: item.q, expect: item.expect, got, mode: result.mode, reason: result.routing?.reasonCode, contentOk, ms: Math.round(ms), sources: (result.sources || []).length, hosts });
    }
    out[cond] = rows;
    console.log(`\n== ${cond}`); rows.forEach((r) => console.log(`${r.id}\t${r.expect}\t${r.got}\t${r.mode}\t${r.reason}\t${r.contentOk}\t${r.ms}ms\t${r.sources}\t${r.hosts.join(',')}`));
  }
  fs.writeFileSync('ablation.json', JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
