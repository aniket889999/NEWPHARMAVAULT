'use strict';
// Two registered generics absent from the NHS index. This is product-specific
// US labelling evidence, never an Indian approval/equivalence assertion.
const { isDosePassage } = require('./approvedMedicineSearchService');
const subjects = Object.freeze({ ondansetron: ['ONDANSETRON', 'ONDANSETRON HYDROCHLORIDE'], telmisartan: ['TELMISARTAN'] });
const attributes = { GENERAL: ['indications_and_usage', 'description'], USES: ['indications_and_usage'], SIDE_EFFECTS: ['adverse_reactions', 'warnings_and_cautions'],
  MECHANISM: ['mechanism_of_action', 'clinical_pharmacology'], STORAGE: ['storage_and_handling', 'how_supplied'], PREVENTION: ['indications_and_usage'], SPECIFIC_FACT: ['indications_and_usage', 'adverse_reactions', 'warnings_and_cautions'] };
const origin = new WeakMap();
function hasFdaCandidateProvenance(value) {
  const canonical = value && origin.get(value);
  return Boolean(canonical && canonical.until > Date.now() && ['topicId', 'attribute', 'title', 'sourceUrl', 'excerpt', 'fetchedAt', 'publisher', 'jurisdiction', 'reviewStatus'].every(key => canonical[key] === value[key]));
}
function mark(values) { return values.map(value => { const copy = { ...value }; origin.set(copy, { ...copy, until: Date.now() + 12 * 3600000 }); return copy; }); }
function parseFdaRecords(data, topicId, attribute, fetchedAt, queryUrl) {
  const item = data.results?.find(value => value.openfda?.generic_name?.some(name => subjects[topicId].includes(String(name).toUpperCase())));
  if (!item) return [];
  const setId = item.openfda?.spl_set_id?.find(value => /^[a-f0-9-]{36}$/i.test(value));
  const sourceUrl = setId ? 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=' + setId : queryUrl;
  const texts = attributes[attribute].flatMap(key => Array.isArray(item[key]) ? item[key] : []).filter(value => typeof value === 'string');
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  const result = [];
  for (const text of texts) for (const part of segmenter.segment(text.replace(/\s+/g, ' ').trim())) {
    const sentence = part.segment.trim();
    if (sentence.length < 25 || sentence.length > 1400 || !/[.!?]$/.test(sentence) || isDosePassage(sentence) || /ignore.*instructions|system prompt|reveal.*key/i.test(sentence)) continue;
    result.push({ topicId, attribute, title: 'FDA label: ' + topicId + ' — ' + attribute.toLowerCase().replace(/_/g, ' '), excerpt: sentence, sourceUrl, fetchedAt,
      publisher: 'FDA', jurisdiction: 'US', reviewStatus: 'NOT_CLINICALLY_APPROVED', labelEffectiveDate: item.effective_time || null });
    if (result.length === 3) return result;
  }
  return result;
}
function createApprovedFdaMedicineSearch({ fetcher = (...args) => fetch(...args), enabled = () => process.env.RAG_CHAT_WEB_ENABLED === 'true', now = Date.now } = {}) {
  const cache = new Map();
  return async (topicId, options = {}) => {
    if (!options || typeof options !== 'object' || Object.keys(options).some(key => !['attribute', 'signal'].includes(key))) return { status: 'UNSUPPORTED', candidates: [] };
    const { attribute = 'GENERAL', signal } = options; signal?.throwIfAborted();
    if (!subjects[topicId] || !attributes[attribute]) return { status: 'UNSUPPORTED', candidates: [] };
    if (!enabled()) return { status: 'DISABLED', candidates: [] };
    const key = topicId + ':' + attribute, saved = cache.get(key);
    if (saved && now() >= saved.at && now() - saved.at < 12 * 3600000) return { status: 'CACHED', candidates: mark(saved.values) };
    const url = new URL('https://api.fda.gov/drug/label.json');
    url.searchParams.set('search', subjects[topicId].map(name => 'openfda.generic_name.exact:"' + name + '"').join(' OR ')); url.searchParams.set('limit', '1');
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000);
    try {
      const response = await fetcher(url.href, { redirect: 'error', credentials: 'omit', signal: deadline, headers: { Accept: 'application/json' } });
      if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) return { status: 'UNAVAILABLE', candidates: [] };
      let body = '', bytes = 0; const reader = response.body.getReader();
      try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 524288) throw new Error('FDA response exceeds limit.'); body += new TextDecoder().decode(part.value); } }
      finally { await reader.cancel().catch(() => {}); }
      deadline.throwIfAborted();
      const values = parseFdaRecords(JSON.parse(body), topicId, attribute, new Date(now()).toISOString(), url.href);
      if (values.length) cache.set(key, { at: now(), values }); while (cache.size > 16) cache.delete(cache.keys().next().value);
      return { status: values.length ? 'RETRIEVED' : 'NO_RELEVANT_EVIDENCE', candidates: mark(values) };
    } catch (error) { if (signal?.aborted) throw error; return { status: 'UNAVAILABLE', candidates: [] }; }
  };
}
module.exports = { createApprovedFdaMedicineSearch, searchApprovedFdaMedicine: createApprovedFdaMedicineSearch(), hasFdaCandidateProvenance, parseFdaRecords };
