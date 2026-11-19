'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApprovedMedicineSearch,
  FIXED_NHS_SOURCES,
  ALLOWED_ATTRIBUTES,
  MAX_RESPONSE_BYTES,
  CACHE_TTL_MS,
  MAX_CACHE_ENTRIES,
  MAX_EXCERPT_LENGTH,
  MAX_CANDIDATES
} = require('../services/approvedMedicineSearchService');
const { isApprovedWebPassage } = require('../services/approvedHealthSearchService');

function makeStreamResponse(chunks, {
  status = 200,
  ok = status >= 200 && status < 300,
  redirected = false,
  url = '',
  headers = { 'content-type': 'text/html; charset=utf-8' }
} = {}) {
  const encoder = new TextEncoder();
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])
  );
  let index = 0;

  return {
    status,
    ok,
    redirected,
    url,
    headers: {
      get(name) {
        return normalizedHeaders.get(String(name || '').toLowerCase()) || null;
      }
    },
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            const next = chunks[index++];
            const bytes = typeof next === 'string' ? encoder.encode(next) : next;
            return { done: false, value: bytes };
          },
          async cancel() {}
        };
      }
    }
  };
}

const SAMPLE_SINGLE_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Paracetamol for adults: painkiller for pain and high temperature - NHS</title>
  <script>window.__TRACKING__ = "ignore this script sentence.";</script>
  <style>.nhsuk-header { display: block; }</style>
</head>
<body>
  <header><p>NHS Header navigation should never appear in excerpts.</p></header>
  <nav class="nhsuk-breadcrumb"><p>Home &gt; Medicines &gt; Paracetamol for adults.</p></nav>
  <main id="maincontent">
    <h1>Paracetamol for adults - Common brands: Panadol</h1>
    <p>Paracetamol is a painkiller that helps with pain and high temperature. You can buy most types from shops and pharmacies, but some types are only available with a prescription.</p>
    <h2>What paracetamol is for</h2>
    <p>Paracetamol is a painkiller that can be used to treat:</p>
    <ul>
      <li>headaches</li>
      <li>joint swelling and stiffness</li>
      <li>symptoms of a cold or flu, such as a high temperature (fever)</li>
      <li>toothache</li>
    </ul>
    <p>It does not reduce inflammation in the way anti-inflammatory painkillers do.</p>
    <h2>How to take paracetamol and how much to take (dose)</h2>
    <p>The usual dose for adults is 1 or 2 tablets of 500mg up to 4 times in 24 hours. Leave at least 4 hours between doses.</p>
    <h2>Side effects of paracetamol</h2>
    <p>Paracetamol very rarely causes side effects if you take it properly. Rare serious side effects can include a severe allergic reaction or blood disorders.</p>
    <p>Do not take paracetamol alongside other medicines that already contain paracetamol.</p>
    <h2>Support links</h2>
    <p>NHS website support links and policy footer sentence.</p>
    <p>Page last reviewed: 20 October 2025 Next review due: 20 October 2028</p>
  </main>
  <footer><p>Crown copyright footer text that must not be extracted.</p></footer>
</body>
</html>`;

const SAMPLE_AZITHROMYCIN_ABOUT_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>About azithromycin - NHS</title></head>
<body>
  <main>
    <h1>About azithromycin - Brand name: Zithromax</h1>
    <p>Azithromycin is an antibiotic medicine.</p>
    <p>It's used to treat infections including:</p>
    <ul>
      <li>chest infections such as pneumonia</li>
      <li>ear, nose and throat infections such as sinus infections (sinusitis)</li>
      <li>skin infections</li>
      <li>Lyme disease</li>
    </ul>
    <p>Azithromycin is from a group of medicines called macrolide antibiotics. Macrolide antibiotics work by killing the bacteria that cause the infection. Antibiotics such as azithromycin do not work for viral infections such as colds and flu.</p>
    <p>You'll usually take azithromycin once a day. Try to take it at the same time each day.</p>
    <p>Take azithromycin capsules or tablets at least 1 hour before food or 2 hours after eating.</p>
    <h2>More in Azithromycin</h2>
    <ul>
      <li><a href="https://www.nhs.uk/medicines/azithromycin/about-azithromycin/">About azithromycin</a></li>
      <li><a href="https://www.nhs.uk/medicines/azithromycin/side-effects-of-azithromycin/">Side effects</a></li>
    </ul>
  </main>
</body>
</html>`;

