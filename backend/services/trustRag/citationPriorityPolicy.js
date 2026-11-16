'use strict';

const CITATION_POLICY = 'attribute-balanced/1.0.0';
const SLOTS = ['medicine_name', 'dosage_strength', 'dosage_form', 'release_type', 'quantity', 'quantity_unit', 'pack_size', 'pack_unit'];
const LABELS = Object.fromEntries(SLOTS.map(slot => [slot.replaceAll('_', ' '), slot]));
const SOURCE_TITLE = /^(Prescription|Pharmacy Invoice) (medicine name|dosage strength|dosage form|release type|quantity|quantity unit|pack size|pack unit) \(page ([1-9][0-9]*)\)$/;
const ID = /^[a-f0-9]{24}$/;

function requestedSourceSlots(message, intent) {
  const text = typeof message === 'string' ? message.slice(0, 2000) : '';
  const preferred = [];
  const add = (...slots) => { for (const slot of slots) if (!preferred.includes(slot)) preferred.push(slot); };
  if (intent === 'STRENGTH' || /\b(strengths?|concentrations?|potency|mg)\b/i.test(text)) add('dosage_strength');
  if (/\bpack\s+size\b/i.test(text)) add('pack_size', 'pack_unit');
  if (intent === 'QUANTITY' || /\b(quantit(?:y|ies)|qty|counts?|units?|packs?|strips?)\b/i.test(text)) add('quantity', 'quantity_unit', 'pack_size', 'pack_unit');
  if (/\b(dosage forms?|tablet or capsule|forms?)\b/i.test(text)) add('dosage_form');
  if (/\brelease(?:\s+type)?\b/i.test(text)) add('release_type');
  if (intent === 'IDENTITY' || /\b(identity|names?|brands?|generics?)\b/i.test(text)) add('medicine_name');
  add('medicine_name', 'dosage_strength', 'quantity', 'quantity_unit', 'dosage_form', 'release_type', 'pack_size', 'pack_unit');
  return preferred;
}

function sourceMetadata(source, originalIndex) {
  if (!source || typeof source !== 'object' || !ID.test(source.documentId || '') || !ID.test(source.fieldId || '') || source.sourceId !== 'field:' + source.fieldId) return null;
  const match = typeof source.title === 'string' && SOURCE_TITLE.exec(source.title);
  if (!match || Number(match[3]) !== source.pageNumber) return null;
  return { source, originalIndex, slot: LABELS[match[2]], documentOrder: match[1] === 'Prescription' ? 0 : 1 };
}

function validateCitations(answer) {
  const ids = new Set(), citations = new Set();
  for (const [index, source] of answer.sources.entries()) {
    if (source.citation !== 'S' + (index + 1) || ids.has(source.sourceId) || citations.has(source.citation) || !answer.reply.includes('[' + source.citation + ']')) throw new Error('Invalid internal citation topology.');
    ids.add(source.sourceId); citations.add(source.citation);
  }
  for (const match of answer.reply.matchAll(/\[S([0-9]+)\]/g)) {
    if (!citations.has('S' + match[1])) throw new Error('Invalid internal citation topology.');
  }
}

function prioritizeCaseAnswerSources({ answer, message }) {
  if (!answer || answer.mode !== 'LOCAL_CASE_EVIDENCE' || answer.intent === 'CASE_STATUS') return answer;
  if (!Array.isArray(answer.sources) || answer.sources.length < 1 || answer.sources.length > 12 || typeof answer.reply !== 'string') throw new Error('Invalid internal answer shape.');
  validateCitations(answer);
  const metadata = answer.sources.map(sourceMetadata);
  // The server's controlled source labels are required. Never guess from an excerpt.
  if (metadata.some(source => source === null) || metadata.length < 2) return answer;
  const ordered = [];
  for (const slot of requestedSourceSlots(message, answer.intent)) {
    const docs = new Map();
    for (const entry of metadata.filter(source => source.slot === slot)) {
      if (!docs.has(entry.source.documentId)) docs.set(entry.source.documentId, []);
      docs.get(entry.source.documentId).push(entry);
    }
    const groups = [...docs.values()].sort((a, b) => a[0].documentOrder - b[0].documentOrder || a[0].originalIndex - b[0].originalIndex);
    const count = Math.max(0, ...groups.map(group => group.length));
    for (let round = 0; round < count; round++) for (const group of groups) if (group[round]) ordered.push(group[round].source);
  }
  if (ordered.length !== answer.sources.length) throw new Error('Incomplete internal citation priority.');
  const mapping = new Map(ordered.map((source, index) => [source.citation, 'S' + (index + 1)]));
  // Single pass: replacing S1 can never accidentally replace the new label again.
  const reply = answer.reply.replace(/\[S([0-9]+)\]/g, (_, number) => '[' + mapping.get('S' + number) + ']');
  const result = { ...answer, reply, sources: ordered.map((source, index) => ({ ...source, citation: 'S' + (index + 1) })) };
  validateCitations(result);
  return result;
}

module.exports = { CITATION_POLICY, requestedSourceSlots, prioritizeCaseAnswerSources };
