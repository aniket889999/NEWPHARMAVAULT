'use strict';
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
function loadClient(entry, options = {}) {
  const build = esbuild.buildSync({ entryPoints: [path.resolve(__dirname, '../../src/modules/verification', entry)],
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom', 'react-hot-toast', '../../../api/apiClient'],
    logLevel: 'silent', ...options });
  const loaded = new Module(path.join(__dirname, 'in-memory-client.cjs'), module);
  loaded.filename = path.join(__dirname, 'in-memory-client.cjs'); loaded.paths = module.paths;
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => name === '../../../api/apiClient' ? require('./transport-stub.cjs') : originalRequire(name);
  loaded._compile(build.outputFiles[0].text, loaded.filename); return loaded.exports;
}
// All HTTP imports stay external and are replaced at load time, without loading app credentials.
const apiAlias = {};
module.exports = { loadClient, apiAlias };
