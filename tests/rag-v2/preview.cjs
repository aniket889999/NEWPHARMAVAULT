'use strict';
// Manual visual QA only: static authored component states, never a live API claim.
if (process.argv[2] !== '--synthetic-ui-preview') throw new Error('Explicit synthetic-ui-preview opt-in required.');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), readline = require('node:readline');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { loadClient } = require('./load-client.cjs'), fixtures = require('./client-fixtures.cjs');
const { default: ChatMessage } = loadClient('src/components/chat/ChatMessage.tsx');
const { toChatResponse } = loadClient('src/features/caseAssistant/toChatResponse.ts');
const assets = path.resolve(__dirname, '../../dist/assets');
const css = fs.readFileSync(path.join(assets, fs.readdirSync(assets).find(file => /^index-.*\.css$/.test(file))), 'utf8');
const old = fixtures.answer(); old.reply = 'The earlier OCR extraction recorded Paracetamol 500 mg. [S1]'; old.sources[0].excerpt = 'SYNTHETIC earlier OCR value: 500 mg';
const current = fixtures.answer(); current.answerId = '22222222-2222-4222-8222-222222222222'; current.reply = 'After source inspection, the corrected prescription extraction records Paracetamol 650 mg. [S1]';
const message = (a, status) => ({ id: a.answerId, role: 'assistant', content: a.reply, timestamp: new Date(a.generatedAt), deliveryStatus: 'complete',
  rag: toChatResponse(a), freshness: { status, checkedAt: '2026-11-16T12:15:00.000Z', reasonCode: null, changedDependencyKeys: [] } });
const body = renderToStaticMarkup(React.createElement('main', { className: 'mx-auto max-w-4xl p-6 space-y-6 bg-white' },
  React.createElement('header', { className: 'rounded-xl border border-amber-300 bg-amber-50 p-4' },
    React.createElement('h1', { className: 'text-xl font-bold text-slate-900' }, 'PharmaVault · Correction-aware evidence chat'),
    React.createElement('p', { className: 'mt-2 text-sm text-amber-950' }, 'SYNTHETIC COMPONENT PREVIEW — not a live backend test. Static controls are unavailable.')),
  React.createElement('p', { className: 'rounded-xl bg-slate-100 p-4 text-sm' }, 'Reviewer: What strength is recorded in this prescription?'),
  React.createElement(ChatMessage, { message: message(old, 'STALE'), busy: true, onCheckEvidence() {}, onAskAgain() {} }),
  React.createElement('p', { className: 'rounded-xl bg-slate-100 p-4 text-sm' }, 'Reviewer inspected the original source and corrected an OCR extraction. Previous answer retained below the same question history.'),
  React.createElement(ChatMessage, { message: message(current, 'FRESH'), busy: true, onCheckEvidence() {}, onAskAgain() {} }),
  React.createElement('footer', { className: 'border-t pt-4 text-xs text-slate-500' }, 'Local private-document evidence · Exact source citations · Human review remains accountable · No treatment or claim approval')
));
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PharmaVault synthetic client preview</title><style>' + css + '</style></head><body class="bg-slate-50">' + body + '</body></html>';
const server = http.createServer((req, res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
let closing = false;
function cleanup() { if (closing) return; closing = true; server.closeAllConnections(); server.close(() => { console.log('Synthetic UI preview stopped; no database or accounts were created.'); process.exit(0); }); }
server.listen(5176, '127.0.0.1', () => console.log('Static synthetic preview ready: http://127.0.0.1:5176'));
readline.createInterface({ input: process.stdin }).on('line', line => { if (line.trim() === 'cleanup') cleanup(); });
process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
