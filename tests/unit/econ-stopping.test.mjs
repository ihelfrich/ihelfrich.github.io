import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {stoppingPolicy,sessionStoppingDecision} from '../../services/econ-response/stopping.mjs';
import {newState} from '../../src/lib/econ-practice/adaptive.mjs';
import {GRID} from '../../src/lib/econ-practice/irt.mjs';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import worker from '../../services/econ-response/worker.mjs';
import {CONSENT_VERSION} from '../../services/econ-response/common.mjs';
import {createAssignment,startAssignment} from '../../services/econ-response/assignments.mjs';

function evidence(){
 const state=newState(),session={id:'s',course:'ap-micro',mode:'assessment',target_count:36,stopping_policy_json:JSON.stringify(stoppingPolicy({kind:'unit-precision',maxItems:36,units:[1,2]}))};
 for(const unit of [1,2]){
  state.posteriors[JSON.stringify(['s','ap-micro',unit])]=GRID.map(t=>t===0?1:0);
  // A narrow but nondegenerate posterior with no boundary concentration.
  state.posteriors[JSON.stringify(['s','ap-micro',unit])]=GRID.map(t=>Math.abs(t)<.11?1/3:0);
  const w=state.posteriors[JSON.stringify(['s','ap-micro',unit])],sum=w.reduce((a,b)=>a+b,0);state.posteriors[JSON.stringify(['s','ap-micro',unit])]=w.map(v=>v/sum);
  for(let i=0;i<9;i++)state.history.push({sessionId:'s',course:'ap-micro',unit,family:`u${unit}-${i}`,psychometricEligible:true,modelVersion:`cal-${unit}`,parameterStatus:'calibrated',correct:i%2===0});
 }
 return {state,session};
}
test('precision stopping requires each pinned unit, sufficient eligible distinct families, and stable interior precision',()=>{
 const {state,session}=evidence();assert.equal(sessionStoppingDecision(session,state,18).reason,'precision-and-coverage');
 for(const change of [s=>s.history.splice(0,4),s=>s.history.forEach(h=>{if(h.unit===2)h.parameterStatus='provisional';}),s=>s.history.forEach(h=>{if(h.unit===2)h.family='same';}),s=>s.history.forEach(h=>{if(h.unit===2)h.psychometricEligible=false;}),s=>{s.posteriors[JSON.stringify(['s','ap-micro',2])]=GRID.map((_,i)=>i===0?1:0);},s=>{s.posteriors[JSON.stringify(['s','ap-micro',2])]=GRID.map(()=>1/GRID.length);},s=>s.history.forEach(h=>{if(h.unit===2)h.sessionId='other';})]){
  const copy=structuredClone(state);change(copy);assert.equal(sessionStoppingDecision(session,copy,18).stop,false);
 }
 assert.equal(sessionStoppingDecision(session,state,36).reason,'maximum-length');
 const missing={...session,stopping_policy_json:JSON.stringify(stoppingPolicy({kind:'unit-precision',maxItems:36,units:[1,2,3]}))};assert.equal(sessionStoppingDecision(missing,state,18).stop,false);
 const fixed={...session,stopping_policy_json:JSON.stringify(stoppingPolicy({kind:'fixed',maxItems:24,units:[1,2]}))};assert.equal(sessionStoppingDecision(fixed,state,18).stop,false);assert.equal(sessionStoppingDecision(fixed,state,24).reason,'session-length');
 assert.equal(sessionStoppingDecision({...session,stopping_policy_json:null},state,18).stop,false);
});

function fixture(){
 const DB=createLocalDB();for(const file of readdirSync(new URL('../../services/econ-response/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())DB.exec(readFileSync(new URL(`../../services/econ-response/migrations/${file}`,import.meta.url),'utf8'));
 const env={DB};const call=async(path,data,token)=>{const res=await worker.fetch(new Request(`https://test.local${path}`,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);const value=await res.json();assert.equal(res.status,200,JSON.stringify(value));return value;};return {env,call};
}
test('assessment policy is pinned, terminal reason survives retry and completion, assignment default remains fixed',async()=>{
 const {env,call}=fixture();try{
  const p=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  const s=await call('/sessions',{course:'ap-micro',unit:1,topic:'1.1',mode:'assessment'},p.token);
  let row=await env.DB.prepare('SELECT * FROM sessions WHERE id=?').bind(s.sessionId).first();const policy=JSON.parse(row.stopping_policy_json);assert.equal(policy.kind,'unit-precision');assert.deepEqual(policy.requiredUnits,[1]);
  await assert.rejects(env.DB.prepare('UPDATE sessions SET stopping_policy_json=? WHERE id=?').bind(JSON.stringify({...policy,maxItems:1}),s.sessionId).run(),/immutable/);
  for(let i=0;i<policy.maxItems;i++){
  const next=await call(`/sessions/${s.sessionId}/next`,{},p.token);
  const q=JSON.parse((await env.DB.prepare('SELECT item_snapshot_json FROM presentations WHERE id=?').bind(next.presentationId).first()).item_snapshot_json);
  const response=q.format==='choice'?q.answerIndex:q.format==='multipart'?Object.fromEntries(q.parts.map(p=>[p.id,p.answer])):q.answer;
  await call(`/sessions/${s.sessionId}/answers`,{eventId:crypto.randomUUID(),presentationId:next.presentationId,attemptNumber:1,response,elapsedMs:5000,activeMs:4500,submittedAt:new Date().toISOString()},p.token);
  }
  for(let i=0;i<2;i++)assert.equal((await call(`/sessions/${s.sessionId}/next`,{},p.token)).reason,'maximum-length');
  await call(`/sessions/${s.sessionId}/complete`,{},p.token);assert.equal((await call(`/sessions/${s.sessionId}/report`,null,p.token)).terminalReason,'maximum-length');
  await env.DB.prepare("UPDATE participants SET identity_kind='account' WHERE id=?").bind(p.participantId).run();
  for(const kind of [undefined,'unit-precision']){
   const a=await createAssignment(env,{id:'test-instructor'},{title:'Synthetic assignment',course:'ap-micro',unit:1,itemCount:6,maxAttempts:1,opensAt:new Date(Date.now()-1000).toISOString(),closesAt:new Date(Date.now()+60000).toISOString(),participantIds:[p.participantId],...(kind?{stoppingPolicy:kind}:{})});
   const started=await startAssignment(env,{id:p.participantId,identity_kind:'account'},{assignmentId:a.assignmentId,requestId:crypto.randomUUID()});row=await env.DB.prepare('SELECT * FROM sessions WHERE id=?').bind(started.sessionId).first();assert.equal(JSON.parse(row.stopping_policy_json).kind,kind??'fixed');
  }
 }finally{env.DB.close();}
});
