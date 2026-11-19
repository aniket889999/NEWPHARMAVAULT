'use strict';
// Explicitly bounded, public-only live acceptance. Defaults to zero network.
const fs=require('node:fs');
async function main(){
  const args=process.argv.slice(2),allowed=args.includes('--allow-two-public-calls'),index=args.indexOf('--env-file');
  // The medicine-only mode consumes at most the one remaining authorized
  // request; it must not repeat an already successful project-guide probe.
  const medicineOnly=args.includes('--only-public-medicine'),maxRequests=medicineOnly?1:2;
  if(!allowed){console.log(JSON.stringify({status:'NOT_RUN',requests:0,reason:'Explicit --allow-two-public-calls required.'}));return;}
  if(index>=0){
    const file=args[index+1];if(!file||!fs.lstatSync(file).isFile())throw Error('CONFIG_UNAVAILABLE');
    const parsed=require('dotenv').parse(fs.readFileSync(file));
    for(const key of ['GEMINI_API_KEY','RAG_CHAT_MODEL'])if(parsed[key])process.env[key]=parsed[key];
  }
  if(!process.env.GEMINI_API_KEY){console.log(JSON.stringify({status:'BLOCKED',requests:0,reason:'Backend provider credential is not configured.'}));process.exitCode=2;return;}
  Object.assign(process.env,{NODE_ENV:'test',CHAT_SOURCE_POLICY:'ACADEMIC_DEMO',RAG_CHAT_LLM_ENABLED:'true',RAG_CHAT_PUBLIC_EXPORT_ALLOWED:'true',RAG_CHAT_EMBEDDINGS_ENABLED:'false',RAG_CHAT_WEB_ENABLED:'false',TRUSTRAG_LLM_ENABLED:'false',TRUSTRAG_LLM_EXPORT_ALLOWED:'false'});
  const {answer}=require('../services/contextualChatService');let requests=0;
  const fetcher=async(url,options)=>{
    const body=JSON.parse(options.body),payload=JSON.stringify(body.contents);
    if(requests>=maxRequests || !/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-[a-z0-9.-]+:streamGenerateContent\?alt=sse$/.test(url) || body.generationConfig?.maxOutputTokens>1024 || payload.length>8000)throw Error('PROBE_BOUNDARY');
    requests++;return fetch(url,{...options,redirect:'error'});
  };
  const results=[];
  for(const message of medicineOnly?['Explain Metformin.']:['Explain human-in-the-loop validation simply.','Explain Metformin.']){
    const start=Date.now();
    const r=await answer({message,history:[]},{fetcher,webSearch:async()=>({status:'DISABLED',passages:[]})});
    results.push({task:message.startsWith('Explain Metformin')?'PUBLIC_MEDICINE_OVERVIEW':'PUBLIC_PROJECT_GUIDE',mode:r.mode,model:r.model||null,sourceCount:r.sources.length,fallbackReason:r.fallbackReason||null,ms:Date.now()-start,assessment:r.answerQuality?.assessment||null});
  }
  console.log(JSON.stringify({status:results.every(r=>r.mode==='GEMINI_RAG')?'VERIFIED':'PARTIAL_OR_PROVIDER_UNAVAILABLE',requests,maxRequests,maxOutputTokens:1024,privateDataSent:false,rawHistorySent:false,embeddingsRequests:0,retries:0,normalServerConfigurationChanged:false,results}));
  if(results.some(r=>r.mode!=='GEMINI_RAG'))process.exitCode=2;
}
main().catch(()=>{console.log(JSON.stringify({status:'PROBE_FAILED',reason:'Bounded public acceptance could not complete. Credentials and upstream bodies are not exposed.'}));process.exitCode=2;});
