const crypto = require('node:crypto');

const SCHEMA_VERSION = 'chat-provider-readiness/1.0.0';
const DEFAULT_MODEL = 'gemini-2.5-flash'; // Existing adapter default, not a model-availability claim.
const OBSERVATION_TTL_MS = 5 * 60 * 1000;
const FAILURE_REASONS = new Set(['PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'ANSWER_VALIDATION_FAILED']);
const isModelIdentifier = value => typeof value === 'string' && value === value.trim() && value.length <= 100 && /^gemini-[a-z0-9.-]+$/.test(value);

function configuration(env) {
  const requested = env.RAG_CHAT_LLM_ENABLED === 'true';
  const exportAllowed = env.RAG_CHAT_PUBLIC_EXPORT_ALLOWED === 'true';
  const credential = typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY : '';
  const candidate = env.RAG_CHAT_MODEL || DEFAULT_MODEL;
  const model = isModelIdentifier(candidate) ? candidate : null;
  const reasonCode = !requested ? 'GENERATION_DISABLED' : !exportAllowed ? 'PUBLIC_EXPORT_NOT_ALLOWED'
    : !credential.trim() ? 'MISSING_CREDENTIAL' : !model ? 'INVALID_MODEL' : 'NOT_CHECKED';
  const configured = reasonCode === 'NOT_CHECKED';
  // Internal binding only. Never expose key values, this digest or raw config.
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify([requested, exportAllowed, credential, candidate])).digest('hex');
  return { configured, model, reasonCode, fingerprint, localOnly: !requested || !exportAllowed };
}

function createReadinessMonitor({ environment = () => process.env, now = Date.now, ttlMs = OBSERVATION_TTL_MS } = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > OBSERVATION_TTL_MS) throw new Error('Readiness lifetime must be bounded.');
  let observation = null;
  // Config changes/reverts must not resurrect proof for a previous configuration.
  let currentFingerprint = null;
  let epoch = 0;
  function current() {
    const value = configuration(environment());
    if (currentFingerprint !== value.fingerprint) { currentFingerprint = value.fingerprint; observation = null; epoch++; }
    return value;
  }
  function beginPublicAttempt() {
    const value = current();
    return value.configured ? Object.freeze({ fingerprint: value.fingerprint, epoch }) : null;
  }
  function observePublicAnswer(attempt, result, { privateScope = false, aborted = false } = {}) {
    const value = current();
    if (privateScope || aborted || !value.configured || !attempt || attempt.fingerprint !== value.fingerprint || attempt.epoch !== epoch) return false;
    const success = result?.mode === 'GEMINI_RAG' && result.model === value.model && typeof result.reply === 'string' && result.reply.trim()
      && Array.isArray(result.sources) && result.sources.length > 0;
    const reasonCode = success ? 'LIVE_RESPONSE_VALIDATED'
      : result?.mode === 'LOCAL_EXTRACTIVE' && FAILURE_REASONS.has(result.fallbackReason) ? result.fallbackReason : null;
    if (!reasonCode) return false;
    const checkedAt = now();
    observation = { checkedAt, expiresAt: checkedAt + ttlMs, reasonCode,
      lastSuccessAt: success ? checkedAt : observation?.lastSuccessAt ?? null };
    return true;
  }
  function snapshot() {
    const value = current();
    if (observation && (now() < observation.checkedAt || now() >= observation.expiresAt)) observation.expired = true;
    const fresh = Boolean(observation && !observation.expired);
    const state = value.localOnly ? 'LOCAL_ONLY' : !value.configured ? 'MISCONFIGURED'
      : !fresh ? 'CONFIGURED_UNVERIFIED' : observation.reasonCode === 'LIVE_RESPONSE_VALIDATED' ? 'VERIFIED_RECENTLY' : 'DEGRADED';
    const iso = timestamp => timestamp === null || timestamp === undefined ? null : new Date(timestamp).toISOString();
    return { schemaVersion: SCHEMA_VERSION, state, reasonCode: !value.configured ? value.reasonCode
      : fresh ? observation.reasonCode : observation ? 'CHECK_EXPIRED' : 'NOT_CHECKED',
      configured: value.configured, model: value.model, liveProviderVerified: state === 'VERIFIED_RECENTLY',
      checkedAt: iso(observation?.checkedAt), lastSuccessAt: iso(observation?.lastSuccessAt), expiresAt: iso(observation?.expiresAt),
      verificationScope: observation ? 'PUBLIC_REFERENCE_GENERATION' : 'NONE', privateCasePolicy: 'LOCAL_ONLY', statusDoesNotProbe: true };
  }
  return { beginPublicAttempt, observePublicAnswer, snapshot };
}

const providerReadiness = createReadinessMonitor();
module.exports = { createReadinessMonitor, providerReadiness, isModelIdentifier, DEFAULT_MODEL, OBSERVATION_TTL_MS };
