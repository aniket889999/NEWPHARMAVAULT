'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');

test('browser sessions: real HTTP, durable revocation and native compatibility', async t => {
  const keys = ['NODE_ENV', 'MONGO_URI', 'JWT_SECRET', 'GEMINI_API_KEY', 'CORS_ALLOWED_ORIGINS', 'RATE_LIMIT_AUTH_MAX', 'RAG_CHAT_LLM_ENABLED', 'RAG_CHAT_PUBLIC_EXPORT_ALLOWED', 'RAG_CHAT_WEB_ENABLED'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const origin = 'http://127.0.0.1:5177';
  Object.assign(process.env, { NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/pharmavault_smoke_test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), GEMINI_API_KEY: 'synthetic-unused', CORS_ALLOWED_ORIGINS: origin, RATE_LIMIT_AUTH_MAX: '100', RAG_CHAT_LLM_ENABLED: 'false', RAG_CHAT_PUBLIC_EXPORT_ALLOWED: 'false', RAG_CHAT_WEB_ENABLED: 'false' });
  const mongoose = require('mongoose'), User = require('../models/userModel');
  const { assertTestDatabase } = require('../utils/testDatabaseGuard');
  const sessions = require('../config/browserSession'), generateToken = require('../utils/generateToken');
  const app = require('../app');
  const ids = [], orgIds = [], branchIds = []; let connected = false;
  t.after(async () => {
    if (connected) { assertTestDatabase(mongoose.connection); await User.deleteMany({ _id: { $in: ids } }); await require('../models/branchModel').deleteMany({ _id: { $in: branchIds } }); await require('../models/organizationModel').deleteMany({ _id: { $in: orgIds } }); await mongoose.disconnect(); }
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  assertTestDatabase(process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 }); connected = true; assertTestDatabase(mongoose.connection);
  const password = 'Synthetic-session-passphrase-only';
  const user = await User.create({ name: 'Synthetic session user', email: crypto.randomUUID() + '@example.invalid', password, role: 'patient' }); ids.push(user._id);
  const body = { email: user.email, password, role: 'patient' };
  const web = (method, url) => request(app)[method](url).set('Origin', origin).set('X-PharmaVault-Client', 'web');
  let cookie, cookieToken, nativeToken;
  const cookieOf = response => response.headers['set-cookie'][0].split(';')[0];

  await t.test('web login returns an HttpOnly SameSite cookie, not a token in JSON', async () => {
    const result = await web('post', '/api/users/login').send(body);
    assert.equal(result.status, 200); assert.equal(result.body.session, 'HTTP_ONLY_COOKIE'); assert.equal(result.body.token, undefined); assert.equal(result.body.sessionVersion, undefined); assert.equal(result.body.password, undefined);
    const header = result.headers['set-cookie'][0]; assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/); assert.match(header, /Path=\//); assert.match(header, /Max-Age=900/); assert.doesNotMatch(header, /Domain=/);
    cookie = cookieOf(result); cookieToken = cookie.split('=')[1];
    const decoded = jwt.verify(cookieToken, process.env.JWT_SECRET); assert.equal(decoded.exp - decoded.iat, 900); assert.equal(decoded.aud, sessions.WEB_AUDIENCE); assert.equal(decoded.ver, 0); assert.ok(decoded.jti);
    const profile = await web('get', '/api/users/profile').set('Cookie', cookie); assert.equal(profile.status, 200); assert.equal(profile.body._id, String(user._id)); assert.equal(profile.body.token, undefined);
  });
  await t.test('production cookie uses host prefix and secure flags without accepting development cookies', () => {
    const before = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
    try {
      const express = require('express'); const options = [];
      sessions.setBrowserSession({ cookie: (...args) => options.push(args) }, 'synthetic');
      assert.equal(options[0][0], '__Host-pv_session'); assert.equal(options[0][2].secure, true); assert.equal(options[0][2].httpOnly, true); assert.equal(options[0][2].sameSite, 'strict'); assert.equal(options[0][2].path, '/'); assert.equal(options[0][2].domain, undefined);
      assert.equal(sessions.readBrowserCookie({ get: () => cookie }), null); assert.equal(typeof express, 'function');
    } finally { process.env.NODE_ENV = before; }
  });
  await t.test('web login CSRF rejects missing/unapproved origins, missing custom header and non-JSON bodies', async () => {
    assert.equal((await request(app).post('/api/users/login').set('X-PharmaVault-Client', 'web').send(body)).status, 403);
    assert.equal((await request(app).post('/api/users/login').set('X-PharmaVault-Client', 'web').set('Origin', 'https://evil.example').send(body)).status, 403);
    assert.equal((await web('post', '/api/users/login').type('form').send(body)).status, 415);
    // A missing web header retains the explicit bearer/native compatibility path,
    // not a browser cookie. That path does not consume a victim's cookie.
    const native = await request(app).post('/api/users/login').send(body);
    assert.equal(native.status, 200); assert.ok(native.body.token); assert.equal(native.headers['set-cookie'], undefined); nativeToken = native.body.token;
  });
  await t.test('cookie mutations require origin and custom header; cookie and bearer audiences cannot be confused', async () => {
    assert.equal((await request(app).post('/api/v1/chat').set('Cookie', cookie).send({ message: 'What is RAG?' })).status, 403);
    assert.equal((await request(app).post('/api/v1/chat').set('Cookie', cookie).set('Origin', origin).send({ message: 'What is RAG?' })).status, 403);
    const result = await web('post', '/api/v1/chat').set('Cookie', cookie).send({ message: 'What is RAG?' }); assert.equal(result.status, 200); assert.ok(result.body.sources.length);
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + cookieToken)).status, 401);
    assert.equal((await request(app).get('/api/users/profile').set('Cookie', 'pv_session=' + nativeToken)).status, 401);
  });
  await t.test('malformed/duplicate cookies and malformed authorization never fall back to another credential', async () => {
    for (const value of ['pv_session=invalid', cookie + '; ' + cookie, cookie + '; ' + cookie.replace(/.$/, 'x')]) assert.equal((await request(app).get('/api/users/profile').set('Cookie', value)).status, 401);
    assert.equal((await web('get', '/api/users/profile').set('Cookie', cookie).set('Authorization', 'Basic something')).status, 401);
  });
  await t.test('native client gets a one-hour bearer token and remains independent of cookie CSRF', async () => {
    const decoded = jwt.verify(nativeToken, process.env.JWT_SECRET); assert.equal(decoded.exp - decoded.iat, 3600); assert.equal(decoded.aud, 'pharmavault-api');
    const profile = await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + nativeToken); assert.equal(profile.status, 200);
    assert.equal((await request(app).post('/api/v1/chat').set('Authorization', 'Bearer ' + nativeToken).send({ message: 'What is RAG?' })).status, 200);
  });
  await t.test('logout durably revokes both existing browser and native sessions, and clears the cookie', async () => {
    const result = await web('post', '/api/users/logout').set('Cookie', cookie).send({}); assert.equal(result.status, 204); assert.match(result.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/); assert.match(result.headers['set-cookie'][0], /HttpOnly/);
    assert.equal((await request(app).get('/api/users/profile').set('Cookie', cookie)).status, 401);
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + nativeToken)).status, 401);
    const stored = await User.findById(user._id).select('+sessionVersion'); assert.equal(stored.sessionVersion, 1);
    const fresh = await request(app).post('/api/users/login').send(body); assert.equal(fresh.status, 200); assert.equal(jwt.decode(fresh.body.token).ver, 1); nativeToken = fresh.body.token;
  });
  await t.test('saving non-password fields never rehashes the password or revokes the session', async () => {
    const current = await User.findById(user._id).select('+sessionVersion'); const hash = current.password;
    current.name = 'Synthetic renamed user'; await current.save();
    const reread = await User.findById(user._id).select('+sessionVersion'); assert.equal(reread.password, hash); assert.equal(reread.sessionVersion, 1); assert.equal(await reread.matchPassword(password), true);
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + nativeToken)).status, 200);
  });
  await t.test('password change increments the durable version even when the field was not selected', async () => {
    const current = await User.findById(user._id); assert.equal(current.sessionVersion, undefined);
    current.password = 'A-new-synthetic-passphrase-only'; await current.save();
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + nativeToken)).status, 401);
    const stored = await User.findById(user._id).select('+sessionVersion'); assert.equal(stored.sessionVersion, 2); assert.equal(await stored.matchPassword('A-new-synthetic-passphrase-only'), true);
  });
  await t.test('expired, unbounded, wrong-audience and wrong-algorithm tokens are rejected before database lookup', async () => {
    for (const options of [{ expiresIn: -1 }, {}, { algorithm: 'HS512', expiresIn: '1h' }]) {
      const token = jwt.sign({ id: String(user._id), ver: 2 }, process.env.JWT_SECRET, options);
      assert.equal((await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + token)).status, 401);
    }
    const old = jwt.sign({ id: String(user._id), ver: 2, iat: Math.floor(Date.now() / 1000) - 7200 }, process.env.JWT_SECRET, { expiresIn: '30d' });
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + old)).status, 401, 'Legacy long-lived tokens still have a one-hour maximum age');
    const wrongAudience = jwt.sign({ id: String(user._id), ver: 2 }, process.env.JWT_SECRET, { audience: 'another-application', expiresIn: '1h' });
    assert.equal((await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + wrongAudience)).status, 401);
  });
  await t.test('login validation is bounded and role/account errors are opaque', async () => {
    for (const invalid of [{ ...body, email: {} }, { ...body, password: 'x'.repeat(73) }, { ...body, password: '😀'.repeat(19) }, { ...body, role: {} }]) assert.equal((await request(app).post('/api/users/login').send(invalid)).status, 400);
    for (const invalid of [{ ...body, email: 'nobody@example.invalid' }, { ...body, role: 'super_admin' }, { ...body, password: 'wrong' }]) {
      const result = await request(app).post('/api/users/login').send(invalid); assert.equal(result.status, 401); assert.equal(result.body.message, 'Invalid email or password');
    }
  });
  await t.test('new registrations require stronger bounded passwords, ignore supplied session metadata and return no browser token', async () => {
    const email = crypto.randomUUID() + '@example.invalid';
    const weak = await web('post', '/api/users/register').send({ name: 'Synthetic registration', email, password: 'short', role: 'patient' }); assert.equal(weak.status, 400);
    const result = await web('post', '/api/users/register').send({ name: 'Synthetic registration', email, password, role: 'patient', sessionVersion: 999 }); assert.equal(result.status, 201); ids.push(result.body._id); assert.equal(result.body.token, undefined);
    const stored = await User.findById(result.body._id).select('+sessionVersion'); assert.equal(stored.sessionVersion, 0);
    const profile = await web('get', '/api/users/profile').set('Cookie', cookieOf(result)); assert.equal(profile.status, 200);
  });
  await t.test('database failure is unavailable, not a false expired-session response', async () => {
    const original = User.findById;
    User.findById = () => ({ select: async () => { throw new Error('PRIVATE_DATABASE_URI'); } });
    try {
      const result = await request(app).get('/api/users/profile').set('Authorization', 'Bearer ' + generateToken(user._id, 2)); assert.equal(result.status, 503); assert.doesNotMatch(result.body.message, /PRIVATE_DATABASE_URI/);
    } finally { User.findById = original; }
  });
  await t.test('staff provisioning is organization-bound and never mints an impersonation token', async () => {
    const Org = require('../models/organizationModel'), Branch = require('../models/branchModel');
    const a = await Org.create({ name: 'Synthetic session org A', owner: user._id }), b = await Org.create({ name: 'Synthetic session org B', owner: user._id }); orgIds.push(a._id, b._id);
    const branch = await Branch.create({ name: 'Synthetic wrong-org branch', organizationId: b._id, licenseNumber: 'SYNTHETIC-NOT-A-LICENSE' }); branchIds.push(branch._id);
    const admin = await User.create({ name: 'Synthetic admin', email: crypto.randomUUID() + '@example.invalid', password, role: 'org_admin', organizationId: a._id }); ids.push(admin._id);
    const auth = 'Bearer ' + generateToken(admin._id);
    const body = { name: 'Synthetic new staff', email: crypto.randomUUID() + '@example.invalid', password, role: 'claims_reviewer', organizationId: b._id };
    const denied = await request(app).post('/api/users/provision-staff').set('Authorization', auth).send({ ...body, branchId: String(branch._id) }); assert.equal(denied.status, 400);
    const result = await request(app).post('/api/users/provision-staff').set('Authorization', auth).send(body); assert.equal(result.status, 201); ids.push(result.body._id); assert.equal(result.body.organizationId, String(a._id)); assert.equal(result.body.token, undefined); assert.equal(result.headers['set-cookie'], undefined);
  });
});
