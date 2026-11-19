'use strict';
const registry = require('../data/chatTopicRegistry');
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
// Recognition only. The grouping in the vocabulary is not an assertion of
// product composition, strength, dosage form, substitution or suitability.
function findBrandMentions(message) {
  const padded = ' ' + normalize(message) + ' ';
  return [...new Set(registry.flatMap(value => value.brandAliases).filter(alias => padded.includes(' ' + normalize(alias) + ' ')))];
}
module.exports = { findBrandMentions };
