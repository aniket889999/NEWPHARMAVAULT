'use strict';
const TOOLS = ['MODEL', 'EMBEDDING', 'WEB'];
const integer = (value, fallback, maximum) => /^\d+$/.test(String(value || '')) && +value > 0 ? Math.min(+value, maximum) : fallback;
function limits(environment = process.env) {
  return { concurrency: integer(environment.CHAT_TOOL_MAX_CONCURRENCY, 2, 10),
    requestsPerMinute: integer(environment.CHAT_TOOL_REQUESTS_PER_MINUTE, 20, 100),
    failuresToOpen: integer(environment.CHAT_TOOL_CIRCUIT_FAILURES, 3, 10),
    cooldownMs: integer(environment.CHAT_TOOL_CIRCUIT_COOLDOWN_MS, 60000, 300000) };
}
function blocked(reason, retryAfterSeconds = 1) {
  return Object.assign(new Error('This external tool is temporarily unavailable. Local evidence remains available.'), { statusCode: 503, fallbackReason: reason, retryAfterSeconds });
}
function createToolControls({ now = Date.now, configuration = limits } = {}) {
  const states = new Map(TOOLS.map(tool => [tool, { active: 0, window: now(), requests: 0, failures: 0, openUntil: 0, blocked: 0 }]));
  const state = tool => { if (!states.has(tool)) throw new Error('Unknown tool category.'); return states.get(tool); };
  function refresh(value) { if (now() < value.window || now() - value.window >= 60000) { value.window = now(); value.requests = 0; } }
  async function run(tool, action, { signal } = {}) {
    signal?.throwIfAborted();
    const value = state(tool), config = configuration(); refresh(value);
    const deny = reason => { value.blocked++; throw blocked(reason, Math.max(1, Math.ceil((value.openUntil - now()) / 1000))); };
    if (value.openUntil > now()) deny('LOCAL_TOOL_CIRCUIT_OPEN');
    if (value.active >= config.concurrency) deny('LOCAL_TOOL_BUSY');
    if (value.requests >= config.requestsPerMinute) deny('LOCAL_TOOL_BUDGET_EXCEEDED');
    value.requests++; value.active++;
    try {
      const result = await action();
      // An older in-flight success must not close a circuit opened by a newer
      // failure. Recovery is allowed only once its cooldown has elapsed.
      if (value.openUntil <= now()) { value.failures = 0; value.openUntil = 0; }
      return result;
    } catch (error) {
      if (!signal?.aborted) { value.failures++; if (value.failures >= config.failuresToOpen) value.openUntil = now() + config.cooldownMs; }
      throw error;
    } finally { value.active--; }
  }
  function snapshot() {
    return { scope: 'PROCESS_LOCAL_NOT_GLOBAL_SPEND_ACCOUNTING', limits: configuration(), tools: Object.fromEntries(TOOLS.map(tool => {
      const value = state(tool); refresh(value);
      return [tool, { active: value.active, requestsThisMinute: value.requests, blocked: value.blocked, circuitOpen: value.openUntil > now() }];
    })) };
  }
  return { run, snapshot };
}
const toolControls = createToolControls();
module.exports = { createToolControls, toolControls, limits };
