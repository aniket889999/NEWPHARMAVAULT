const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/pharmavault_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-not-for-production';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';

test('Security Validation Suite', async (t) => {
  // Test missing configs
  await t.test('Missing JWT_SECRET throws controlled configuration error', (t) => {
    const { validateEnv } = require('../config/envValidator');
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    
    let errorThrown = false;
    try {
      validateEnv();
    } catch (e) {
      errorThrown = true;
      assert.match(e.message, /Missing required environment variables.*JWT_SECRET/);
      assert.doesNotMatch(e.message, /fake_secret|real_secret/i, "Secrets must not be logged in config error");
    }
    
    assert.strictEqual(errorThrown, true, "envValidator should throw when JWT_SECRET is missing");
    if (originalSecret !== undefined) process.env.JWT_SECRET = originalSecret;
  });

  await t.test('Missing GEMINI_API_KEY throws controlled configuration error', (t) => {
    const { validateEnv } = require('../config/envValidator');
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    
    let errorThrown = false;
    try {
      validateEnv();
    } catch (e) {
      errorThrown = true;
      assert.match(e.message, /Missing required environment variables.*GEMINI_API_KEY/);
    }
    
    assert.strictEqual(errorThrown, true, "envValidator should throw when GEMINI_API_KEY is missing");
    if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
  });

  await t.test('Missing MONGO_URI throws controlled configuration error', (t) => {
    const { validateEnv } = require('../config/envValidator');
    const originalUri = process.env.MONGO_URI;
    delete process.env.MONGO_URI;
    
    let errorThrown = false;
    try {
      validateEnv();
    } catch (e) {
      errorThrown = true;
      assert.match(e.message, /Missing required environment variables.*MONGO_URI/);
    }
    
    assert.strictEqual(errorThrown, true, "envValidator should throw when MONGO_URI is missing");
    if (originalUri !== undefined) process.env.MONGO_URI = originalUri;
  });

  // Load app for HTTP tests
  const app = require('../app');

  await t.test('Unauthenticated AI endpoints return 401', async (t) => {
    const endpoints = [
      { method: 'post', path: '/api/chat' },
      { method: 'post', path: '/api/chat/vision-ocr' },
      { method: 'post', path: '/api/agents/orchestrate' },
      { method: 'post', path: '/api/graphrag/query' },
      { method: 'post', path: '/api/prescriptions/analyze' }
    ];

    for (const ep of endpoints) {
      const res = await request(app)[ep.method](ep.path);
      assert.strictEqual(res.status, 401, `Expected 401 for ${ep.method.toUpperCase()} ${ep.path}, got ${res.status}`);
      assert.strictEqual(res.body.message, 'Not authorized, no token', 'Should return correct error message');
    }
  });

  await t.test('Role cannot be spoofed (middleware uses token role)', async (t) => {
    const jwt = require('jsonwebtoken');
    const User = require('../models/userModel');
    const orchestrator = require('../agents/orchestrator');
    
    const originalFindById = User.findById;
    User.findById = (id) => {
      return {
        select: () => Promise.resolve({ _id: id, role: 'patient' })
      };
    };

    const originalRun = orchestrator.run;
    let passedRole = null;
    orchestrator.run = async (query, userRole, userId, tenantContext) => {
      passedRole = userRole;
      return { answer: 'mocked' };
    };

    try {
      const token = jwt.sign({ id: 'fakeid' }, process.env.JWT_SECRET);
      
      const res = await request(app)
        .post('/api/agents/orchestrate')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'test', userRole: 'admin' });

      assert.strictEqual(res.status, 200, 'Request should succeed');
      assert.strictEqual(passedRole, 'patient', 'Should pass patient to orchestrator.run');
      assert.notStrictEqual(passedRole, 'admin', 'Admin should never be passed');
    } finally {
      User.findById = originalFindById;
      orchestrator.run = originalRun;
    }
  });

  await t.test('Invalid base64 payload to Vision OCR returns 400', async (t) => {
    const jwt = require('jsonwebtoken');
    const User = require('../models/userModel');
    const originalFindById = User.findById;
    User.findById = (id) => ({ select: () => Promise.resolve({ _id: id, role: 'patient' }) });

    try {
      const token = jwt.sign({ id: 'fakeid' }, process.env.JWT_SECRET);
      const res = await request(app)
        .post('/api/chat/vision-ocr')
        .set('Authorization', `Bearer ${token}`)
        .send({ imageBase64: 'data:image/png;base64,not!valid!base64' });

      assert.strictEqual(res.status, 400, 'Should reject malformed base64 with 400');
    } finally {
      User.findById = originalFindById;
    }
  });

  await t.test('Rate limit triggers 429 after max requests', async (t) => {
    const { authLimiter } = require('../middleware/rateLimiter');
    const express = require('express');
    const testApp = express();
    testApp.post('/api/test-limit', authLimiter, (req, res) => res.json({ success: true }));

    let lastStatus = 200;
    // By default authLimiter is set to 10. We send 15.
    for (let i = 0; i < 15; i++) {
      const res = await request(testApp).post('/api/test-limit');
      lastStatus = res.status;
    }
    
    assert.strictEqual(lastStatus, 429, 'Rate limiter should return 429 Too Many Requests');
  });
});
