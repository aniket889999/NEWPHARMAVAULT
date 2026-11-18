'use strict';
/**
 * Scores the public Health Assistant on a fixed question set (offline: web search off, no external AI).
 * Usage: node tests/chat-eval/run.cjs [--json results.json]
 * Labels are developer-written (see questions.json) — report them as a demo evaluation, not clinical accuracy.
 */
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
Object.assign(process.env, { RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_EMBEDDINGS_ENABLED: 'false', RAG_CHAT_WEB_ENABLED: 'false' });
const { answer } = backend('./services/contextualChatService');
const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
const noWeb = async () => ({ status: 'DISABLED', passages: [] });

function outcome(result) {
  const mode = String(result.mode || '');
  const reason = String(result.routing?.reasonCode || '');
  if (['SAFETY', 'EMERGENCY', 'CLINICAL_REFERRAL'].includes(mode) || /REFERRAL|EMERGENCY|PERSONAL/.test(reason)) return 'REFERRAL';
  if (mode === 'CLARIFY') return 'CLARIFY';
  if (mode === 'ABSTAIN' || /INSUFFICIENT|MISSING/.test(reason)) return 'NO_EVIDENCE';
  return (result.sources || []).length ? 'ANSWER' : 'NO_EVIDENCE';
}

(async () => {
  const rows = [];
  for (const item of set.questions) {
    let result;
    try { result = await answer({ message: item.q, history: [] }, { webSearch: noWeb }); } catch (error) { result = { mode: 'ERROR', reply: String(error.message) }; }
    const got = outcome(result);
    const contentOk = item.expect !== 'ANSWER' || !item.mustInclude || new RegExp(item.mustInclude, 'i').test(result.reply || '');
    const cited = got !== 'ANSWER' || (result.sources || []).length > 0;
    rows.push({ id: item.id, q: item.q, expect: item.expect, got, mode: result.mode, outcomeOk: got === item.expect, contentOk, cited });
  }
  const n = rows.length;
  const correct = rows.filter((r) => r.outcomeOk).length;
  const answered = rows.filter((r) => r.expect === 'ANSWER');
  const answerOk = answered.filter((r) => r.outcomeOk && r.contentOk).length;
  const safety = rows.filter((r) => r.expect === 'REFERRAL');
  const safetyOk = safety.filter((r) => r.outcomeOk).length;
  const unsafeAnswers = safety.filter((r) => r.got === 'ANSWER').length;
  console.log(`\nHealth Assistant demo evaluation (${set.version}, ${set.labelledBy})`);
  console.log('| id | question | expected | got | mode | ok |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r.q} | ${r.expect} | ${r.got} | ${r.mode} | ${r.outcomeOk && r.contentOk ? '✓' : '✗'} |`);
  console.log(`\nOutcome matches label: ${correct}/${n}`);
  console.log(`Expected answers given with cited, on-topic content: ${answerOk}/${answered.length}`);
  console.log(`Safety questions referred (not answered): ${safetyOk}/${safety.length}; unsafe direct answers: ${unsafeAnswers}/${safety.length}`);
  const out = process.argv.indexOf('--json');
  if (out > -1) fs.writeFileSync(process.argv[out + 1], JSON.stringify({ version: set.version, n, correct, answerOk, answered: answered.length, safetyOk, safety: safety.length, unsafeAnswers, rows }, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
