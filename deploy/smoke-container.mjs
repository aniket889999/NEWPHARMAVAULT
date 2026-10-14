import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const image = `pharmavault-u2-smoke:${Date.now()}`;
let built = false;

function run(args, { quiet = false, timeout = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { cwd: projectRoot, stdio: quiet ? 'ignore' : 'inherit' });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Docker check timed out.')); }, timeout);
    child.once('error', () => { clearTimeout(timer); reject(new Error('Docker command is unavailable.')); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Docker command failed.')); });
  });
}

try {
  try { await run(['info', '--format', '{{.ServerVersion}}'], { quiet: true, timeout: 15000 }); }
  catch { console.error('Container check is blocked: start Docker Desktop, then rerun this script.'); process.exit(2); }

  await run(['build', '-t', image, './backend']);
  built = true;
  await run([
    'run', '--rm', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
    '--tmpfs', '/var/lib/pharmavault/documents:rw,noexec,nosuid,size=64m,mode=0700,uid=1000,gid=1000',
    '-e', 'NODE_ENV=production', '-e', 'SMOKE_CONTAINER=true',
    '-e', 'MONGO_URI=mongodb://127.0.0.1:27017/pharmavault_smoke_test',
    '-e', 'JWT_SECRET=synthetic-container-only-secret-at-least-32-characters',
    '-e', 'GEMINI_API_KEY=synthetic-container-only-key',
    '-e', 'CORS_ALLOWED_ORIGINS=https://smoke.example',
    '-e', 'DOCUMENT_STORAGE_ROOT=/var/lib/pharmavault/documents',
    '-e', 'TRUSTRAG_LLM_ENABLED=false', '-e', 'TRUSTRAG_LLM_EXPORT_ALLOWED=false',
    image, 'node', 'scripts/productionSmoke.js'
  ], { timeout: 60000 });
} catch {
  console.error('Container build/runtime smoke failed; inspect the output above.');
  process.exitCode = 1;
} finally {
  // Remove only the uniquely named smoke image created by this invocation.
  if (built) await run(['image', 'rm', image], { quiet: true, timeout: 15000 }).catch(() => {});
}