test('1. Fixed URL and attribute mapping for the 4 allowed generic topics and candidate untrusted metadata', async () => {
  assert.ok(Object.keys(FIXED_NHS_SOURCES).length >= 250);
  for(const id of ['paracetamol','metformin','azithromycin','cetirizine'])assert.ok(FIXED_NHS_SOURCES[id]);
  assert.deepEqual(ALLOWED_ATTRIBUTES, ['GENERAL', 'USES', 'SIDE_EFFECTS', 'STORAGE', 'MECHANISM', 'PREVENTION', 'SPECIFIC_FACT']);

  const requestedCalls = [];
  const fixedTime = Date.parse('2026-11-19T05:30:00.000Z');
  const search = createApprovedMedicineSearch({
    now: () => fixedTime,
    enabled: () => true,
    fetcher: async (url, options) => {
      requestedCalls.push({ url, options });
      return makeStreamResponse([SAMPLE_AZITHROMYCIN_ABOUT_HTML], { url });
    }
  });

  // Also supports destructuring { search }
  assert.equal(typeof search, 'function');
  assert.equal(search.search, search);

  const result = await search('azithromycin', { attribute: 'USES' });
  assert.equal(result.status, 'RETRIEVED');
  assert.equal(requestedCalls.length, 1);
  assert.equal(requestedCalls[0].url, 'https://www.nhs.uk/medicines/azithromycin/about-azithromycin/');
  assert.equal(requestedCalls[0].options.redirect, 'error');
  assert.equal(requestedCalls[0].options.credentials, 'omit');

  assert.ok(result.candidates.length >= 1 && result.candidates.length <= MAX_CANDIDATES);
  for (const candidate of result.candidates) {
    assert.equal(candidate.topicId, 'azithromycin');
    assert.equal(candidate.attribute, 'USES');
    assert.equal(candidate.title, 'NHS: About azithromycin - Brand name: Zithromax');
    assert.equal(candidate.sourceUrl, 'https://www.nhs.uk/medicines/azithromycin/about-azithromycin/');
    assert.equal(candidate.fetchedAt, '2026-11-19T05:30:00.000Z');
    assert.equal(candidate.publisher, 'NHS');
    assert.equal(candidate.jurisdiction, 'UK');
    assert.equal(candidate.reviewStatus, 'NOT_CLINICALLY_APPROVED');
    assert.equal(isApprovedWebPassage(candidate), false, 'Candidates must not be registered as approved web passages');
  }

  // Verify fixed URL mapping for all 4 topics x 3 attributes
  for (const topicId of Object.keys(FIXED_NHS_SOURCES)) {
    for (const attribute of ALLOWED_ATTRIBUTES) {
      const url = FIXED_NHS_SOURCES[topicId][attribute];
      assert.match(url, /^https:\/\/www\.nhs\.uk\/medicines\/[a-z0-9-/]+\/$/);
    }
  }
});

