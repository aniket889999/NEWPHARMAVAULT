// Keep local dev cache outside source/private data. Mirrors vite.config.ts.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmavault-local-cache-'));
let server; let closing = false;
async function close() {
  if (closing) return; closing = true;
  if (server) await server.close();
  if (path.dirname(cache) !== os.tmpdir() || !path.basename(cache).startsWith('pharmavault-local-cache-')) throw new Error('Invalid cache target.');
  fs.rmSync(cache, { recursive: true, force: true });
}
process.once('SIGINT', () => close().then(() => process.exit(0)));
process.once('SIGTERM', () => close().then(() => process.exit(0)));
try {
  server = await createServer({ root, configFile: false, cacheDir: cache, plugins: [react()], optimizeDeps: { exclude: ['lucide-react'] },
    server: { host: '127.0.0.1', port: 5173, strictPort: true } });
  await server.listen(); server.printUrls();
} catch {
  console.error('Local frontend could not start. Check installed frontend dependencies and port 5173.');
  await close(); process.exitCode = 1;
}
