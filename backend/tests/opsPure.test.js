'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { routePattern, useJson, prometheusText, metricsHandler } = require('../middleware/requestContext');

test('route patterns drop identifiers and query strings', () => {
  assert.equal(routePattern('/api/v1/cases/64b0c0ffee0000000000abcd/reviews?x=secret'), '/api/v1/cases/:id/reviews');
  assert.equal(routePattern('/api/v1/claims/CLM-20261118-ABC123'), '/api/v1/claims/:ref');
  assert.equal(routePattern('/api/x/123e4567-e89b-12d3-a456-426614174000/7'), '/api/x/:uuid/:n');
});

test('JSON logs by default in production, overridable', () => {
  assert.equal(useJson({ NODE_ENV: 'production' }), true);
  assert.equal(useJson({ NODE_ENV: 'development' }), false);
  assert.equal(useJson({ NODE_ENV: 'production', LOG_FORMAT: 'text' }), false);
});

test('Prometheus text has the core series and extra gauges', () => {
  const text = prometheusText({ review_queue_cases: 4 });
  assert.match(text, /pharmavault_http_request_duration_ms_count \d+/);
  assert.match(text, /pharmavault_review_queue_cases 4/);
});

test('metrics endpoint is hidden without a token and needs the exact bearer token', async () => {
  const run = async (token, auth) => {
    const old = process.env.METRICS_TOKEN;
    if (token) process.env.METRICS_TOKEN = token; else delete process.env.METRICS_TOKEN;
    const out = {};
    const res = { status(c) { out.status = c; return this; }, json() { return this; }, setHeader() {}, send(b) { out.status = out.status || 200; out.body = b; } };
    await metricsHandler()({ get: () => auth }, res);
    if (old === undefined) delete process.env.METRICS_TOKEN; else process.env.METRICS_TOKEN = old;
    return out;
  };
  const token = 'm'.repeat(40);
  assert.equal((await run(null, `Bearer ${token}`)).status, 404);
  assert.equal((await run(token, 'Bearer wrong')).status, 401);
  assert.equal((await run(token, `Bearer ${token}`)).status, 200);
});
