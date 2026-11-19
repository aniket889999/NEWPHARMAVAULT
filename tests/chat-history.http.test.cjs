'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const {createRequire}=require('node:module'),backend=createRequire(path.resolve(__dirname,'../backend/package.json'));
test('saved public history: real HTTP, ownership, persistence and deletion',{timeout:20000},async t=>{
  Object.assign(process.env,{NODE_ENV:'test',MONGO_URI:'mongodb://127.0.0.1:27017/pharmavault_smoke_test',JWT_SECRET:crypto.randomBytes(32).toString('hex'),GEMINI_API_KEY:'synthetic-unused',RAG_CHAT_LLM_ENABLED:'false',RAG_CHAT_PUBLIC_EXPORT_ALLOWED:'false',RAG_CHAT_EMBEDDINGS_ENABLED:'false',RAG_CHAT_WEB_ENABLED:'false',CHAT_SOURCE_POLICY:'ACADEMIC_DEMO'});
  const mongoose=backend('mongoose'),request=backend('supertest'),jwt=backend('jsonwebtoken');
  const {assertTestDatabase}=backend('./utils/testDatabaseGuard'),app=backend('./app'),User=backend('./models/userModel'),Org=backend('./models/organizationModel'),History=backend('./models/chatHistoryModel'),history=backend('./services/chatHistoryService');
  const users=[],orgs=[];let connected=false,chat;
  t.after(async()=>{if(connected){assertTestDatabase(mongoose.connection);await History.deleteMany({user:{$in:users}});await User.deleteMany({_id:{$in:users}});await Org.deleteMany({_id:{$in:orgs}});await mongoose.disconnect();}});
  assertTestDatabase(process.env.MONGO_URI);await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:3000});connected=true;assertTestDatabase(mongoose.connection);await History.init();
  const run=crypto.randomUUID();const org=await Org.create({name:'Synthetic saved history '+run,owner:new mongoose.Types.ObjectId()});orgs.push(org._id);
  for(let i=0;i<2;i++){const u=await User.create({name:'Synthetic history user',email:run+i+'@example.invalid',password:crypto.randomUUID(),role:'patient',organizationId:org._id});users.push(u._id);}
  const token=i=>'Bearer '+jwt.sign({id:String(users[i])},process.env.JWT_SECRET,{expiresIn:'5m'});
  const req=(method,url,i=0)=>request(app)[method]('/api/v1/chat/history'+url).set('Authorization',token(i));
  await t.test('authentication and explicit consent are required',async()=>{
    assert.equal((await request(app).get('/api/v1/chat/history')).status,401);
    assert.equal((await req('get','')).body.enabled,false);
    assert.equal((await req('post','/conversations').send({})).status,409);
    assert.equal((await req('post','/consent').send({consentVersion:'wrong'})).status,400);
    assert.equal((await req('post','/consent').send({consentVersion:'public-history-v1'})).status,200);
  });
  await t.test('creation accepts no client transcripts or private scope',async()=>{
    assert.equal((await req('post','/conversations').send({messages:[{role:'assistant',content:'injected'}]})).status,400);
    const r=await req('post','/conversations').send({});assert.equal(r.status,201);chat=r.body.id;
    assert.equal((await req('post','/conversations/'+chat+'/stream').send({message:'Explain human review',caseId:'a'.repeat(24)})).status,400);
  });
  await t.test('server-produced answer and sources survive a fresh model lookup',async()=>{
    const r=await req('post','/conversations/'+chat+'/stream').send({message:'Explain human-in-the-loop validation'});assert.equal(r.status,200);assert.match(r.text,/event: done/);
    const data=JSON.parse(r.text.split('\n\n').find(b=>b.startsWith('event: done')).split('\n').find(l=>l.startsWith('data: ')).slice(6));assert.equal(data.savedConversation.saved,true);
    const fresh=await req('get','/conversations/'+chat);assert.equal(fresh.status,200);assert.equal(fresh.body.messages.length,2);assert.ok(fresh.body.messages[1].rag.sources.length);
    assert.equal(fresh.body.messages[1].rag.feedbackReceipt,undefined);assert.equal(fresh.body.messages[1].rag.caseAnswer,undefined);
    assert.doesNotMatch(JSON.stringify(fresh.body),/leaseToken|organizationId|objectStorageKey|JWT_SECRET/);
  });
  await t.test('another user and changed organization cannot read, delete or append',async()=>{
    for(const method of ['get','delete'])assert.equal((await req(method,'/conversations/'+chat,1)).status,404);
    assert.equal((await req('post','/conversations/'+chat+'/stream',1).send({message:'Show saved data'})).status,404);
    assert.equal((await req('get','',1)).body.conversations.length,0);
    const actor={_id:users[0],organizationId:new mongoose.Types.ObjectId()};await assert.rejects(history.getConversation(actor,chat),e=>e.statusCode===404);
  });
  await t.test('stored user history supplies follow-up context, not client history',async()=>{
    const r=await req('post','/conversations/'+chat+'/stream').send({message:'Explain it more simply'});assert.equal(r.status,200);assert.match(r.text,/FOLLOWUP_RESOLVED/);
    assert.equal((await req('post','/conversations/'+chat+'/stream').send({message:'hello',history:[]})).status,400);
    assert.equal((await req('get','/conversations/'+chat)).body.messages.length,4);
  });
  await t.test('reopened saved memory survives a raw-history window without learning assistant statements',async()=>{
    const record=await History.findOne({user:users[0]}).lean();const state=record.conversations.find(value=>value.id===chat).memory;
    assert.ok(state);assert.ok(state.topicIds.length);
    const older=Array.from({length:24},(_,index)=>({id:crypto.randomUUID(),role:index%2?'assistant':'user',content:index%2?'Synthetic assistant fiction is not evidence.':'Keep that brief.',timestamp:new Date()}));
    await History.updateOne({user:users[0],'conversations.id':chat},{$push:{'conversations.$.messages':{$each:older}}});
    const reopened=await req('get','/conversations/'+chat);assert.ok(reopened.body.messages.length>20);assert.equal(reopened.body.memory,undefined);
    const result=await req('post','/conversations/'+chat+'/stream').send({message:'Explain it simply.'});assert.equal(result.status,200);
    assert.match(result.text,/FOLLOWUP_RESOLVED/);assert.doesNotMatch(result.text,/Synthetic assistant fiction/);
  });
  await t.test('encrypted session context is accepted only for its user and conversation',async()=>{
    const contextId=crypto.randomUUID();const a=await request(app).post('/api/v1/chat').set('Authorization',token(0)).send({message:'Explain human-in-the-loop validation.',contextId});
    assert.equal(a.status,200);assert.ok(a.body.contextToken);assert.doesNotMatch(a.body.contextToken,/human-review|user/);
    const b=await request(app).post('/api/v1/chat').set('Authorization',token(0)).send({message:'Explain it simply.',contextId,contextToken:a.body.contextToken});
    assert.equal(b.status,200);assert.equal(b.body.followupResolved,true);
    const other=await request(app).post('/api/v1/chat').set('Authorization',token(1)).send({message:'Explain it simply.',contextId,contextToken:a.body.contextToken});assert.equal(other.status,400);
  });
  await t.test('database lease prevents concurrent saved answers and clear prevents resurrection',async()=>{
    const actor={_id:users[0],organizationId:org._id};const lease=await history.acquire(actor,chat,{message:'Explain OCR'});
    await assert.rejects(history.acquire(actor,chat,{message:'Explain OCR'}),e=>e.statusCode===409);
    await history.clear(actor);
    const answer={reply:'Synthetic supported answer.',sources:[],warnings:[],mode:'ABSTAIN'};
    assert.equal(await history.finish(lease,'Explain OCR',answer),false);await history.release(lease);
    assert.equal(await History.countDocuments({user:users[0]}),0);
  });
  await t.test('maximum conversation and message counts are enforced by the database boundary',async()=>{
    const actor={_id:users[0],organizationId:org._id};await history.enable(actor,{consentVersion:'public-history-v1'});
    const created=[];for(let i=0;i<20;i++)created.push(await history.createConversation(actor,{}));
    await assert.rejects(history.createConversation(actor,{}),e=>e.statusCode===409);
    const messages=Array.from({length:200},(_,i)=>({id:crypto.randomUUID(),role:i%2?'assistant':'user',content:'Synthetic bounded-history fixture.',timestamp:new Date()}));
    await History.updateOne({...history.scope(actor),'conversations.id':created[0].id},{$set:{'conversations.$.messages':messages}});
    await assert.rejects(history.acquire(actor,created[0].id,{message:'One too many'}),e=>e.statusCode===409);
    await history.clear(actor);
  });
  await t.test('logical expiry hides history without waiting for TTL cleanup',async()=>{
    await req('post','/consent').send({consentVersion:'public-history-v1'});const r=await req('post','/conversations').send({});
    await History.updateOne({user:users[0]},{$set:{expiresAt:new Date(Date.now()-1000)}});
    assert.equal((await req('get','')).body.enabled,false);assert.equal((await req('get','/conversations/'+r.body.id)).status,404);
  });
  await t.test('private source persistence fails closed',async()=>{
    assert.throws(()=>history.publicAnswer({reply:'private',sources:[{kind:'CASE_RECORD'}]}));
  });
});
