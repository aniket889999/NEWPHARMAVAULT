const conversational = require('./conversationalRagService');
const rag = require('./chatRagService');
const { createReadinessMonitor } = require('./chatProviderReadinessService');

const OUTPUT_TOKEN_LIMIT = 1024;
const PROBE_QUESTION = 'Explain human-in-the-loop validation';

async function runPublicProbe({ allowProviderCall = false, fetcher = global.fetch } = {}) {
  const monitor = createReadinessMonitor();
  const before = monitor.snapshot();
  let networkCalls = 0, providerHttpStatus = null;
  const report = (status, readiness) => ({ schemaVersion: 'public-provider-probe/1.0.0', status, readiness,
    liveProviderVerified: readiness.liveProviderVerified, networkCalls, embeddingCalls: 0, providerHttpStatus,
    maximumOutputTokens: OUTPUT_TOKEN_LIMIT, publicPackagedTextOnly: true, automaticRetries: 0,
    scope: 'Direct public-generation adapter diagnostic, not browser/HTTP application acceptance or clinical validation.' });
  if (!allowProviderCall) return report('CONFIGURATION_ONLY', before);
  if (!before.configured) return report('NOT_RUN', before);
  const guide = rag.publicChunks.find(p => p.key === 'human-review');
  if (!guide || guide.private) throw new Error('Packaged public diagnostic source unavailable.');
  const expectedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${before.model}:streamGenerateContent?alt=sse`;
  const boundedFetcher = async (url, options) => {
    if (networkCalls || url !== expectedUrl || options?.method !== 'POST' || typeof options.body !== 'string' || options.body.length > 60000) throw new Error('Diagnostic request boundary rejected.');
    const body = JSON.parse(options.body);
    if (body.contents?.length !== 1 || body.contents[0].parts?.length !== 1) throw new Error('Diagnostic context boundary rejected.');
    const context = JSON.parse(body.contents[0].parts[0].text);
    const onlySource = context.passages?.[0];
    if (Object.keys(context).sort().join(',') !== 'intent,passages,topicTerms' || context.passages.length !== 1 ||
      onlySource?.sourceId !== 'E1' || onlySource.title !== guide.title || onlySource.text !== guide.excerpt ||
      !Array.isArray(context.topicTerms) || context.topicTerms.some(term => !rag.tokens(`${guide.title} ${guide.excerpt}`).includes(term))) throw new Error('Non-packaged diagnostic context rejected.');
    body.generationConfig = { ...body.generationConfig, maxOutputTokens: OUTPUT_TOKEN_LIMIT };
    networkCalls++;
    const response = await fetcher(url, { ...options, body: JSON.stringify(body), redirect: 'error' });
    if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) providerHttpStatus = response.status;
    return response;
  };
  const attempt = monitor.beginPublicAttempt();
  const result = await conversational.answer({ message: PROBE_QUESTION, history: [] }, {
    signal: AbortSignal.timeout(30000), fetcher: boundedFetcher,
    retrieve: async () => ({ passages: [{ ...guide, score: 1 }], method: 'BM25' })
  });
  monitor.observePublicAnswer(attempt, result);
  const readiness = monitor.snapshot();
  const verified = networkCalls === 1 && providerHttpStatus >= 200 && providerHttpStatus < 300 && readiness.liveProviderVerified;
  return report(verified ? 'VERIFIED' : networkCalls ? 'UNAVAILABLE' : 'NOT_RUN', readiness);
}

module.exports = { runPublicProbe, OUTPUT_TOKEN_LIMIT };
