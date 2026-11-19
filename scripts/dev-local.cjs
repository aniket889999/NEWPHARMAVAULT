'use strict';
// One local project, two services. Never loads, displays or copies secret values.
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const children = []; let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => { for (const child of children) if (child.exitCode === null) child.kill('SIGKILL'); process.exit(code); }, 16000).unref();
  process.exitCode = code;
}
async function available(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer(); server.once('error', () => reject(new Error(`Port ${port} is already in use. Stop the previous local app before starting this project.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
async function main() {
  await available(5001); await available(5173);
  const publicChat = process.env.PHARMAVAULT_PUBLIC_CHAT === '1';
  const environment = { ...process.env, PORT: '5001', NODE_ENV: 'development', FRONTEND_URL: 'http://127.0.0.1:5173', CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5173,http://localhost:5173',
    TRUSTRAG_LLM_ENABLED: 'false', TRUSTRAG_LLM_EXPORT_ALLOWED: 'false', RAG_CHAT_LLM_ENABLED: String(publicChat), RAG_CHAT_PUBLIC_EXPORT_ALLOWED: String(publicChat), RAG_CHAT_EMBEDDINGS_ENABLED: String(publicChat), RAG_CHAT_EMBEDDING_MODEL: process.env.RAG_CHAT_EMBEDDING_MODEL || 'gemini-embedding-001',
    RAG_CHAT_WEB_SYNTHESIS_ALLOWED: String(publicChat), RAG_CHAT_ANSWER_STYLE: publicChat ? 'GROUNDED_PARAPHRASE' : 'EXTRACTIVE',
    // Public questions may use the fixed MedlinePlus (U.S. National Library of Medicine) health-topic search.
    // Only a registered topic term is sent: never the question, chat history or case data.
    RAG_CHAT_WEB_ENABLED: process.env.RAG_CHAT_WEB_ENABLED || 'true' };
  const backend = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'backend'), env: environment, stdio: 'inherit' }); children.push(backend);
  backend.once('exit', code => { if (!stopping) stop(code || 1); });
  let ready = false;
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    try { ready = (await fetch('http://127.0.0.1:5001/api/ready', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* bounded local readiness wait */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Backend not ready. Check backend/.env and your MongoDB service; no frontend was started.');
  const frontend = spawn(process.execPath, [path.join(root, 'scripts/start-frontend.mjs')],
    { cwd: root, env: { ...environment, VITE_API_URL: 'http://127.0.0.1:5001/api' }, stdio: 'inherit' }); children.push(frontend);
  frontend.once('exit', code => { if (!stopping) stop(code || 1); });
  console.log('PharmaVault: http://127.0.0.1:5173 — Evidence Chat and Verification Cases are in the same app.');
  console.log(publicChat
    ? 'Public hybrid RAG mode: at most one public embedding batch plus two generation/review calls per answer; configuration is not live verification. Private case/document export remains disabled. Stop with Ctrl+C.'
    : environment.RAG_CHAT_WEB_ENABLED === 'true'
    ? 'Official public-topic web lookup enabled; external AI and private-document export remain disabled. Stop both services with Ctrl+C.'
    : 'Local evidence-only mode: external AI/document export is disabled. Stop both services with Ctrl+C.');
}
process.once('SIGINT', () => stop()); process.once('SIGTERM', () => stop());
main().catch(error => { console.error(error.message); stop(1); });
