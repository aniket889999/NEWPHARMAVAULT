'use strict';
const crypto = require('node:crypto');
const History = require('../models/chatHistoryModel');
const CONSENT = 'public-history-v1', DAYS = 30, MAX_CHATS = 20, MAX_MESSAGES = 200;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const expiry = () => new Date(Date.now() + DAYS * 86400000);
function scope(user) {
  if (!user?._id) fail(401, 'Sign in to use saved history.');
  const organizationId = user.organizationId || null;
  return { _id: crypto.createHash('sha256').update(String(user._id) + ':' + String(organizationId || '')).digest('hex'), user: user._id, organizationId };
}
const active = user => ({ ...scope(user), enabled: true, expiresAt: { $gt: new Date() } });
function conversationId(id) { if (!UUID.test(String(id || ''))) fail(404, 'Saved conversation not found.'); return id; }
function summary(c) { return { id:c.id, title:c.title, createdAt:c.createdAt, updatedAt:c.updatedAt, messageCount:c.messages?.length || 0 }; }
async function state(user) {
  const doc = await History.findOne(active(user)).lean();
  return { enabled:Boolean(doc), consentVersion:CONSENT, retentionInactiveDays:DAYS,
    conversations:(doc?.conversations || []).map(summary).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)) };
}
async function enable(user, body) {
  if (!body || Object.keys(body).some(k=>k!=='consentVersion') || body.consentVersion !== CONSENT) fail(400, 'Explicit saved-public-history consent is required.');
  const filter = scope(user), existing = await History.findOne(filter).select('expiresAt').lean();
  const set = { enabled:true, consentVersion:CONSENT, expiresAt:expiry(), ...(existing && existing.expiresAt <= new Date() ? {conversations:[],leaseToken:null,activeUntil:null} : {}) };
  await History.findOneAndUpdate(filter, { $set:set, $setOnInsert:{ ...filter, ...(set.conversations ? {} : {conversations:[]}) } }, { upsert:true,new:true,setDefaultsOnInsert:true });
  return state(user);
}
async function clear(user) { await History.deleteOne(scope(user)); return { enabled:false, deleted:true }; }
async function createConversation(user, body) {
  if (body && Object.keys(body).length) fail(400, 'No conversation content is accepted here.');
  const now = new Date(), c = { id:crypto.randomUUID(), title:'New saved chat', messages:[], createdAt:now, updatedAt:now };
  const doc = await History.findOneAndUpdate({ ...active(user), $expr:{ $lt:[{$size:'$conversations'},MAX_CHATS] } }, { $push:{conversations:c},$set:{expiresAt:expiry()} }, {new:true});
  if (!doc) fail(409, 'Enable saved history first, or delete an older saved chat (maximum 20).');
  return summary(c);
}
async function getConversation(user, id) {
  conversationId(id); const doc = await History.findOne({ ...active(user),'conversations.id':id }).lean();
  const c = doc?.conversations.find(c=>c.id===id); if (!c) fail(404, 'Saved conversation not found.');
  return { ...summary(c), messages:c.messages };
}
async function removeConversation(user, id) {
  conversationId(id); const result = await History.updateOne({ ...active(user),'conversations.id':id }, { $pull:{conversations:{id}},$set:{expiresAt:expiry()} });
  if (!result.matchedCount) fail(404, 'Saved conversation not found.');
  return { deleted:true };
}
async function acquire(user, id, body) {
  conversationId(id);
  if (!body || Object.keys(body).some(k=>k!=='message') || typeof body.message !== 'string' || !body.message.trim() || body.message.length>2000) fail(400, 'Saved public chat accepts a message only; private case scope and client history are not accepted.');
  const token = crypto.randomUUID();
  const doc = await History.findOneAndUpdate({ ...active(user),'conversations.id':id,
    $or:[{activeUntil:{$lte:new Date()}},{activeUntil:null}] }, { $set:{leaseToken:token,activeUntil:new Date(Date.now()+60000)} }, {new:true}).lean();
  if (!doc) {
    if (!(await History.exists({...active(user),'conversations.id':id}))) fail(404, 'Saved conversation not found.');
    fail(409, 'Another saved-chat answer is still running. Please wait.');
  }
  const c=doc.conversations.find(c=>c.id===id);
  const lease={scope:scope(user),token,id,conversation:c,document:doc};
  if(c.messages.length>=MAX_MESSAGES){await release(lease);fail(409,'This saved chat has reached 200 messages. Start a new chat.');}
  return lease;
}
async function release(lease) { await History.updateOne({...lease.scope,leaseToken:lease.token},{$unset:{leaseToken:1,activeUntil:1}}); }
function publicAnswer(result) {
  if (result.caseAnswer || result.sources?.some(s=>s.kind==='CASE_RECORD'||s.documentId)) fail(400,'Private case answers cannot be saved in public chat history.');
  const {feedbackReceipt,caseAnswer,contextToken,contextState,...rag}=result;
  return JSON.parse(JSON.stringify(rag));
}
async function finish(lease, message, result) {
  const now=new Date(), rag=publicAnswer(result), c=lease.conversation;
  // Do not persist raw private/personal turns in a public-history feature.
  // Retain only the already-sanitized routing flags so a later pronoun cannot
  // accidentally bypass the preceding clinical/private boundary.
  if(lease.nextMemory?.privateReference || lease.nextMemory?.personalContext){
    await History.updateOne({...lease.scope,enabled:true,leaseToken:lease.token,activeUntil:{$gt:now},'conversations.id':lease.id},{$set:{'conversations.$.memory':lease.nextMemory}});
    return false;
  }
  const appended=[{id:crypto.randomUUID(),role:'user',content:message.trim(),timestamp:now},
    {id:crypto.randomUUID(),role:'assistant',content:result.reply,timestamp:now,rag}];
  if(typeof result.reply!=='string'||!result.reply.trim()||result.reply.length>12000 || Buffer.byteLength(JSON.stringify(lease.document))+Buffer.byteLength(JSON.stringify(appended))>2*1024*1024) return false;
  const update=await History.updateOne({...lease.scope,enabled:true,leaseToken:lease.token,activeUntil:{$gt:now},'conversations.id':lease.id},
    {$push:{'conversations.$.messages':{$each:appended}},$set:{'conversations.$.updatedAt':now,'conversations.$.title':c.messages.length?c.title:message.trim().slice(0,48),
      ...(lease.nextMemory ? {'conversations.$.memory':lease.nextMemory} : {}),expiresAt:expiry()}});
  return Boolean(update.matchedCount);
}
module.exports={CONSENT,state,enable,clear,createConversation,getConversation,removeConversation,acquire,finish,release,scope,publicAnswer};