test('2. Disabled, unknown topic, unsupported attribute, arbitrary URL, or extra patient/question inputs perform zero network egress', async () => {
  let networkCalls = 0;
  const countingFetcher = async () => {
    networkCalls += 1;
    throw new Error('Fetcher must not be called');
  };

  const disabledSearch = createApprovedMedicineSearch({
    enabled: () => false,
    fetcher: countingFetcher
  });
  const disabledResult = await disabledSearch('paracetamol', { attribute: 'USES' });
  assert.deepEqual(disabledResult, { status: 'DISABLED', candidates: [] });
  assert.equal(networkCalls, 0);

  const enabledSearch = createApprovedMedicineSearch({
    enabled: () => true,
    fetcher: countingFetcher
  });

  const disallowedCases = [
    ['unlisted-test-medicine', { attribute: 'USES' }], // Not in the official index
    ['dolo 650', { attribute: 'GENERAL' }], // Brand alias rejected
    ['fever', { attribute: 'GENERAL' }], // Concept topic rejected
    ['https://www.nhs.uk/medicines/paracetamol-for-adults/', { attribute: 'GENERAL' }], // Arbitrary URL rejected
    ['Does Azithromycin treat viral colds?', { attribute: 'USES' }], // Raw question rejected
    ['paracetamol', { attribute: 'DOSAGE' }], // Unsupported attribute
    ['paracetamol', { attribute: 'USES', url: 'https://evil.example/payload' }], // Disallowed option key
    ['paracetamol', { attribute: 'USES', question: 'What is my dose?' }], // Disallowed option key
    ['paracetamol', { attribute: 'USES', history: ['prior turn'] }], // Disallowed option key
    ['paracetamol', { attribute: 'USES', patientId: 'P-123' }], // Disallowed option key
    ['paracetamol', { attribute: 'USES', caseId: 'C-456' }], // Disallowed option key
    [null, { attribute: 'GENERAL' }],
    ['paracetamol', null]
  ];

  for (const [topicArg, optionsArg] of disallowedCases) {
    const res = await enabledSearch(topicArg, optionsArg);
    assert.deepEqual(res, { status: 'UNSUPPORTED', candidates: [] });
  }
  assert.equal(networkCalls, 0);
});

test('3. Redirects and mismatched response URLs fail closed as UNAVAILABLE', async () => {
  const targetUrl = FIXED_NHS_SOURCES.metformin.GENERAL;

  const redirectScenarios = [
    async () => {
      throw new TypeError('fetch failed: redirect mode is set to error');
    },
    async () =>
      makeStreamResponse([SAMPLE_SINGLE_PAGE_HTML], {
        status: 302,
        ok: false,
        url: targetUrl,
        headers: { location: 'https://www.nhs.uk/medicines/other/' }
      }),
    async () =>
      makeStreamResponse([SAMPLE_SINGLE_PAGE_HTML], {
        status: 200,
        ok: true,
        redirected: true,
        url: targetUrl
      }),
    async () =>
      makeStreamResponse([SAMPLE_SINGLE_PAGE_HTML], {
        status: 200,
        ok: true,
        redirected: false,
        url: 'https://www.nhs.uk/medicines/metformin-redirected/'
      })
  ];

  for (const fetcher of redirectScenarios) {
    const search = createApprovedMedicineSearch({ enabled: true, fetcher });
    const res = await search('metformin', { attribute: 'GENERAL' });
    assert.deepEqual(res, { status: 'UNAVAILABLE', candidates: [] });
  }
});

test('4. Enforces 256 KiB response byte limit and 6-second total work timeout without retries', async () => {
  let oversizedCalls = 0;
  const oversizedChunk = 'a'.repeat(140 * 1024);
  const searchOversized = createApprovedMedicineSearch({
    enabled: true,
    fetcher: async url => {
      oversizedCalls += 1;
      return makeStreamResponse(
        [`<main><h1>Metformin</h1><p>${oversizedChunk}`, `${oversizedChunk}</p></main>`],
        { url }
      );
    }
  });

  const oversizedResult = await searchOversized('metformin', { attribute: 'GENERAL' });
  assert.equal(MAX_RESPONSE_BYTES, 256 * 1024);
  assert.deepEqual(oversizedResult, { status: 'UNAVAILABLE', candidates: [] });
  assert.equal(oversizedCalls, 1, 'Connector must not retry failed fetches');

  let slowCalls = 0;
  let internalSignalAborted = false;
  const searchSlow = createApprovedMedicineSearch({
    enabled: true,
    fetcher: async (_url, { signal }) => {
      slowCalls += 1;
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            internalSignalAborted = true;
            reject(signal.reason || new Error('Timed out'));
          },
          { once: true }
        );
      });
    }
  });

  const startedAt = Date.now();
  const slowResult = await searchSlow('cetirizine', { attribute: 'USES' });
  const elapsedMs = Date.now() - startedAt;
  assert.deepEqual(slowResult, { status: 'UNAVAILABLE', candidates: [] });
  assert.equal(slowCalls, 1);
  assert.equal(internalSignalAborted, true);
  assert.ok(elapsedMs >= 5800 && elapsedMs < 7500, `Expected ~6s timeout bound, got ${elapsedMs}ms`);
});

