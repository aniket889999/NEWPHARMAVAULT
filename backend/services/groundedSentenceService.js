'use strict';
// Deliberately stricter than a semantic/NLI guess: model output may only select
// complete cited source sentences. Valid paraphrases can be rejected. This is
// textual support, not proof of source truth, completeness or clinical safety.
const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const normalize = text => String(text).normalize('NFKC').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
function sentences(text) {
  return [...segmenter.segment(normalize(text))].map(value => value.segment.trim()).filter(value => /[.!?]["']?$/.test(value));
}
function assertSentenceSupport(paragraph, passages, support) {
  if (!paragraph || typeof paragraph.text !== 'string' || !Array.isArray(paragraph.ids) || !paragraph.ids.length) throw new Error('Missing sentence support.');
  const cited = passages.filter(source => paragraph.ids.includes(source.id));
  if (new Set(cited.map(value => value.id)).size !== new Set(paragraph.ids).size) throw new Error('Unknown cited sentence source.');
  const permitted = new Set();
  const bySource = new Map();
  for (const source of cited) {
    const sourceSentences = new Set();
    const quotes = support?.filter(value => value.sourceId === source.id).map(value => normalize(value.quote));
    for (const sentence of sentences(source.excerpt)) {
      if (!support || quotes.some(quote => quote.includes(normalize(sentence)))) { permitted.add(normalize(sentence)); sourceSentences.add(normalize(sentence)); }
    }
    bySource.set(source.id, sourceSentences);
  }
  const output = sentences(paragraph.text);
  // Also reject trailing incomplete/fabricated text that sentence extraction
  // would otherwise omit. Require all normalized text to be accounted for.
  if (!output.length || normalize(output.join(' ')) !== normalize(paragraph.text) || output.some(sentence => !permitted.has(normalize(sentence)))) throw new Error('Generated claim is not a complete cited source sentence.');
  if (cited.some(source => !output.some(sentence => bySource.get(source.id).has(normalize(sentence))))) throw new Error('A cited source does not support any output sentence.');
  return paragraph;
}
module.exports = { assertSentenceSupport, sentences };
