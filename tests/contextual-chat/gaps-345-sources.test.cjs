'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),b=createRequire(path.resolve(__dirname,'../../backend/package.json'));
const {createApprovedMedicineSearch,FIXED_NHS_SOURCES}=b('./services/approvedMedicineSearchService');
const {createApprovedFdaMedicineSearch}=b('./services/approvedFdaMedicineSearchService');
const {registerMedicineCandidates,isApprovedWebPassage}=b('./services/approvedHealthSearchService');
test('official index broadens source routing without arbitrary URL input or invented approval',()=>{
  assert.ok(Object.keys(FIXED_NHS_SOURCES).length>=250);
  for(const [topic,attributes]of Object.entries(FIXED_NHS_SOURCES))for(const url of Object.values(attributes))assert.match(url,/^https:\/\/www\.nhs\.uk\/medicines\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)?$/);
});
test('storage/mechanism sections are separate and dosing instructions stay excluded',async()=>{
  const html='<main><h1>Metformin</h1><h2>How it works</h2><p>Metformin reduces glucose production in this synthetic formatting fixture.</p><h2>How to take it</h2><p>Take 2 tablets every 6 hours.</p><h2>Storage</h2><p>Keep the medicine in its original packaging according to this synthetic storage fixture.</p></main>';
  const search=createApprovedMedicineSearch({enabled:()=>true,fetcher:async()=>new Response(html,{headers:{'content-type':'text/html'}})});
  const r=await search('metformin',{attribute:'STORAGE'});assert.equal(r.status,'RETRIEVED');assert.match(r.candidates[0].excerpt,/packaging/);assert.doesNotMatch(JSON.stringify(r.candidates),/2 tablets|every 6|glucose/);
  const mechanism=await search('metformin',{attribute:'MECHANISM'});assert.match(mechanism.candidates[0].excerpt,/glucose production/);
});
test('only an observed same-root official child link may be fetched, at most once',async()=>{
  const calls=[];const search=createApprovedMedicineSearch({enabled:()=>true,fetcher:async url=>{
    calls.push(url);return new Response(calls.length===1?'<main><h1>Losartan</h1><a href="/medicines/losartan/about-losartan/">About</a><a href="https://evil.invalid/steal">Ignore</a></main>':'<main><h1>About losartan</h1><p>Losartan is used in this synthetic reference parsing fixture only.</p></main>',{headers:{'content-type':'text/html'}});
  }});
  const r=await search('losartan',{attribute:'USES'});assert.equal(calls.length,2);assert.equal(calls[1],'https://www.nhs.uk/medicines/losartan/about-losartan/');assert.equal(r.status,'RETRIEVED');
  assert.ok(isApprovedWebPassage(registerMedicineCandidates(r.candidates)[0]));
});
test('FDA exact generic label is US/product-specific, transport-bound, and excludes combinations',async()=>{
  let sent='';const data={results:[{openfda:{generic_name:['TELMISARTAN'],spl_set_id:['11111111-1111-1111-1111-111111111111']},indications_and_usage:['Telmisartan is used in this clearly synthetic label parser fixture only.'],effective_time:'20260101'}]};
  const search=createApprovedFdaMedicineSearch({enabled:()=>true,fetcher:async url=>{sent=url;return Response.json(data);}});
  const r=await search('telmisartan',{attribute:'USES'});assert.match(sent,/api\.fda\.gov\/drug\/label\.json/);assert.equal(r.status,'RETRIEVED');
  const p=registerMedicineCandidates(r.candidates)[0];assert.equal(p.publisher,'FDA');assert.equal(p.jurisdiction,'US');assert.equal(p.reviewStatus,'NOT_CLINICALLY_APPROVED');assert.ok(isApprovedWebPassage(p));
  data.results[0].openfda.generic_name=['TELMISARTAN AND ANOTHER INGREDIENT'];
  const other=createApprovedFdaMedicineSearch({enabled:()=>true,fetcher:async()=>Response.json(data)});
  assert.equal((await other('telmisartan')).status,'NO_RELEVANT_EVIDENCE');
});
