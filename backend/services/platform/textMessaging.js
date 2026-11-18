'use strict';

/**
 * Opt-in SMS / WhatsApp alerts for claimants. Off unless NOTIFY_TEXT_ENABLED=true and a
 * gateway is configured. Messages never carry case content (no names, medicines or amounts):
 * only "something changed, open the app".
 *
 * Gateway: TEXT_GATEWAY_URL receives POST {to, channel, text} with
 * Authorization: Bearer TEXT_GATEWAY_TOKEN. Point it at a small adapter for your provider
 * (MSG91, Gupshup, Twilio…). Indian SMS needs DLT-registered templates — the texts below
 * are written to be registered as templates.
 */
const E164_INDIA = /^\+91[6-9]\d{9}$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const MAX_ATTEMPTS = 3;

// Only events where the claimant must act or learns an outcome.
const TEXT_TEMPLATES = Object.freeze({
  CLAIM_QUERY_RAISED: 'PharmaVault: your insurer has a question about your claim. Please open the app to answer.',
  CLAIM_DECIDED: 'PharmaVault: your insurer has decided your claim. Open the app to see the decision.',
  CLAIM_SETTLED: 'PharmaVault: your claim has been marked settled. Open the app for details.'
});

function textEnabled(env = process.env) {
  return env.NOTIFY_TEXT_ENABLED === 'true' && /^https:\/\//.test(env.TEXT_GATEWAY_URL || '') && (env.TEXT_GATEWAY_TOKEN || '').length >= 16;
}

function normalizePhone(raw) {
  let value = String(raw || '').replace(/[\s()-]/g, '');
  if (/^[6-9]\d{9}$/.test(value)) value = `+91${value}`;
  if (/^0[6-9]\d{9}$/.test(value)) value = `+91${value.slice(1)}`;
  if (!E164.test(value) || (value.startsWith('+91') && !E164_INDIA.test(value))) {
    throw Object.assign(new Error('Enter a valid mobile number, e.g. 98765 43210 or +91 98765 43210.'), { statusCode: 400, code: 'INVALID_PHONE' });
  }
  return value;
}

const maskPhone = (value) => (value ? `${value.slice(0, 3)} ••••• ${value.slice(-3)}` : null);

async function sendText({ to, channel, text }, env = process.env, fetchImpl = globalThis.fetch) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetchImpl(env.TEXT_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.TEXT_GATEWAY_TOKEN}` },
        body: JSON.stringify({ to, channel, text }),
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) return { sent: true, attempts: attempt };
      if (res.status < 500 && res.status !== 429) return { sent: false, attempts: attempt, error: `HTTP_${res.status}` };
    } catch {
      /* network error: retry */
    }
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  return { sent: false, attempts: MAX_ATTEMPTS, error: 'GATEWAY_UNAVAILABLE' };
}

module.exports = { TEXT_TEMPLATES, textEnabled, normalizePhone, maskPhone, sendText };
