const crypto = require('node:crypto');
const registry = require('../data/chatTopicRegistry');
const { rankPassages, tokens } = require('./chatRagService');
const { toolControls } = require('./chatRuntimeControlService');
const { hasMedicineCandidateProvenance } = require('./approvedMedicineSearchService');
const { hasFdaCandidateProvenance } = require('./approvedFdaMedicineSearchService');
const TOPICS = new Map(registry.map(value => [value.id, value]));
const accepted = new Map();
function webLookupPolicy(environment = process.env) {
  if (environment.RAG_CHAT_WEB_ENABLED !== 'true') return 'DISABLED';
  return environment.RAG_CHAT_WEB_MODE === 'ALWAYS_PUBLIC' ? 'ALWAYS_PUBLIC' : 'FALLBACK';
}
function isApprovedWebPassage(value) {
  const original = accepted.get(value?.id);
  if (original && original.until <= Date.now()) { accepted.delete(value.id); return false; }
  return Boolean(original && value.kind === 'OFFICIAL_WEB' && value.private === false && !value.documentId && ['excerpt', 'sourceUrl', 'title', 'version'].every(key => value[key] === original[key])
    && (!original.scope || original.scope === JSON.stringify([value.topics, value.supportedAttributes, value.publisher, value.jurisdiction])));
}
function registerMedicineCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length > 3 || candidates.some(value => !hasMedicineCandidateProvenance(value) && !hasFdaCandidateProvenance(value))) throw new Error('Unbound medicine-source candidate.');
  const passages = candidates.map(value => {
    const key = value.publisher.toLowerCase() + '-live-' + crypto.createHash('sha256').update(value.sourceUrl + ':' + value.attribute + ':' + value.excerpt).digest('hex').slice(0, 20);
    const passage = { ...value, key, id: crypto.createHash('sha256').update(key + value.fetchedAt).digest('hex').slice(0, 16),
      kind: 'OFFICIAL_WEB', private: false, version: 'Retrieved ' + value.fetchedAt, checkedAt: value.fetchedAt,
      topics: [value.topicId], supportedAttributes: [value.attribute],
      attribution: value.publisher + ' official public medicine text (' + value.jurisdiction + '). Not India-specific approval or clinical validation.',
      licensingNote: value.publisher === 'NHS' ? 'NHS text attribution; no logos, media or third-party BNF content.' : 'FDA public label API; product-specific US labelling, not Indian regulatory or formulation equivalence.' };
    accepted.set(passage.id, { ...passage, until: Date.now() + 12 * 60 * 60 * 1000,
      scope: JSON.stringify([passage.topics, passage.supportedAttributes, passage.publisher, passage.jurisdiction]) });
    return passage;
  });
  while (accepted.size > 256) accepted.delete(accepted.keys().next().value);
  return passages;
}
function sourceChunks(source) {
  const groups = []; let current = '';
  for (const sentence of source.text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || []) {
    const value = sentence.trim();
    // Never expose a cut-off clause as a completed source statement.
    if (!/[.!?]$/.test(value) || value.length > 1400) continue;
    if (current && (current + ' ' + value).split(/\s+/).length > 110) { groups.push(current); current = ''; }
    current += (current ? ' ' : '') + value;
  }
  if (current) groups.push(current);
  return groups.slice(0, 12).map((excerpt, index) => ({ ...source, excerpt, id: crypto.createHash('sha256').update(source.key + ':' + index + ':' + excerpt).digest('hex').slice(0, 16) }));
}
function plain(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&(?:#(\d+)|#x([a-f0-9]+)|amp|lt|gt|quot|apos|nbsp);/gi, (match, decimal, hex) => {
      if (decimal || hex) { const n = Number.parseInt(decimal || hex, hex ? 16 : 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' '; }
      return ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[match.toLowerCase()] || ' ';
    }).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function parseResults(xml, topic, fetchedAt) {
  if (typeof xml !== 'string' || /<!DOCTYPE|<!ENTITY/i.test(xml) || !xml.includes('<nlmSearchResult')) throw new Error('Invalid official-source response.');
  const result = [];
  for (const match of xml.matchAll(/<document\b([^>]*)>([\s\S]*?)<\/document>/gi)) {
    const sourceUrl = /\burl="([^"]+)"/.exec(match[1])?.[1];
    if (!sourceUrl || !/^https:\/\/medlineplus\.gov\/[a-z0-9-]+\.html$/.test(sourceUrl)) continue;
    const fields = new Map([...match[2].matchAll(/<content\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/content>/gi)].map(value => [value[1].toLowerCase(), plain(value[2])]));
    const title = fields.get('title'), text = fields.get('fullsummary');
    if (!title || title.length > 200 || !text || text.length < 50) continue;
    if (/ignore (?:all |previous |prior )?instructions|system prompt|reveal (?:the )?(?:secret|key)/i.test(text)) continue;
    result.push(...sourceChunks({ key: 'medlineplus-' + crypto.createHash('sha256').update(sourceUrl + text).digest('hex').slice(0, 20), title: 'MedlinePlus: ' + title,
      text: text.slice(0, 5000), sourceUrl, kind: 'OFFICIAL_WEB', private: false, version: 'Retrieved ' + fetchedAt, fetchedAt,
      attribution: 'Source: MedlinePlus, National Library of Medicine.', contentPolicy: 'HEALTH_TOPIC_SUMMARY_ONLY_NOT_LICENSED_DRUG_MONOGRAPHS' }));
  }
  const eligible = result.filter(passage => !/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|tablets?|capsules?)\b|\b(?:take|give)\s+\d|\bevery\s+\d+\s+hours?\b/i.test(passage.excerpt));
  let ranked = rankPassages(topic.webTerm, eligible, 3);
  const queryTokens = tokens(topic.webTerm);
  // BM25 IDF is very small for a one-record response. An exact registered
  // topic phrase still provides a lexical match, not clinical confidence.
  const topicPhrase = queryTokens.join(' ');
  if (!ranked.length && topicPhrase) ranked = eligible.filter(value => (' ' + tokens(value.title + ' ' + value.excerpt).join(' ') + ' ').includes(' ' + topicPhrase + ' ')).slice(0, 3).map(value => ({ ...value, score: 0 }));
  for (const value of ranked) accepted.set(value.id, { excerpt: value.excerpt, sourceUrl: value.sourceUrl, title: value.title, version: value.version, until: Date.now() + 12 * 60 * 60 * 1000 });
  while (accepted.size > 256) accepted.delete(accepted.keys().next().value);
  return ranked;
}
async function boundedXml(response) {
  if (!response.ok || !/xml/i.test(response.headers.get('content-type') || '')) throw new Error('Official search unavailable.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Official response unavailable.');
  const decoder = new TextDecoder(); let bytes = 0, text = '';
  try { while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.length; if (bytes > 131072) throw new Error('Official response exceeds limits.'); text += decoder.decode(item.value, { stream: true }); } return text + decoder.decode(); }
  finally { await reader.cancel().catch(() => {}); }
}
function waitForCaller(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}
function createApprovedHealthSearch({ fetcher = (...args) => fetch(...args), now = () => Date.now(), enabled = () => process.env.RAG_CHAT_WEB_ENABLED === 'true', controls = toolControls } = {}) {
  const cache = new Map(), pending = new Map(); let windowStart = 0, requests = 0;
  return async function search(topicId, { signal } = {}) {
    signal?.throwIfAborted();
    const topic = TOPICS.get(topicId);
    if (!topic || topic.localOnly || typeof topic.webTerm !== 'string') throw new Error('Unapproved public search topic.');
    if (!enabled()) return { status: 'DISABLED', passages: [] };
    const saved = cache.get(topicId);
    if (saved && now() >= saved.at && now() - saved.at < 12 * 60 * 60 * 1000 && saved.passages.every(isApprovedWebPassage)) return { status: 'CACHED', passages: saved.passages };
    if (pending.has(topicId)) return waitForCaller(pending.get(topicId), signal);
    if (now() - windowStart >= 60000) { windowStart = now(); requests = 0; }
    if (requests >= 20) return { status: 'RATE_LIMITED', passages: [] };
    requests++;
    // Fixed endpoint + registry term only. No raw question/history/person/case
    // identifier or model-selected URL can enter the request.
    const url = new URL('https://wsearch.nlm.nih.gov/ws/query');
    for (const [key, value] of Object.entries({ db: 'healthTopics', term: topic.webTerm, retmax: '3', rettype: 'brief', tool: 'PharmaVaultAcademicPrototype' })) url.searchParams.set(key, value);
    const work = (async () => { try {
      return await controls.run('WEB', async () => {
      // Shared work contains only a fixed public topic. One caller cancelling
      // does not cancel another caller's request; transport still has a 6s cap.
      const response = await fetcher(url.toString(), { redirect: 'error', credentials: 'omit', headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(6000) });
      const passages = parseResults(await boundedXml(response), topic, new Date(now()).toISOString());
      if (passages.length) cache.set(topicId, { at: now(), passages }); if (cache.size > 32) cache.delete(cache.keys().next().value);
      return { status: passages.length ? 'RETRIEVED' : 'NO_RELEVANT_EVIDENCE', passages };
      });
    } catch (error) { return { status: error.fallbackReason || 'UNAVAILABLE', passages: [] }; } })();
    pending.set(topicId, work);
    void work.then(() => pending.delete(topicId), () => pending.delete(topicId));
    return waitForCaller(work, signal);
  };
}
const searchApprovedHealth = createApprovedHealthSearch();
module.exports = { createApprovedHealthSearch, searchApprovedHealth, parseResults, plain, isApprovedWebPassage, webLookupPolicy, registerMedicineCandidates };
