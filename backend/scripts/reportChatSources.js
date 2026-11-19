'use strict';
// Read-only public source inventory. No model, database, chat or secret access.
const { references } = require('../services/chatReferenceRegistry');
const { contentHash, evaluateSource, sourceSummary } = require('../services/chatSourceGovernanceService');
const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && args[0] === '--summary')) {
  console.log(JSON.stringify(sourceSummary(references), null, 2));
} else if (args.length === 2 && args[0] === '--source') {
  const source = references.find(value => value.key === args[1]);
  if (!source) { console.error('Source key not found in the bundled public registry.'); process.exitCode = 1; }
  else console.log(JSON.stringify({ key: source.key, sourceId: source.id, title: source.title, sourceUrl: source.sourceUrl || null,
    version: source.version, contentHash: contentHash(source), review: evaluateSource(source) }, null, 2));
} else { console.error('Usage: node backend/scripts/reportChatSources.js [--summary | --source <registered-key>]'); process.exitCode = 1; }