test('5. Respects caller AbortSignal cancellation before and during fetch', async () => {
  let preAbortedCalls = 0;
  const searchPreAborted = createApprovedMedicineSearch({
    enabled: true,
    fetcher: async () => {
      preAbortedCalls += 1;
      return makeStreamResponse([SAMPLE_SINGLE_PAGE_HTML]);
    }
  });

  const preController = new AbortController();
  preController.abort(new Error('Caller cancelled before start'));
  await assert.rejects(
    () => searchPreAborted('paracetamol', { attribute: 'GENERAL', signal: preController.signal }),
    /Caller cancelled before start/
  );
  assert.equal(preAbortedCalls, 0);

  let inFlightSignalAborted = false;
  const searchMidFlight = createApprovedMedicineSearch({
    enabled: true,
    fetcher: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            inFlightSignalAborted = true;
            reject(signal.reason);
          },
          { once: true }
        );
      })
  });

  const midController = new AbortController();
  setTimeout(() => midController.abort(new Error('Caller cancelled in flight')), 40);
  await assert.rejects(
    () => searchMidFlight('paracetamol', { attribute: 'USES', signal: midController.signal }),
    /Caller cancelled in flight/
  );
  assert.equal(inFlightSignalAborted, true);
});

test('6. Extracts main article text only, excludes nav/footer/scripts/doses, preserves complete sentences and negations, and bounds excerpts', async () => {
  const longValidSentence =
    'Cetirizine is an antihistamine medicine that relieves allergy symptoms such as hay fever, conjunctivitis, eczema and hives, and it does not cure the underlying allergy.';
  const overlongSentence = `Cetirizine ${'very '.repeat(300)}rarely causes severe problems.`;
  assert.ok(overlongSentence.length > MAX_EXCERPT_LENGTH);

  const customHtml = `<!DOCTYPE html>
<html>
<head><title>About cetirizine - NHS</title></head>
<body>
  <header><p>Header text must not appear.</p></header>
  <nav><p>Breadcrumb navigation must not appear.</p></nav>
  <main>
    <h1>About cetirizine</h1>
    <script>alert("Script payload must not appear.");</script>
    <p>${longValidSentence}</p>
    <p>Incomplete sentence fragment without terminal punctuation</p>
    <p>Adults take one 10mg tablet once a day with water. Do not take more than 10 ml or 2 tablets every 6 hours.</p>
    <p>Unlike some older antihistamines, cetirizine does not usually make you feel drowsy, although some people still experience sleepiness.</p>
    <p>${overlongSentence}</p>
    <p>Information from the British National Formulary (BNF) must not be included.</p>
    <p>Cetirizine is available from pharmacies and supermarkets, and it is also available on prescription.</p>
    <p>If cetirizine makes you dizzy or sleepy, do not drive, cycle, or operate machinery.</p>
    <p>Speak to a pharmacist if cetirizine does not help your allergy symptoms.</p>
    <p>Another complete educational sentence about cetirizine allergy relief.</p>
    <p>Yet another complete educational sentence about cetirizine precautions.</p>
    <p>Final complete educational sentence to exceed three candidate groups.</p>
    <h2>More in Cetirizine</h2>
    <p>Trailing section navigation links must be ignored.</p>
  </main>
  <footer><p>Footer notice must not appear.</p></footer>
</body>
</html>`;

  const search = createApprovedMedicineSearch({
    enabled: true,
    fetcher: async url => makeStreamResponse([customHtml, ''], { url })
  });

  const res = await search('cetirizine', { attribute: 'USES' });
  assert.equal(res.status, 'RETRIEVED');
  assert.ok(res.candidates.length >= 1 && res.candidates.length <= MAX_CANDIDATES);

  const combined = res.candidates.map(c => c.excerpt).join(' ');
  assert.doesNotMatch(combined, /Header text|Breadcrumb navigation|Footer notice|Script payload|Trailing section/i);
  assert.doesNotMatch(combined, /Incomplete sentence fragment/i);
  assert.doesNotMatch(combined, /\b10\s*mg\b|\b10\s*ml\b|\b2\s*tablets\b|once a day|every 6 hours/i);
  assert.doesNotMatch(combined, /British National Formulary|\bBNF\b/i);
  assert.match(combined, /does not cure the underlying allergy/);
  assert.match(combined, /does not usually make you feel drowsy/);

  for (const candidate of res.candidates) {
    assert.ok(candidate.excerpt.length <= MAX_EXCERPT_LENGTH);
    assert.match(candidate.excerpt, /[.!?]$/);
  }
});

