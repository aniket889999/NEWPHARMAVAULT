// Synthetic runtime smoke test. No MongoDB connection, real secret, document,
// external LLM call or Tesseract language-data download is used.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const { validateEnv } = require('../config/envValidator');
const { getDocumentStorageRoot } = require('../config/documentStorage');

function syntheticPdf() {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << >> >>\nendobj\n'
  ];
  let content = '%PDF-1.4\n';
  const offsets = [];
  for (const object of objects) { offsets.push(Buffer.byteLength(content)); content += object; }
  const xref = Buffer.byteLength(content);
  content += 'xref\n0 4\n0000000000 65535 f \n' + offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  content += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}

async function main() {
  validateEnv();
  const catalogue = require('../data/academicMedicineCatalogue').ACADEMIC_MEDICINE_CATALOGUE;
  assert.ok(Array.isArray(catalogue) && catalogue.length >= 15);
  require('../services/trustRag/identityResolutionService');
  assert.equal(process.env.TRUSTRAG_LLM_ENABLED, 'false');
  assert.equal(process.env.TRUSTRAG_LLM_EXPORT_ALLOWED, 'false');
  assert.ok(fs.existsSync(getDocumentStorageRoot()));
  if (process.env.SMOKE_CONTAINER === 'true') {
    assert.equal(fs.existsSync('/app/.env'), false);
    assert.equal(fs.existsSync('/app/.env.production'), false);
    assert.equal(fs.existsSync('/app/eng.traineddata'), false);
  }

  const app = require('../app');
  const server = http.createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${url}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('x-powered-by'), null);
    assert.equal(health.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal((await fetch(`${url}/api/v1/cases`)).status, 401);
    assert.equal((await fetch(`${url}/api/chat/vision-ocr`, { method: 'POST' })).status, 404);
    const injection = await fetch(`${url}/api/users/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: { $ne: null } })
    });
    assert.equal(injection.status, 400);

    const Provider = require('../services/trustRag/nodePdfRendererProvider');
    const provider = new Provider();
    const pdf = syntheticPdf();
    assert.equal(await provider.getPageCount(pdf), 1);
    const png = await provider.renderPage(pdf, 1);
    assert.equal(png.readUInt32BE(0), 0x89504e47);
    console.log(JSON.stringify({
      smoke: 'PASS', runtime: process.version, catalogueRecords: catalogue.length,
      httpBoundary: 'PASS', realPdfRenderer: 'PASS', databaseConnected: false,
      externalLlmCalled: false, ocrAccuracyMeasured: false
    }));
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
  }
}

const timeout = setTimeout(() => { console.error('Production runtime smoke timed out.'); process.exit(1); }, 20000);
main().catch(() => { console.error('Production runtime smoke failed.'); process.exitCode = 1; }).finally(() => clearTimeout(timeout));
