const { getAllowedOrigins } = require('./productionSecurity');

const WEB_AUDIENCE = 'pharmavault-web';
const WEB_TTL_SECONDS = 15 * 60;
const NATIVE_TTL_SECONDS = 60 * 60;
const isWebClient = req => req.get('X-PharmaVault-Client') === 'web';
const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-pv_session' : 'pv_session';
const failCSRF = () => Object.assign(new Error('Browser request origin could not be verified.'), { statusCode: 403 });

function verifyBrowserMutation(req) {
  // SameSite is defense in depth, not the only CSRF control. A custom header
  // forces cross-origin preflight and the exact origin must also be allowed.
  if (!isWebClient(req) || !getAllowedOrigins().includes(req.get('Origin'))) throw failCSRF();
  if (req.get('Content-Type') && !req.is('application/json')) throw Object.assign(new Error('Browser mutations require JSON.'), { statusCode: 415 });
}

function readBrowserCookie(req) {
  const raw = req.get('Cookie') || '';
  if (raw.length > 8192) return null;
  const values = raw.split(';').map(value => value.trim()).filter(value => value.startsWith(cookieName() + '='));
  // Reject duplicate/ambiguous cookies. Production never accepts the unprefixed
  // development cookie and no caller-controlled cookie name is supported.
  if (values.length !== 1) return null;
  const token = values[0].slice(cookieName().length + 1);
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) && token.length < 4096 ? token : null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Strict everywhere: the dev frontend (localhost:5173) and API (localhost:5001) are same-site,
    // so Strict works locally as long as both use the same hostname (see apiClient baseURL).
    sameSite: 'strict',
    path: '/'
  };
}
function setBrowserSession(res, token) {
  res.cookie(cookieName(), token, { ...cookieOptions(), maxAge: WEB_TTL_SECONDS * 1000 });
}
function clearBrowserSession(res) { res.clearCookie(cookieName(), cookieOptions()); }

module.exports = { WEB_AUDIENCE, WEB_TTL_SECONDS, NATIVE_TTL_SECONDS, isWebClient, cookieName, verifyBrowserMutation, readBrowserCookie, setBrowserSession, clearBrowserSession };
