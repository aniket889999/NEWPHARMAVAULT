'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),b=createRequire(path.resolve(__dirname,'../../backend/package.json'));
const {createPublicSemanticRetrieval,DIMENSION}=b('./services/publicSemanticRetrievalService'),{references}=b('./services/chatReferenceRegistry'),{resolveContext}=b('./services/chatContextService');
const sources=references.filter(value=>['nhs-metformin-overview','nhs-metformin-effects'].includes(value.key));
const context=()=>resolveContext('What is Metformin used for?');
const environment=()=>({RAG_CHAT_EMBEDDINGS_ENABLED:'true',RAG_CHAT_PUBLIC_EXPORT_ALLOWED:'true',GEMINI_API_KEY:'synthetic-unused',RAG_CHAT_EMBEDDING_MODEL:'gemini-embedding-001'});
const vector=index=>Array.from({length:DIMENSION},(_,i)=>i===index?1:0);
const controls={run:async(_tool,action)=>action()};
test('real-shaped 768D batch and query are public-only, normalized and fused with lexical ranking',async()=>{
  let calls=0;
  const service=createPublicSemanticRetrieval({environment,store:null,controls,fetcher:async(url,options)=>{
    calls++;assert.match(url,/gemini-embedding-001:batchEmbedContents$/);const body=JSON.parse(options.body);
    assert.doesNotMatch(options.body,/PRIVATE_CANARY|rawHistory|localQuestion/);assert.equal(body.requests.length,3);
    assert.equal(body.requests.at(-1).taskType,'RETRIEVAL_QUERY');assert.ok(body.requests.every(value=>value.outputDimensionality===768));
    return Response.json({embeddings:body.requests.map((_r,index)=>({values:vector(index===2?1:index)}))});
  }});
  const c=context();c.localQuestion+=' PRIVATE_CANARY';c.rawHistory='PRIVATE_CANARY';
  const result=await service.retrieve(c,sources);assert.equal(result.method,'HYBRID_BM25_VECTOR');assert.equal(calls,1);assert.equal(result.passages.length,2);
  assert.equal(service.snapshot().vectorRetrievalVerified,true);
  const second=await service.retrieve(c,sources);assert.equal(second.embeddingRequests,0);assert.equal(calls,1);
});
test('private/forged evidence and unrepresentable context do not leave the server',async()=>{
  let calls=0;const service=createPublicSemanticRetrieval({environment,store:null,controls,fetcher:async()=>{calls++;throw Error('no egress');}});
  for(const source of [{...sources[0],private:true},{...sources[0],excerpt:'FORGED_PUBLIC_TEXT'}])await assert.rejects(service.retrieve(context(),[source]));
  const c=resolveContext('Does Metformin affect PRIVATE_CANARY?');const r=await service.retrieve(c,sources);assert.equal(r.method,'BM25_CONCEPT_RERANK');assert.equal(calls,0);
});
test('malformed vectors, provider error and disabled mode fall back honestly without retries',async()=>{
  for(const response of [Response.json({embeddings:[{values:[1,2]}]}),new Response('',{status:429})]){
    let calls=0;const service=createPublicSemanticRetrieval({environment,store:null,controls,fetcher:async()=>{calls++;return response;}});
    const r=await service.retrieve(context(),sources);assert.equal(r.method,'BM25_CONCEPT_RERANK');assert.equal(calls,1);assert.match(r.warning,/unavailable/i);
  }
  const service=createPublicSemanticRetrieval({environment:()=>({...environment(),RAG_CHAT_EMBEDDINGS_ENABLED:'false'}),store:null,controls,fetcher:async()=>{throw Error('no egress');}});
  assert.equal((await service.retrieve(context(),sources)).embeddingRequests,0);
});
test('persistent public cache survives a service restart and contains no user/chat/raw-text fields',async()=>{
  const records=new Map();let calls=0;
  const store={db:{readyState:1},find:query=>({lean:async()=>query._id.$in.flatMap(key=>records.has(key)?[records.get(key)]:[])}),bulkWrite:async operations=>{
    for(const op of operations){const value=op.updateOne;assert.deepEqual(Object.keys(value.update.$set).sort(),['dimension','expiresAt','model','task','vector']);records.set(value.filter._id,{_id:value.filter._id,...value.update.$set});}
  }};
  const options={environment,store,controls,fetcher:async(_url,request)=>{calls++;return Response.json({embeddings:JSON.parse(request.body).requests.map(()=>({values:vector(0)}))});}};
  await createPublicSemanticRetrieval(options).retrieve(context(),sources);
  const result=await createPublicSemanticRetrieval(options).retrieve(context(),sources);
  assert.equal(result.method,'HYBRID_BM25_VECTOR');assert.equal(result.embeddingRequests,0);assert.equal(calls,1);
});