test('7. Single-page attribute filtering separates USES and SIDE_EFFECTS and parser mismatch returns UNAVAILABLE', async () => {
  const search = createApprovedMedicineSearch({
    enabled: true,
    fetcher: async url => makeStreamResponse([SAMPLE_SINGLE_PAGE_HTML], { url })
  });

  const usesResult = await search('paracetamol', { attribute: 'USES' });
  assert.equal(usesResult.status, 'RETRIEVED');
  const usesText = usesResult.candidates.map(c => c.excerpt).join(' ');
  assert.match(usesText, /painkiller that helps with pain and high temperature/);
  assert.match(usesText, /does not reduce inflammation/);
  assert.doesNotMatch(usesText, /500mg|4 hours between doses|Support links|Crown copyright/i);

  const sideEffectsResult = await search('paracetamol', { attribute: 'SIDE_EFFECTS' });
  assert.equal(sideEffectsResult.status, 'RETRIEVED');
  const sideEffectsText = sideEffectsResult.candidates.map(c => c.excerpt).join(' ');
  assert.match(sideEffectsText, /rarely causes side effects/);
  assert.match(sideEffectsText, /Do not take paracetamol alongside other medicines/);
  assert.doesNotMatch(sideEffectsText, /500mg|4 hours between doses/i);

  // Live site / parser mismatch without <main> or <article> must return UNAVAILABLE
  const mismatchSearch = createApprovedMedicineSearch({
    enabled: true,
    fetcher: async url => makeStreamResponse(['<html><body><div>Unrecognized layout</div></body></html>'], { url })
  });
  const mismatchResult = await mismatchSearch('paracetamol', { attribute: 'GENERAL' });
  assert.deepEqual(mismatchResult, { status: 'UNAVAILABLE', candidates: [] });
});

test('8. Bounded cache serves within 12-hour TTL, expires after 12 hours, and evicts beyond capacity limit', async () => {
  let clock = 1_700_000_000_000;
  let fetchCalls = 0;

  const search = createApprovedMedicineSearch({
    now: () => clock,
    enabled: true,
    maxCacheEntries: 2,
    fetcher: async url => {
      fetchCalls += 1;
      return makeStreamResponse([SAMPLE_SINGLE_PAGE_HTML], { url });
    }
  });

  assert.equal(CACHE_TTL_MS, 12 * 60 * 60 * 1000);
  assert.equal(MAX_CACHE_ENTRIES, 32);

  const first = await search('paracetamol', { attribute: 'USES' });
  assert.equal(first.status, 'RETRIEVED');
  assert.equal(fetchCalls, 1);

  // Mutating returned candidate must not corrupt cached record
  first.candidates[0].excerpt = 'MUTATED';

  clock += 60 * 1000; // +1 minute (within 12h TTL)
  const second = await search('paracetamol', { attribute: 'USES' });
  assert.equal(second.status, 'CACHED');
  assert.equal(fetchCalls, 1);
  assert.notEqual(second.candidates[0].excerpt, 'MUTATED');

  // Fill cache beyond maxCacheEntries=2 to verify FIFO eviction
  await search('paracetamol', { attribute: 'SIDE_EFFECTS' }); // key 2
  await search('metformin', { attribute: 'GENERAL' }); // key 3 -> evicts key 1 (paracetamol:USES)
  assert.equal(fetchCalls, 3);

  const afterEviction = await search('paracetamol', { attribute: 'USES' });
  assert.equal(afterEviction.status, 'RETRIEVED');
  assert.equal(fetchCalls, 4);

  // Advance clock past 12 hours to verify TTL expiry
  clock += CACHE_TTL_MS + 1;
  const afterExpiry = await search('paracetamol', { attribute: 'USES' });
  assert.equal(afterExpiry.status, 'RETRIEVED');
  assert.equal(fetchCalls, 5);
});
