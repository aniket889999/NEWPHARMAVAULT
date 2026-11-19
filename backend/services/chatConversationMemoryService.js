'use strict';
const crypto = require('node:crypto');
const registry = require('../data/chatTopicRegistry');
const ATTRIBUTES = ['GENERAL', 'USES', 'SIDE_EFFECTS', 'STORAGE', 'PREVENTION', 'MECHANISM', 'SPECIFIC_FACT'];
const FOCUSES = ['OVERVIEW', 'EXPLAIN', 'SIDE_EFFECTS', 'DEFINITION', 'PREVENTION', 'IDENTITY'];
const INTENTS = ['OVERVIEW', 'EXPLAIN', 'SIDE_EFFECTS', 'COMPARE'];
const topics = new Set(registry.map(value => value.id));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const VERSION = 'public-context-v1', TTL = 60 * 60000;
const fail = message => Object.assign(new Error(message), { statusCode: 400 });
function sanitizeState(value) {
  if (!value || value.version !== VERSION || !Array.isArray(value.topicIds) || value.topicIds.length > 4 || value.topicIds.some(id => !topics.has(id))) return null;
  const plan = value.questionPlan;
  if (!plan || !ATTRIBUTES.includes(plan.attribute) || !Array.isArray(plan.anchors) || plan.anchors.length > 7 || plan.anchors.some(anchor => !/^(?:[a-z]{2,24}|b12)$/.test(anchor)) || !Array.isArray(plan.requestedAttributes) || plan.requestedAttributes.length > 4 || plan.requestedAttributes.some(attribute => !ATTRIBUTES.includes(attribute))) return null;
  return { version: VERSION, topicIds: [...new Set(value.topicIds)], intent: INTENTS.includes(value.intent) ? value.intent : 'OVERVIEW',
    focus: FOCUSES.includes(value.focus) ? value.focus : 'OVERVIEW', style: value.style === 'CONCISE' ? 'CONCISE' : 'STANDARD',
    personalContext: value.personalContext === true, privateReference: value.privateReference === true, unresolvedDetail: value.unresolvedDetail === true,
    questionPlan: { version: 'question-plan-v1', attribute: plan.attribute, anchors: [...plan.anchors], requestedAttributes: [...new Set(plan.requestedAttributes)],
      multipleAttributes: plan.requestedAttributes.length > 1, language: 'ENGLISH', exactTemperature: plan.exactTemperature === true, inherited: false } };
}
function snapshotContext(context, sources = []) {
  const vocabulary = new Set(sources.filter(value => !value.documentId && !['CASE_RECORD'].includes(value.kind))
    .flatMap(value => String(value.excerpt || '').toLowerCase().match(/[a-z][a-z0-9]+/g) || []));
  for (const word of 'treat cause affect work sleep virus cold colds vitamin b12 deficiency use effects'.split(' ')) vocabulary.add(word);
  for (const word of require('./publicAnswerTaskService').PUBLIC_MEDICAL_TERMS.split(' ')) vocabulary.add(word);
  const plan = context.questionPlan || { attribute: 'GENERAL', anchors: [], requestedAttributes: ['GENERAL'] };
  const anchors = (plan.anchors || []).filter(value => /^(?:[a-z]{2,24}|b12)$/.test(value) && vocabulary.has(value));
  return sanitizeState({ version: VERSION, topicIds: context.topics.map(value => value.id).slice(0, 4), intent: context.intent, focus: context.focus, style: context.style,
    personalContext: context.personalContext, privateReference: context.privateReference, unresolvedDetail: context.unresolvedDetail || anchors.length !== (plan.anchors || []).length,
    questionPlan: { ...plan, anchors, requestedAttributes: plan.requestedAttributes || [plan.attribute] } });
}
function scope(user) { if (!user?._id) throw fail('Authenticated context scope required.'); return [String(user._id), String(user.organizationId || '')]; }
function secret(environment) {
  if (typeof environment.JWT_SECRET !== 'string' || environment.JWT_SECRET.length < 32) throw fail('Secure context configuration is unavailable.');
  return crypto.hkdfSync('sha256', Buffer.from(environment.JWT_SECRET), Buffer.from('pharmavault-context'), Buffer.from(VERSION), 32);
}
function sealContext(user, contextId, state, { environment = process.env, now = Date.now() } = {}) {
  if (!uuid.test(contextId || '')) throw fail('Invalid conversation context ID.');
  const memory = sanitizeState(state); if (!memory) throw fail('Invalid conversation state.');
  const body = Buffer.from(JSON.stringify({ scope: scope(user), contextId, expires: now + TTL, memory }));
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', secret(environment), iv); cipher.setAAD(Buffer.from(VERSION));
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  return ['ctx1', iv.toString('base64url'), encrypted.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}
function openContext(user, contextId, token, { environment = process.env, now = Date.now() } = {}) {
  if (!token) return null;
  try {
    if (!uuid.test(contextId || '') || typeof token !== 'string' || token.length > 6000) throw new Error();
    const parts = token.split('.'); if (parts.length !== 4 || parts[0] !== 'ctx1' || parts.slice(1).some(value => !/^[a-z0-9_-]+$/i.test(value))) throw new Error();
    const iv = Buffer.from(parts[1], 'base64url'), tag = Buffer.from(parts[3], 'base64url'); if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret(environment), iv); decipher.setAAD(Buffer.from(VERSION)); decipher.setAuthTag(tag);
    const value = JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()]).toString('utf8'));
    if (JSON.stringify(value.scope) !== JSON.stringify(scope(user)) || value.contextId !== contextId || !Number.isSafeInteger(value.expires) || value.expires <= now || value.expires > now + TTL) throw new Error();
    const state = sanitizeState(value.memory); if (!state) throw new Error(); return state;
  } catch { throw fail('Conversation context expired or could not be verified. Start a new chat or restate the medicine.'); }
}
function prepareMemory(input, user, lease) {
  if (input.caseId) return null;
  if (lease) return sanitizeState(lease.conversation.memory) || memoryFromMessages(lease.conversation.messages);
  return openContext(user, input.contextId, input.contextToken);
}
function finishMemory(result, input, user, lease) {
  if (input.caseId) return result;
  let state = result.contextState;
  if (!state) state = sanitizeState({ version: VERSION, topicIds: [], intent: 'OVERVIEW', focus: 'OVERVIEW', style: 'STANDARD',
    personalContext: result.routing?.intent === 'EMERGENCY', privateReference: false, unresolvedDetail: false,
    questionPlan: { attribute: 'GENERAL', anchors: [], requestedAttributes: ['GENERAL'] } });
  if (lease) { lease.nextMemory = state; return result; }
  return input.contextId && state ? { ...result, contextToken: sealContext(user, input.contextId, state), memoryPolicy: 'ENCRYPTED_SESSION_CONTEXT_NOT_MEDICAL_EVIDENCE' } : result;
}
function memoryFromMessages(messages) {
  let state = null;
  for (const message of messages || []) if (message.role === 'user') state = snapshotContext(require('./chatContextService').resolveContext(message.content, [], { memory: state }));
  return state;
}
module.exports = { VERSION, TTL, sanitizeState, snapshotContext, sealContext, openContext, prepareMemory, finishMemory, memoryFromMessages };
