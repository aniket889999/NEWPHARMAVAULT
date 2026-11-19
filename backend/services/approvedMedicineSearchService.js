'use strict';

const registry = require('../data/chatTopicRegistry');

const MAX_RESPONSE_BYTES = 256 * 1024; // 256 KiB
const REQUEST_TIMEOUT_MS = 6000; // 6 seconds total work bound
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_CACHE_ENTRIES = 32;
const MAX_EXCERPT_LENGTH = 1400;
const MAX_CANDIDATES = 3;
// Transport provenance only, not clinical approval. Parsed/fabricated plain
// objects cannot acquire this marker without a completed bounded lookup.
const transportedCandidates = new WeakMap();
function hasMedicineCandidateProvenance(value) {
  const original = value && transportedCandidates.get(value);
  return Boolean(original && original.until > Date.now() && ['topicId', 'attribute', 'title', 'sourceUrl', 'excerpt', 'fetchedAt', 'publisher', 'jurisdiction', 'reviewStatus'].every(key => original[key] === value[key]));
}

const ALLOWED_ATTRIBUTES = Object.freeze(['GENERAL', 'USES', 'SIDE_EFFECTS', 'STORAGE', 'MECHANISM', 'PREVENTION', 'SPECIFIC_FACT']);

// Fixed verified official NHS medicine URLs for at most 4 generic registry topics.
const LEGACY_NHS_SOURCES = {
  paracetamol: Object.freeze({
    GENERAL: 'https://www.nhs.uk/medicines/paracetamol-for-adults/',
    USES: 'https://www.nhs.uk/medicines/paracetamol-for-adults/',
    SIDE_EFFECTS: 'https://www.nhs.uk/medicines/paracetamol-for-adults/'
  }),
  metformin: Object.freeze({
    GENERAL: 'https://www.nhs.uk/medicines/metformin/',
    USES: 'https://www.nhs.uk/medicines/metformin/',
    SIDE_EFFECTS: 'https://www.nhs.uk/medicines/metformin/'
  }),
  azithromycin: Object.freeze({
    GENERAL: 'https://www.nhs.uk/medicines/azithromycin/about-azithromycin/',
    USES: 'https://www.nhs.uk/medicines/azithromycin/about-azithromycin/',
    SIDE_EFFECTS: 'https://www.nhs.uk/medicines/azithromycin/side-effects-of-azithromycin/'
  }),
  cetirizine: Object.freeze({
    GENERAL: 'https://www.nhs.uk/medicines/cetirizine/about-cetirizine/',
    USES: 'https://www.nhs.uk/medicines/cetirizine/about-cetirizine/',
    SIDE_EFFECTS: 'https://www.nhs.uk/medicines/cetirizine/side-effects-of-cetirizine/'
  })
};
const directory = require('../data/nhsMedicineDirectory.v1.json');
const rootBySlug = new Map(directory.records.map(value => [value.slug, 'https://www.nhs.uk/medicines/' + value.slug + '/']));
const rootOverrides = { paracetamol: 'paracetamol-for-adults', ibuprofen: 'ibuprofen-for-adults', 'iron-supplements': 'ferrous-sulfate' };
const FIXED_NHS_SOURCES = Object.freeze(Object.fromEntries(registry.filter(value => !value.localOnly).flatMap(topic => {
  const root = topic.officialMedicineRoot || rootBySlug.get(rootOverrides[topic.id] || topic.id);
  if (!root) return [];
  return [[topic.id, Object.freeze(Object.fromEntries(ALLOWED_ATTRIBUTES.map(attribute => [attribute, LEGACY_NHS_SOURCES[topic.id]?.[attribute] || root])))]];
})));
// Reviewed integration extension: one fixed class source for cross-document
// antibiotic/viral-infection questions. This is not a fifth medicine mapping.
const FIXED_NHS_CLASS_SOURCES = Object.freeze({
  antibiotics: Object.freeze({ GENERAL: 'https://www.nhs.uk/medicines/antibiotics/', USES: 'https://www.nhs.uk/medicines/antibiotics/' })
});

const REGISTRY_TOPICS = new Map(
  registry
    .filter(item => item && typeof item.id === 'string' && (!item.concept || item.id === 'antibiotics') && !item.localOnly)
    .map(item => [item.id, item])
);

const ALLOWED_OPTION_KEYS = new Set(['attribute', 'signal']);

