'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
test('release typecheck names both actual projects, not the empty root project', () => {
  const script = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts['check:ts'];
  assert.match(script, /tsc --noEmit -p tsconfig\.app\.json/);
  assert.match(script, /&& tsc --noEmit -p tsconfig\.node\.json/);
  assert.doesNotMatch(script, /\|\||--noCheck|--strict\s+false/);
});
for (const file of ['tsconfig.app.json', 'tsconfig.node.json']) test(file + ' retains strict and unused-code checks', () => {
  const config = ts.readConfigFile(path.join(root, file), ts.sys.readFile);
  assert.ifError(config.error);
  for (const key of ['strict', 'noUnusedLocals', 'noUnusedParameters', 'noFallthroughCasesInSwitch', 'noEmit']) assert.equal(config.config.compilerOptions[key], true, key);
});
