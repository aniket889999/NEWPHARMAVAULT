'use strict';
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
function loadClient(entry) {
  const build = esbuild.buildSync({ entryPoints: [path.resolve(__dirname, '../../', entry)],
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/server'], logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': '"http://synthetic.invalid/api"' } });
  const loaded = new Module(path.join(__dirname, 'in-memory-client.cjs'), module);
  loaded.filename = path.join(__dirname, 'in-memory-client.cjs'); loaded.paths = module.paths;
  loaded._compile(build.outputFiles[0].text, loaded.filename);
  return loaded.exports;
}
module.exports = { loadClient };