const DOSE_SECTION_HEADING_RE =
  /\b(?:how\s+to\s+take|how\s+and\s+when\s+to\s+take|how\s+much\s+to\s+take|doses?|dosage|if\s+you\s+miss\s+a\s+dose|if\s+you\s+take\s+too\s+much|overdose)\b/i;

const IGNORED_SECTION_HEADING_RE =
  /\b(?:more\s+in\b|support\s+links\b|find\s+out\s+more\b|useful\s+resources\b|related\s+conditions\b|page\s+last\s+reviewed\b)/i;

const SIDE_EFFECTS_HEADING_RE =
  /\b(?:side\s+effects?|common\s+side\s+effects?|serious\s+side\s+effects?|rare\s+side\s+effects?|uncommon\s+side\s+effects?)\b/i;

const USES_HEADING_RE =
  /\b(?:what\s+[\w\s-]+\s+is\s+for|about\s+[\w\s-]+|key\s+facts|uses)\b/i;

const DOSE_SENTENCE_RE = new RegExp(
  [
    // Explicit numeric strengths, volumes, or unit counts
    String.raw`\b\d+(?:\.\d+)?\s*(?:mg|mcg|micrograms?|g|grams?|ml|millilitres?|l|iu|units?|%|tablets?|capsules?|sachets?|spoons?|spoonfuls?|teaspoons?|drops?|puffs?|doses?|packs?)\b`,
    // Frequency and timing regimens
    String.raw`\b(?:once|twice|three\s+times|four\s+times|\d+\s*(?:to\s*\d+\s*)?times)\s+(?:a|per|each)\s+day\b`,
    String.raw`\bevery\s+\d+(?:\s*(?:to|-)\s*\d+)?\s*hours?\b`,
    String.raw`\b\d+\s*hours?\s+(?:before|after)\s+(?:food|eating|meals?)\b`,
    // Administration and dosing directives
    String.raw`\b(?:take|give|inject|use|apply)\s+(?:\d+|one|two|three|four|half|a\s+dose|your\s+dose)\b`,
    String.raw`\btake\s+(?:it|(?:[a-z]+\s+)?(?:capsules?|tablets?|liquid|powder|medicine))\s+(?:at\s+least|at\s+the\s+same\s+time|with\s+or\s+without\s+food|before\s+food|after\s+food|once|twice)\b`,
    String.raw`\b(?:usual|starting|maximum|recommended|daily|missed|forgotten|extra|double|lower|higher)\s+doses?\b`,
    String.raw`\bhow\s+much\s+(?:you\s+need\s+)?to\s+take\b`,
    String.raw`\bswallow\s+(?:the\s+)?(?:tablets?|capsules?)\s+whole\b`,
    String.raw`\bfinish\s+your\s+full\s+course\b`,
    String.raw`\bat\s+the\s+same\s+time\s+each\s+day\b`
  ].join('|'),
  'i'
);

const PROMPT_INJECTION_OR_FORBIDDEN_RE =
  /ignore\s+(?:all\s+|previous\s+|prior\s+)?instructions|system\s+prompt|reveal\s+(?:the\s+)?(?:secret|key)|\bBritish\s+National\s+Formulary\b|\bBNF\b/i;

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:#(\d+)|#x([a-f0-9]+)|amp|lt|gt|quot|apos|nbsp|ndash|mdash|rsquo|lsquo|ldquo|rdquo);/gi, (match, decimal, hex) => {
      if (decimal || hex) {
        const codePoint = Number.parseInt(decimal || hex, hex ? 16 : 10);
        return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ' ';
      }
      const named = match.toLowerCase();
      return (
        {
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
          '&nbsp;': ' ',
          '&ndash;': '-',
          '&mdash;': '-',
          '&rsquo;': "'",
          '&lsquo;': "'",
          '&ldquo;': '"',
          '&rdquo;': '"'
        }[named] || ' '
      );
    });
}

