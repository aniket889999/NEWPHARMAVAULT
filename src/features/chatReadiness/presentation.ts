export type ReadinessState = 'LOCAL_ONLY' | 'MISCONFIGURED' | 'CONFIGURED_UNVERIFIED' | 'VERIFIED_RECENTLY' | 'DEGRADED';
export interface ProviderReadiness {
  schemaVersion: 'chat-provider-readiness/1.0.0';
  state: ReadinessState;
  reasonCode: string;
  configured: boolean;
  model: string | null;
  liveProviderVerified: boolean;
  checkedAt: string | null;
  lastSuccessAt: string | null;
  expiresAt: string | null;
  verificationScope: 'NONE' | 'PUBLIC_REFERENCE_GENERATION';
  privateCasePolicy: 'LOCAL_ONLY';
  statusDoesNotProbe: true;
}
export interface ChatCapabilities {
  generationEnabled: boolean;
  embeddingEnabled: boolean;
  model: string | null;
  healthReferencePassages: number;
  providerReadiness?: ProviderReadiness;
}
const states = new Set(['LOCAL_ONLY', 'MISCONFIGURED', 'CONFIGURED_UNVERIFIED', 'VERIFIED_RECENTLY', 'DEGRADED']);
const reasons = new Set(['GENERATION_DISABLED', 'PUBLIC_EXPORT_NOT_ALLOWED', 'MISSING_CREDENTIAL', 'INVALID_MODEL', 'NOT_CHECKED', 'CHECK_EXPIRED', 'LIVE_RESPONSE_VALIDATED', 'PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'ANSWER_VALIDATION_FAILED']);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const model = (value: unknown): value is string | null => value === null || typeof value === 'string' && value === value.trim() && value.length <= 100 && /^gemini-[a-z0-9.-]+$/.test(value);
const timestamp = (value: unknown): value is string | null => value === null || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function parseChatCapabilities(value: unknown): ChatCapabilities | null {
  if (!record(value) || typeof value.generationEnabled !== 'boolean' || typeof value.embeddingEnabled !== 'boolean' || !model(value.model)
    || typeof value.healthReferencePassages !== 'number' || !Number.isSafeInteger(value.healthReferencePassages) || value.healthReferencePassages < 0) return null;
  const base: ChatCapabilities = { generationEnabled: value.generationEnabled, embeddingEnabled: value.embeddingEnabled, model: value.model, healthReferencePassages: value.healthReferencePassages };
  if (base.embeddingEnabled && !base.generationEnabled || base.generationEnabled && !base.model) return null;
  const item = value.providerReadiness;
  if (item === undefined) return base; // Older API: configuration only, never live proof.
  if (!record(item) || item.schemaVersion !== 'chat-provider-readiness/1.0.0' || !states.has(String(item.state)) || !reasons.has(String(item.reasonCode))
    || typeof item.configured !== 'boolean' || typeof item.liveProviderVerified !== 'boolean' || !model(item.model)
    || !timestamp(item.checkedAt) || !timestamp(item.lastSuccessAt) || !timestamp(item.expiresAt)
    || !['NONE', 'PUBLIC_REFERENCE_GENERATION'].includes(String(item.verificationScope)) || item.privateCasePolicy !== 'LOCAL_ONLY' || item.statusDoesNotProbe !== true) return null;
  const verified = item.state === 'VERIFIED_RECENTLY';
  if ((item.state === 'LOCAL_ONLY' || item.state === 'MISCONFIGURED') && item.configured
    || ['CONFIGURED_UNVERIFIED', 'VERIFIED_RECENTLY', 'DEGRADED'].includes(String(item.state)) && !item.configured
    || item.configured && item.model !== base.model) return null;
  if (item.state === 'LOCAL_ONLY' && !['GENERATION_DISABLED', 'PUBLIC_EXPORT_NOT_ALLOWED'].includes(String(item.reasonCode))
    || item.state === 'MISCONFIGURED' && !['MISSING_CREDENTIAL', 'INVALID_MODEL'].includes(String(item.reasonCode))
    || item.state === 'CONFIGURED_UNVERIFIED' && !['NOT_CHECKED', 'CHECK_EXPIRED'].includes(String(item.reasonCode))
    || item.state === 'DEGRADED' && (!['PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'ANSWER_VALIDATION_FAILED'].includes(String(item.reasonCode)) || !item.checkedAt || !item.expiresAt || item.verificationScope !== 'PUBLIC_REFERENCE_GENERATION')) return null;
  if (verified !== item.liveProviderVerified || item.configured !== base.generationEnabled
    || verified && (!item.configured || item.model !== base.model || item.reasonCode !== 'LIVE_RESPONSE_VALIDATED' || item.verificationScope !== 'PUBLIC_REFERENCE_GENERATION'
      || !item.checkedAt || !item.expiresAt || item.lastSuccessAt !== item.checkedAt)) return null;
  if (item.checkedAt && item.expiresAt) {
    const lifetime = Date.parse(item.expiresAt as string) - Date.parse(item.checkedAt as string);
    if (lifetime <= 0 || lifetime > 300000) return null;
  } else if (verified) return null;
  if (item.lastSuccessAt && (!item.checkedAt || Date.parse(item.lastSuccessAt as string) > Date.parse(item.checkedAt as string))
    || item.verificationScope === 'NONE' && (item.checkedAt || item.lastSuccessAt || item.expiresAt)) return null;
  base.providerReadiness = { schemaVersion: 'chat-provider-readiness/1.0.0', state: item.state as ReadinessState,
    reasonCode: item.reasonCode as string, configured: item.configured, model: item.model,
    liveProviderVerified: item.liveProviderVerified, checkedAt: item.checkedAt, lastSuccessAt: item.lastSuccessAt, expiresAt: item.expiresAt,
    verificationScope: item.verificationScope as ProviderReadiness['verificationScope'], privateCasePolicy: 'LOCAL_ONLY', statusDoesNotProbe: true };
  return base;
}

export function readinessPresentation(capabilities: ChatCapabilities | null, privateScope = false, now = Date.now()) {
  if (privateScope) return { title: 'Private case evidence · local only', detail: 'Public provider status does not validate private case answers. Check the case sources and human review.', tone: 'neutral', checkedAt: null } as const;
  if (!capabilities) return { title: 'Provider status unavailable', detail: 'Live generation has not been confirmed. No provider request is made by this status check.', tone: 'neutral', checkedAt: null } as const;
  const status = capabilities.providerReadiness;
  if (!status) return capabilities.generationEnabled
    ? { title: 'Gemini configured · live response not verified', detail: 'This server reports configuration only; availability has not been established.', tone: 'neutral', checkedAt: null } as const
    : { title: 'Local source mode · generation is disabled', detail: 'Supported questions use retrieved source notes; no live Gemini response is claimed.', tone: 'neutral', checkedAt: null } as const;
  if (status.state === 'LOCAL_ONLY') return { title: 'Local source mode · generation is disabled', detail: 'Public model generation is not enabled by server policy. Private cases stay local.', tone: 'neutral', checkedAt: null } as const;
  if (status.state === 'MISCONFIGURED') return { title: 'Public generation needs server setup', detail: status.reasonCode === 'MISSING_CREDENTIAL' ? 'The server credential is missing. Local retrieval remains separate.' : 'The server model configuration is invalid. Local retrieval remains separate.', tone: 'warning', checkedAt: null } as const;
  const fresh = status.checkedAt && status.expiresAt && now >= Date.parse(status.checkedAt) && now < Date.parse(status.expiresAt);
  if (!fresh || status.state === 'CONFIGURED_UNVERIFIED') return { title: 'Gemini configured · live response not verified', detail: status.reasonCode === 'CHECK_EXPIRED' || status.checkedAt ? 'The earlier provider observation has expired. Configuration is not proof of availability.' : 'A live public answer has not yet been validated. Each answer still needs source checks.', tone: 'neutral', checkedAt: null } as const;
  if (status.state === 'DEGRADED') return { title: 'Public generation unavailable · source-note fallback', detail: status.reasonCode === 'PROVIDER_RATE_LIMIT' ? 'A recent model request was rate-limited. Supported questions can fall back to local source notes.' : 'A recent model answer could not be validated or completed. Local source notes are labelled separately.', tone: 'warning', checkedAt: status.checkedAt } as const;
  return { title: 'Recent public Gemini response verified', detail: 'Format and citation checks passed at the last observation—not clinical correctness or a guarantee of the next response.', tone: 'verified', checkedAt: status.checkedAt } as const;
}
