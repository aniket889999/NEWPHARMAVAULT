'use strict';

/**
 * Request IDs, structured access logs and in-process metrics.
 *
 * - Every response carries X-Request-Id (a caller-supplied id is reused when it is a
 *   safe token, so a reverse proxy id flows through).
 * - Access log: one line per request. LOG_FORMAT=json (default in production) gives JSON
 *   for log shippers. Only metadata is logged: no query strings, bodies, headers,
 *   filenames or OCR text. The path is reduced to a route pattern (ids → :id).
 * - Metrics: counters and a latency histogram, exposed by metricsHandler in the
 *   Prometheus text format.
 */
const crypto = require('node:crypto');

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;
const BUCKETS_MS = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const metrics = {
  startedAt: Date.now(),
  requests: new Map(), // `${method} ${statusClass}` -> count
  buckets: new Array(BUCKETS_MS.length).fill(0),
  durationSumMs: 0,
  durationCount: 0,
  inFlight: 0
};

/** Turns /api/v1/cases/64b.../reviews into /api/v1/cases/:id/reviews (no identifiers in logs). */
function routePattern(originalUrl) {
  return String(originalUrl || '').split('?')[0]
    .replace(/\/[a-f\d]{24}(?=\/|$)/gi, '/:id')
    .replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, '/:uuid')
    .replace(/\/(CLM|CASE)-[A-Z0-9-]+(?=\/|$)/g, '/:ref')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
    .slice(0, 200);
}

function useJson(env = process.env) {
  if (env.LOG_FORMAT) return env.LOG_FORMAT === 'json';
  return env.NODE_ENV === 'production';
}

function record(method, status, ms) {
  const key = `${method} ${Math.floor(status / 100)}xx`;
  metrics.requests.set(key, (metrics.requests.get(key) || 0) + 1);
  metrics.durationSumMs += ms;
  metrics.durationCount += 1;
  for (let i = 0; i < BUCKETS_MS.length; i += 1) if (ms <= BUCKETS_MS[i]) metrics.buckets[i] += 1;
}

function requestContext(req, res, next) {
  const incoming = req.get('X-Request-Id');
  const id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  const start = process.hrtime.bigint();
  metrics.inFlight += 1;
  res.on('finish', () => {
    metrics.inFlight -= 1;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    record(req.method, res.statusCode, ms);
    if (process.env.NODE_ENV === 'test') return;
    const entry = {
      ts: new Date().toISOString(), level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      msg: 'request', reqId: id, method: req.method, route: routePattern(req.originalUrl), status: res.statusCode,
      ms: Math.round(ms), role: req.user?.role || null
    };
    console.log(useJson() ? JSON.stringify(entry) : `[${entry.ts}] ${entry.reqId.slice(0, 8)} ${entry.method} ${entry.route} ${entry.status} - ${entry.ms}ms`);
  });
  next();
}

function prometheusText(extra = {}) {
  const lines = [];
  lines.push('# HELP pharmavault_http_requests_total HTTP requests by method and status class');
  lines.push('# TYPE pharmavault_http_requests_total counter');
  for (const [key, count] of metrics.requests) {
    const [method, cls] = key.split(' ');
    lines.push(`pharmavault_http_requests_total{method="${method}",status="${cls}"} ${count}`);
  }
  lines.push('# HELP pharmavault_http_request_duration_ms Request latency');
  lines.push('# TYPE pharmavault_http_request_duration_ms histogram');
  BUCKETS_MS.forEach((le, i) => lines.push(`pharmavault_http_request_duration_ms_bucket{le="${le}"} ${metrics.buckets[i]}`));
  lines.push(`pharmavault_http_request_duration_ms_bucket{le="+Inf"} ${metrics.durationCount}`);
  lines.push(`pharmavault_http_request_duration_ms_sum ${Math.round(metrics.durationSumMs)}`);
  lines.push(`pharmavault_http_request_duration_ms_count ${metrics.durationCount}`);
  lines.push('# TYPE pharmavault_http_requests_in_flight gauge');
  lines.push(`pharmavault_http_requests_in_flight ${metrics.inFlight}`);
  lines.push('# TYPE pharmavault_process_uptime_seconds gauge');
  lines.push(`pharmavault_process_uptime_seconds ${Math.round((Date.now() - metrics.startedAt) / 1000)}`);
  lines.push('# TYPE pharmavault_process_resident_memory_bytes gauge');
  lines.push(`pharmavault_process_resident_memory_bytes ${process.memoryUsage().rss}`);
  for (const [name, value] of Object.entries(extra)) {
    lines.push(`# TYPE pharmavault_${name} gauge`);
    lines.push(`pharmavault_${name} ${Number(value) || 0}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * GET /api/metrics — needs METRICS_TOKEN (32+ chars) as a bearer token; 404 when unset,
 * so the endpoint does not exist unless operations turn it on.
 */
function metricsHandler(gauges = async () => ({})) {
  return async (req, res) => {
    const token = process.env.METRICS_TOKEN;
    if (!token || token.length < 32) return res.status(404).json({ message: 'Not found' });
    const supplied = String(req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(supplied), b = Buffer.from(token);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ message: 'Unauthorized' });
    let extra = {};
    try { extra = await gauges(); } catch { extra = { gauge_errors: 1 }; }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.setHeader('Cache-Control', 'no-store');
    res.send(prometheusText(extra));
  };
}

module.exports = { requestContext, metricsHandler, prometheusText, routePattern, useJson, metrics };