function cleanInlineText(htmlFragment) {
  return decodeEntities(
    String(htmlFragment || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDosePassage(text) {
  return DOSE_SENTENCE_RE.test(String(text || ''));
}

function splitCompleteSentences(blockText) {
  const normalized = String(blockText || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (/^Page last reviewed:/i.test(normalized)) return [];
  const rawParts = normalized.match(/[^.!?]+[.!?]+(?:["')\]]+)?(?:\s|$)|[^.!?]+$/g) || [];
  const sentences = [];
  for (const raw of rawParts) {
    const sentence = raw.trim();
    if (!sentence) continue;
    // Never expose an unpunctuated or cut-off clause as a completed statement.
    if (!/[.!?](?:["')\]]+)?$/.test(sentence)) continue;
    if (sentence.length < 12 || sentence.length > MAX_EXCERPT_LENGTH) continue;
    if (!/^[A-Z0-9"'(]/.test(sentence)) continue;
    if (/^Page last reviewed:/i.test(sentence)) continue;
    if (PROMPT_INJECTION_OR_FORBIDDEN_RE.test(sentence)) continue;
    if (isDosePassage(sentence)) continue;
    sentences.push(sentence);
  }
  return sentences;
}

function extractBlocksFromSectionHtml(sectionHtml) {
  // Collapse lead-in paragraphs ending in ":" followed immediately by a <ul>/<ol>
  // into a single complete punctuated sentence using verbatim list items.
  const withCollapsedLists = sectionHtml.replace(
    /<p\b[^>]*>([\s\S]*?)<\/p>\s*<(?:ul|ol)\b[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi,
    (fullMatch, pInner, listInner) => {
      const lead = cleanInlineText(pInner);
      if (!lead.endsWith(':')) return fullMatch;
      const items = [...listInner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map(match => cleanInlineText(match[1]).replace(/[.;,\s]+$/, '').trim())
        .filter(item => item.length > 0 && !isDosePassage(item));
      if (!items.length) return '';
      return `<p>${lead} ${items.join('; ')}.</p>`;
    }
  );

  const blocks = [];
  for (const match of withCollapsedLists.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    // Skip navigation-only list items that are just anchor links.
    if (tag === 'li' && /^\s*<a\b[^>]*>[\s\S]*?<\/a>\s*$/i.test(inner)) continue;
    const text = cleanInlineText(inner);
    if (!text) continue;
    blocks.push(text);
  }
  return blocks;
}

function stripNonArticleMarkup(containerHtml) {
  return containerHtml
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, ' ')
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, ' ')
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, ' ')
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, ' ');
}

function classifySection(headingText, index) {
  if (!headingText) return index === 0 ? 'INTRO' : 'GENERAL';
  if (IGNORED_SECTION_HEADING_RE.test(headingText)) return 'IGNORE';
  if (/\b(?:stor(?:e|age|ing)|keep(?:ing)? .{0,50}(?:safe|medicine)|dispose|disposal)\b/i.test(headingText)) return 'STORAGE';
  if (/how.{0,60}work|mechanism/i.test(headingText)) return 'MECHANISM';
  if (DOSE_SECTION_HEADING_RE.test(headingText)) return 'DOSE';
  if (SIDE_EFFECTS_HEADING_RE.test(headingText)) return 'SIDE_EFFECTS';
  if (USES_HEADING_RE.test(headingText)) return 'USES';
  return 'GENERAL';
}

function buildExcerpts(sentences) {
  const uniqueSentences = [];
  const seen = new Set();
  for (const sentence of sentences) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueSentences.push(sentence);
  }

  const excerpts = [];
  let current = '';
  let countInCurrent = 0;

  for (const sentence of uniqueSentences) {
    if (sentence.length > MAX_EXCERPT_LENGTH) continue;
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (current && (candidate.length > MAX_EXCERPT_LENGTH || candidate.length > 520 || countInCurrent >= 3)) {
      excerpts.push(current);
      if (excerpts.length >= MAX_CANDIDATES) return excerpts;
      current = sentence;
      countInCurrent = 1;
    } else {
      current = candidate;
      countInCurrent += 1;
    }
  }

  if (current && excerpts.length < MAX_CANDIDATES) {
    excerpts.push(current);
  }

  return excerpts.slice(0, MAX_CANDIDATES);
}

function parseNhsMedicineHtml(html, { topicId, attribute, sourceUrl, fetchedAt }) {
  if (typeof html !== 'string' || !html.trim() || /<!ENTITY/i.test(html)) {
    throw new Error('Invalid official medicine HTML response.');
  }

  const mainMatches = [...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)].map(m => m[1]);
  const articleMatches = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(m => m[1]);
  const rawContainer = mainMatches.length
    ? mainMatches.join('\n')
    : articleMatches.length
      ? articleMatches.join('\n')
      : null;

  if (!rawContainer) {
    throw new Error('Official medicine article container missing.');
  }

  const cleanedContainer = stripNonArticleMarkup(rawContainer);

  const rawTitle =
    html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    '';
  const cleanedTitle = cleanInlineText(rawTitle).replace(/\s*-\s*NHS\s*$/i, '').trim();
  if (!cleanedTitle || cleanedTitle.length > 220) {
    throw new Error('Official medicine title missing.');
  }
  const title = cleanedTitle.startsWith('NHS:') ? cleanedTitle : `NHS: ${cleanedTitle}`;

  // Split cleaned main container by <h2> headings to isolate article sections.
  const headingRegex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  const sections = [];
  let lastIndex = 0;
  let match;
  let sectionIndex = 0;

  while ((match = headingRegex.exec(cleanedContainer)) !== null) {
    const precedingHtml = cleanedContainer.slice(lastIndex, match.index);
    if (precedingHtml.trim()) {
      sections.push({
        kind: sectionIndex === 0 ? 'INTRO' : 'GENERAL',
        html: precedingHtml
      });
      sectionIndex += 1;
    }
    const headingText = cleanInlineText(match[1]);
    const nextStart = headingRegex.lastIndex;
    lastIndex = nextStart;

    const nextMatch = headingRegex.exec(cleanedContainer);
    const bodyEnd = nextMatch ? nextMatch.index : cleanedContainer.length;
    const sectionBody = cleanedContainer.slice(nextStart, bodyEnd);
    const kind = classifySection(headingText, sectionIndex + 1);
    sections.push({ kind, headingText, html: sectionBody });
    sectionIndex += 1;

    if (nextMatch) {
      headingRegex.lastIndex = nextMatch.index;
      lastIndex = nextMatch.index;
    } else {
      lastIndex = cleanedContainer.length;
      break;
    }
  }

  if (lastIndex < cleanedContainer.length) {
    const remaining = cleanedContainer.slice(lastIndex);
    if (remaining.trim()) {
      sections.push({
        kind: sectionIndex === 0 ? 'INTRO' : 'GENERAL',
        html: remaining
      });
    }
  }

  const pageIsDedicatedSideEffects =
    /\/side-effects-of-[a-z0-9-]+\/?$/i.test(sourceUrl) || SIDE_EFFECTS_HEADING_RE.test(cleanedTitle);

  let selectedSections = [];
  if (attribute === 'STORAGE') {
    selectedSections = sections.filter(sec => sec.kind === 'STORAGE');
  } else if (attribute === 'MECHANISM') {
    selectedSections = sections.filter(sec => sec.kind === 'MECHANISM' || sec.kind === 'INTRO' || sec.kind === 'USES');
  } else if (attribute === 'SIDE_EFFECTS') {
    const explicitSideEffects = sections.filter(sec => sec.kind === 'SIDE_EFFECTS');
    if (explicitSideEffects.length) {
      selectedSections = explicitSideEffects;
    } else if (pageIsDedicatedSideEffects) {
      selectedSections = sections.filter(sec => sec.kind !== 'IGNORE' && sec.kind !== 'DOSE');
    } else {
      selectedSections = [];
    }
  } else if (attribute === 'USES') {
    const usesSections = sections.filter(sec => sec.kind === 'INTRO' || sec.kind === 'USES');
    selectedSections = usesSections.length
      ? usesSections
      : sections.filter(sec => sec.kind !== 'IGNORE' && sec.kind !== 'DOSE' && sec.kind !== 'SIDE_EFFECTS');
  } else {
    // GENERAL
    const generalPrimary = sections.filter(sec => sec.kind === 'INTRO' || sec.kind === 'USES' || sec.kind === 'GENERAL');
    selectedSections = generalPrimary.length
      ? generalPrimary
      : sections.filter(sec => sec.kind !== 'IGNORE' && sec.kind !== 'DOSE');
  }

  const sentences = [];
  for (const section of selectedSections) {
    const blocks = extractBlocksFromSectionHtml(section.html);
    for (const block of blocks) {
      const complete = splitCompleteSentences(block);
      sentences.push(...(attribute === 'MECHANISM' ? complete.filter(value => /\b(?:works?|blocks?|inhibit\w*|production|absorption|receptors?|increases?|reduces?|lowers?)\b/i.test(value))
        : attribute === 'PREVENTION' ? complete.filter(value => /prevent|avoid|reduce|check|ask|safe/i.test(value)) : complete));
    }
  }

  if (attribute === 'SIDE_EFFECTS' && !sentences.length && !pageIsDedicatedSideEffects && sections.length === 1) {
    // Fallback for single-section html where side effects are mentioned inline
    const blocks = extractBlocksFromSectionHtml(sections[0].html);
    for (const block of blocks) {
      for (const sentence of splitCompleteSentences(block)) {
        if (/\b(?:side\s+effects?|nausea|dizziness|headache|diarrhoea|vomiting|rash|allergic|stomach)\b/i.test(sentence)) {
          sentences.push(sentence);
        }
      }
    }
  }

  const excerpts = buildExcerpts(sentences);
  return excerpts.map(excerpt =>
    Object.freeze({
      topicId,
      attribute,
      title,
      sourceUrl,
      excerpt,
      fetchedAt,
      publisher: 'NHS',
      jurisdiction: 'UK',
      reviewStatus: 'NOT_CLINICALLY_APPROVED'
    })
  );
}

async function readBoundedHtml(response, expectedUrl) {
  if (!response || typeof response !== 'object') {
    throw new Error('Official medicine response missing.');
  }
  if (
    response.redirected === true ||
    (typeof response.status === 'number' && response.status >= 300 && response.status < 400) ||
    response.headers?.get?.('location') ||
    (typeof response.url === 'string' && response.url.length > 0 && response.url !== expectedUrl)
  ) {
    throw new Error('Official medicine redirect rejected.');
  }
  if (!response.ok || (typeof response.status === 'number' && response.status !== 200)) {
    throw new Error('Official medicine source unavailable.');
  }
  const contentType = response.headers?.get?.('content-type') || '';
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error('Official medicine response is not HTML.');
  }
  const declaredLength = Number.parseInt(response.headers?.get?.('content-length') || '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('Official medicine response exceeds 256 KiB limit.');
  }

  const reader = response.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let bytes = 0;
    let html = '';
    try {
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        const chunk = step.value instanceof Uint8Array ? step.value : Buffer.from(step.value || '');
        bytes += chunk.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) {
          throw new Error('Official medicine response exceeds 256 KiB limit.');
        }
        html += decoder.decode(chunk, { stream: true });
      }
      return html + decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
  }

  throw new Error('Official medicine response body unavailable.');
}

function cloneCandidates(candidates) {
  return candidates.map(candidate => {
    const copy = { ...candidate };
    transportedCandidates.set(copy, { ...copy, until: Date.now() + CACHE_TTL_MS });
    return copy;
  });
}
function childSource(html, root, attribute) {
  const expressions = attribute === 'SIDE_EFFECTS' ? [/\/side-effects-of-/] : ['MECHANISM', 'PREVENTION', 'SPECIFIC_FACT'].includes(attribute)
    ? [/\/common-questions-about-/, /\/about-/] : attribute === 'STORAGE' ? [/\/how-and-when-to-take-/] : [/\/about-/];
  const candidates = [...html.matchAll(/\bhref="([^"]+)"/g)].map(match => {
    try { const url = new URL(match[1], root); return url.origin === 'https://www.nhs.uk' && !url.search && !url.hash && !url.username && url.href.startsWith(root) && /^[a-z0-9-]+\/$/.test(url.href.slice(root.length)) ? url.href : null; } catch { return null; }
  }).filter(Boolean);
  return expressions.flatMap(pattern => candidates.filter(value => pattern.test(value)))[0];
}

function createAbortError(reason) {
  if (reason instanceof Error) return reason;
  const error = new Error(typeof reason === 'string' ? reason : 'The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function createApprovedMedicineSearch({
  fetcher = (...args) => fetch(...args),
  now = () => Date.now(),
  enabled = () => process.env.RAG_CHAT_WEB_ENABLED === 'true',
  maxCacheEntries = MAX_CACHE_ENTRIES
} = {}) {
  const cache = new Map();
  const cacheLimit = Math.max(1, Math.min(Number(maxCacheEntries) || MAX_CACHE_ENTRIES, MAX_CACHE_ENTRIES));
  const currentNow = () => (typeof now === 'function' ? Number(now()) : Number(now));
  const isEnabled = () => (typeof enabled === 'function' ? Boolean(enabled()) : Boolean(enabled));

  async function search(topicId, options = {}) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      return { status: 'UNSUPPORTED', candidates: [] };
    }

    const { attribute = 'GENERAL', signal } = options;
    if (signal?.aborted) {
      throw createAbortError(signal.reason);
    }

    // Reject arbitrary URLs, questions, conversation history, or patient/case fields.
    for (const key of Object.keys(options)) {
      if (!ALLOWED_OPTION_KEYS.has(key)) {
        return { status: 'UNSUPPORTED', candidates: [] };
      }
    }

    if (
      typeof topicId !== 'string' ||
      !(Object.prototype.hasOwnProperty.call(FIXED_NHS_SOURCES, topicId) || Object.prototype.hasOwnProperty.call(FIXED_NHS_CLASS_SOURCES, topicId)) ||
      !REGISTRY_TOPICS.has(topicId)
    ) {
      return { status: 'UNSUPPORTED', candidates: [] };
    }

    if (typeof attribute !== 'string' || !ALLOWED_ATTRIBUTES.includes(attribute)) {
      return { status: 'UNSUPPORTED', candidates: [] };
    }

    if (!isEnabled()) {
      return { status: 'DISABLED', candidates: [] };
    }

    const sourceUrl = (FIXED_NHS_SOURCES[topicId] || FIXED_NHS_CLASS_SOURCES[topicId])[attribute];
    if (typeof sourceUrl !== 'string' || !/^https:\/\/www\.nhs\.uk\/medicines\/[a-z0-9-/]+\/$/.test(sourceUrl)) {
      return { status: 'UNSUPPORTED', candidates: [] };
    }

    const cacheKey = `${topicId}:${attribute}`;
    const currentTime = currentNow();
    const cached = cache.get(cacheKey);
    if (cached && currentTime >= cached.at && currentTime - cached.at < CACHE_TTL_MS) {
      return { status: 'CACHED', candidates: cloneCandidates(cached.candidates) };
    }
    if (cached) {
      cache.delete(cacheKey);
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('Official medicine lookup timed out.'));
    }, REQUEST_TIMEOUT_MS);

    const onCallerAbort = () => {
      controller.abort(createAbortError(signal.reason));
    };
    if (signal) {
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const workPromise = (async () => {
        const response = await fetcher(sourceUrl, {
          method: 'GET',
          redirect: 'error',
          credentials: 'omit',
          headers: { Accept: 'text/html' },
          signal: controller.signal
        });
        let html = await readBoundedHtml(response, sourceUrl), actualUrl = sourceUrl;
        controller.signal.throwIfAborted();
        const root = registry.find(topic => topic.id === topicId)?.officialMedicineRoot || rootBySlug.get(rootOverrides[topicId] || topicId);
        const child = root && sourceUrl === root ? childSource(html, root, attribute) : null;
        if (child) {
          try { const result = await fetcher(child, { method: 'GET', redirect: 'error', credentials: 'omit', headers: { Accept: 'text/html' }, signal: controller.signal });
            const body = await readBoundedHtml(result, child); controller.signal.throwIfAborted(); html = body; actualUrl = child;
          } catch (error) { if (controller.signal.aborted) throw error; /* Keep a valid root, never follow more links. */ }
        }
        const fetchedAt = new Date(currentNow()).toISOString();
        const candidates = parseNhsMedicineHtml(html, {
          topicId,
          attribute,
          sourceUrl: actualUrl,
          fetchedAt
        });
        if (candidates.length > 0) {
          if (cache.has(cacheKey)) cache.delete(cacheKey);
          cache.set(cacheKey, { at: currentNow(), candidates });
          while (cache.size > cacheLimit) {
            cache.delete(cache.keys().next().value);
          }
          return { status: 'RETRIEVED', candidates: cloneCandidates(candidates) };
        }
        return { status: 'NO_RELEVANT_EVIDENCE', candidates: [] };
      })();

      const timeoutPromise = new Promise((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(controller.signal.reason || new Error('Aborted')),
          { once: true }
        );
      });

      return await Promise.race([workPromise, timeoutPromise]);
    } catch (error) {
      if (signal?.aborted && !timedOut) {
        throw createAbortError(signal.reason || error);
      }
      return { status: 'UNAVAILABLE', candidates: [] };
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  search.search = search;
  return search;
}

const searchApprovedMedicine = createApprovedMedicineSearch();

module.exports = {
  createApprovedMedicineSearch,
  searchApprovedMedicine,
  parseNhsMedicineHtml,
  isDosePassage,
  hasMedicineCandidateProvenance,
  FIXED_NHS_SOURCES,
  ALLOWED_ATTRIBUTES,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  CACHE_TTL_MS,
  MAX_CACHE_ENTRIES,
  MAX_EXCERPT_LENGTH,
  MAX_CANDIDATES
};
