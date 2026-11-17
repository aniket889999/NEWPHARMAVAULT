// Isolated static-web image check. No published port, database, provider call,
// real document, credential or volume. This is not a full HTTPS deployment test.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const suffix = randomUUID().slice(0, 12), image = `pharmavault-web-smoke:${suffix}`, container = `pharmavault-web-smoke-${suffix}`;
let built = false, started = false, stage = 'ENGINE', proofHeaders = '';
function run(args, { quiet = false, capture = false, timeout = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { cwd: root, stdio: capture ? ['ignore', 'pipe', 'pipe'] : quiet ? 'ignore' : 'inherit' });
    let stdout = '', stderr = '';
    child.stdout?.on('data', data => { stdout += data; }); child.stderr?.on('data', data => { stderr += data; });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Container check timed out.')); }, timeout);
    child.once('error', () => { clearTimeout(timer); reject(new Error('Docker is unavailable.')); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve({ stdout, stderr }) : reject(new Error('Container check failed.')); });
  });
}
try {
  await run(['info', '--format', '{{.ServerVersion}}'], { quiet: true, timeout: 15000 });
  stage = 'BUILD';
  await run(['build', '-f', 'deploy/web.Dockerfile', '-t', image, '.']); built = true;
  stage = 'START';
  await run(['run', '--detach', '--name', container, '--network', 'none', '--add-host', 'api:127.0.0.1', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--tmpfs', '/tmp:rw,nosuid,noexec,size=32m,mode=1777', '--pids-limit', '64', '--memory', '128m', image], { quiet: true }); started = true;
  stage = 'HEALTH';
  let ready = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    try { const value = await run(['exec', container, 'wget', '-q', '-O', '-', 'http://127.0.0.1:8080/healthz'], { capture: true, timeout: 5000 }); if (value.stdout.trim() === 'OK') { ready = true; break; } } catch { /* Bounded container startup, not a provider retry. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Web container must become healthy.');
  stage = 'HEADERS';
  const page = await run(['exec', container, 'wget', '-S', '-O', '-', 'http://127.0.0.1:8080/assistant'], { capture: true, timeout: 5000 });
  proofHeaders = page.stderr;
  assert.match(page.stdout, /PharmaVault/); assert.match(page.stdout, /<script type="module"/);
  assert.match(page.stderr, /Content-Security-Policy:.*connect-src 'self'/i); assert.match(page.stderr, /frame-ancestors 'none'/); assert.match(page.stderr, /Cache-Control: no-store/i); assert.match(page.stderr, /X-Content-Type-Options: nosniff/i);
  assert.doesNotMatch(page.stdout, /fonts\.googleapis|fonts\.gstatic|VITE_GEMINI_API_KEY/);
  console.log(JSON.stringify({ smoke: 'PASS', staticSpaRouting: 'PASS', responseHeaders: 'PASS', unprivilegedReadOnlyRuntime: 'PASS', publishedPorts: false, containerNetwork: 'none', databaseConnected: false, externalLlmCalled: false, fullHttpsApiIntegration: 'NOT_TESTED' }));
} catch {
  console.error(`Web container check did not pass at ${stage}. No deployment approval was generated.`);
  // This isolated container receives no credentials, public requests or patient
  // data. Only its startup log / synthetic static response headers are inspected.
  if (proofHeaders) console.error(proofHeaders.slice(0, 3000));
  if (started) { const logs = await run(['logs', '--tail', '20', container], { capture: true, timeout: 5000 }).catch(() => null); if (logs) console.error((logs.stdout + logs.stderr).slice(0, 3000)); }
  process.exitCode = 1;
}
finally {
  if (started) await run(['stop', '--time', '3', container], { quiet: true, timeout: 10000 }).catch(() => {});
  if (started) await run(['rm', container], { quiet: true, timeout: 10000 }).catch(() => {});
  if (built) await run(['image', 'rm', image], { quiet: true, timeout: 15000 }).catch(() => {});
}
