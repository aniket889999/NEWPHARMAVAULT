'use strict';
const fs = require('node:fs'), path = require('node:path');
const { validatePack, checkFreeze } = require('./evaluate-chatbot-reference.cjs');
const root = path.resolve(__dirname, '../docs/chatbot-reference-standard/v1');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
try {
  const counts = validatePack(read('benchmark.json'), read('source-catalog.json'), read('case-fixtures.json'));
  const freeze=read('freeze.json');checkFreeze(freeze,{referenceOnly:!process.argv.includes('--strict-baseline')});
  let baselineCandidateUnchanged=true;try{checkFreeze(freeze);}catch{baselineCandidateUnchanged=false;}
  console.log(JSON.stringify({ valid: true, ...counts, referenceFreezeIntact: true, baselineCandidateUnchanged, scope: 'ACADEMIC_REFERENCE_NOT_CLINICAL_CERTIFICATION' }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
