const { assertPrepared, normalizeOutput } = require('./comparisonContract');
const ENDPOINTS = Object.freeze({ GPT: 'https://api.openai.com/v1/responses', CLAUDE: 'https://api.anthropic.com/v1/messages' });
const controlled = Symbol('controlled-benchmark-failure');
const failure = code => Object.assign(new Error('Public benchmark request did not complete.'), { code, [controlled]: true });
function requestFor(provider, task, config) {
  assertPrepared(task);
  const model = provider === 'GPT' ? config.OPENAI_BENCHMARK_MODEL : config.ANTHROPIC_BENCHMARK_MODEL;
  const key = provider === 'GPT' ? config.OPENAI_API_KEY : config.ANTHROPIC_API_KEY;
  if (!ENDPOINTS[provider] || typeof key !== 'string' || !key.trim() || /\s/.test(key) || typeof model !== 'string' || /\s/.test(model) || !new RegExp(provider === 'GPT' ? '^gpt-[a-z0-9.-]+$' : '^claude-[a-z0-9.-]+$').test(model)) throw failure('NOT_CONFIGURED');
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key };
  let body;
  if (provider === 'GPT') body = { model, instructions: task.instruction, input: task.input, max_output_tokens: 1024, store: false, tools: [], text: { format: { type: 'json_schema', name: 'public_evidence_comparison', strict: true, schema: task.schema } } };
  else {
    headers['anthropic-version'] = '2026-10-21';
    if (config.ANTHROPIC_WORKSPACE_ID) {
      if (!/^wrkspc_[a-zA-Z0-9]+$/.test(config.ANTHROPIC_WORKSPACE_ID) || /\s/.test(config.ANTHROPIC_WORKSPACE_ID)) throw failure('NOT_CONFIGURED');
      headers['anthropic-workspace-id'] = config.ANTHROPIC_WORKSPACE_ID;
    }
    body = { model, system: task.instruction, messages: [{ role: 'user', content: task.input }], max_tokens: 1024, tools: [], output_config: { format: { type: 'json_schema', schema: task.schema } } };
  }
  const serialized = JSON.stringify(body);
  // Count the entire serialized body (including schema), stricter than just
  // counting the evidence/user input. No automatic model-list/probe requests.
  if (serialized.length > 8000) throw failure('INPUT_LIMIT');
  return { endpoint: ENDPOINTS[provider], model, headers, body: serialized };
}
async function boundedJson(response) {
  if (!response.ok) { await response.body?.cancel().catch(() => {}); throw failure(response.status === 429 ? 'PROVIDER_RATE_LIMIT' : [401, 403].includes(response.status) ? 'PROVIDER_AUTH_FAILED' : 'PROVIDER_HTTP_ERROR'); }
  if (!/application\/json/i.test(response.headers.get('content-type') || '')) throw failure('INVALID_RESPONSE_TYPE');
  const reader = response.body?.getReader(); if (!reader) throw failure('MISSING_RESPONSE_BODY');
  let text = '', bytes = 0; const decoder = new TextDecoder();
  try {
    while (true) { const item = await reader.read(); bytes += item.value?.length || 0; if (bytes > 131072) throw failure('RESPONSE_LIMIT'); text += decoder.decode(item.value || new Uint8Array(), { stream: !item.done }); if (item.done) break; }
    return JSON.parse(text);
  } finally { await reader.cancel().catch(() => {}); }
}
const tokenCount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
async function generate(provider, task, config, { fetcher = (...args) => fetch(...args), signal, beforeRequest } = {}) {
  const request = requestFor(provider, task, config); signal?.throwIfAborted();
  if (typeof beforeRequest !== 'function') throw failure('BUDGET_REQUIRED');
  const combined = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
  // The budget is reserved durably BEFORE network egress; even an HTTP error,
  // timeout or interrupted process consumes its one attempt. Never retry.
  beforeRequest(provider, { model: request.model, inputCharacters: request.body.length, maxOutputTokens: 1024 });
  try {
    const value = await boundedJson(await fetcher(request.endpoint, { method: 'POST', headers: request.headers, body: request.body, redirect: 'error', signal: combined }));
    let text, usage;
    if (provider === 'GPT') {
      if (value.status !== 'completed') throw failure('INCOMPLETE_OUTPUT');
      if (!Array.isArray(value.output) || value.output.some(item => item.type !== 'message' && item.type !== 'reasoning')) throw failure('UNEXPECTED_PROVIDER_OUTPUT');
      const parts = value.output.filter(item => item.type === 'message').flatMap(item => item.content || []);
      if (parts.some(item => item.type === 'refusal')) throw failure('PROVIDER_REFUSAL');
      if (parts.some(item => item.type !== 'output_text')) throw failure('UNEXPECTED_PROVIDER_OUTPUT');
      text = parts.map(item => item.text || '').join('');
      usage = { inputTokens: tokenCount(value.usage?.input_tokens), outputTokens: tokenCount(value.usage?.output_tokens), reasoningTokens: tokenCount(value.usage?.output_tokens_details?.reasoning_tokens) };
    } else {
      if (value.stop_reason !== 'end_turn') throw failure(value.stop_reason === 'refusal' ? 'PROVIDER_REFUSAL' : 'INCOMPLETE_OUTPUT');
      if (!Array.isArray(value.content) || value.content.some(item => item.type !== 'text')) throw failure('UNEXPECTED_PROVIDER_OUTPUT');
      text = value.content.map(item => item.text || '').join('');
      usage = { inputTokens: tokenCount(value.usage?.input_tokens), outputTokens: tokenCount(value.usage?.output_tokens), cacheReadInputTokens: tokenCount(value.usage?.cache_read_input_tokens), cacheCreationInputTokens: tokenCount(value.usage?.cache_creation_input_tokens) };
    }
    const answer = normalizeOutput(JSON.parse(text));
    const credential = provider === 'GPT' ? config.OPENAI_API_KEY : config.ANTHROPIC_API_KEY;
    if (JSON.stringify(answer).includes(credential)) throw failure('CREDENTIAL_ECHO_DENIED');
    const returnedModel = typeof value.model === 'string' && !/\s/.test(value.model) && /^(?:gpt|claude)-[a-z0-9.-]+$/.test(value.model) ? value.model : null;
    return { answer, model: request.model, returnedModel, usage, inputCharacters: request.body.length, maxOutputTokens: 1024 };
  } catch (error) {
    if (error?.[controlled]) throw error;
    throw failure(combined.aborted ? 'REQUEST_ABORTED_OR_TIMEOUT' : error instanceof SyntaxError ? 'INVALID_PROVIDER_JSON' : 'NETWORK_OR_FORMAT_FAILURE');
  }
}
module.exports = { requestFor, generate, ENDPOINTS };
