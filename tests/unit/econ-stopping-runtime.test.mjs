import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../../services/econ-response/worker.mjs';
import {CONSENT_VERSION} from '../../services/econ-response/common.mjs';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';

// These high-information parameters and snapshots exist only in this in-memory
// fixture. No calibration package is registered, approved, or activated.
async function precisionFixture(){
 const DB=createLocalDB();
 for(const name of readdirSync(new URL('../../services/econ-response/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())DB.exec(readFileSync(new URL(`../../services/econ-response/migrations/${name}`,import.meta.url),'utf8'));
 const env={DB};
 const call=async(path,data,token)=>{
  const res=await worker.fetch(new Request(`https://test.local${path}`,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);
  return {status:res.status,...await res.json()};
 };
 const p=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});assert.equal(p.status,200);
 const s=await call('/sessions',{course:'ap-micro',unit:1,mode:'assessment'},p.token);assert.equal(s.status,200);
 const original=await DB.prepare('SELECT stopping_policy_json FROM sessions WHERE id=?').bind(s.sessionId).first();
 const base=buildBank().find(q=>q.course==='ap-micro'&&q.unit===1&&q.format==='numeric');assert.ok(base);
 const parameters={a:3,b:0,c:0,d:1,status:'calibrated',modelVersion:'synthetic-runtime-only'};
 const add=async(sequence,{answered=true}={})=>{
  const id=crypto.randomUUID(),item={...base,id:`synthetic-${sequence}`,family:`synthetic-family-${sequence}`};
  await DB.prepare('INSERT INTO presentations (id,session_id,item_id,item_version,family_id,topic,unit,presented_at,selection_probability,selection_pool_size,selection_engine_version,model_version,first_family_exposure,item_snapshot_json,sequence,measurement_parameters_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,s.sessionId,item.id,item.version,item.family,item.topic,item.unit,new Date().toISOString(),1/100,100,'synthetic-only',parameters.modelVersion,1,JSON.stringify(item),sequence,JSON.stringify(parameters)).run();
  if(answered)await DB.prepare('INSERT INTO responses (event_id,presentation_id,session_id,participant_id,attempt_number,raw_answer_json,correct,score,client_submitted_at,server_received_at,elapsed_ms,active_ms,hints_used,feedback_before_answer,validity,calibration_eligible,payload_sha256) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,s.sessionId,p.participantId,1,JSON.stringify(sequence%2?item.answer:item.answer+100),sequence%2,sequence%2,new Date().toISOString(),new Date().toISOString(),5000,4500,0,0,'valid',1,'test-only').run();
  return id;
 };
 for(let i=1;i<=18;i++)await add(i);
 return {DB,env,call,p,s,original,add};
}

test('real next route persists precision stop, exposes it in report, and never presents another item',async()=>{
 const {DB,call,p,s,original}=await precisionFixture();
 try{
  const before=await call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(before.status,200);
  const unit=before.progress.find(d=>d.unit===1);assert.equal(unit.measurementResponses,18);assert.equal(unit.measurementStatus,'calibrated');assert.ok(unit.estimate.sd<.35);assert.ok(unit.estimate.boundaryMass<.01);
  // Both requests can read the same unsealed session; at most one CAS wins.
  const concurrent=await Promise.all([call(`/sessions/${s.sessionId}/next`,{},p.token),call(`/sessions/${s.sessionId}/next`,{},p.token)]);
  assert.ok(concurrent.some(r=>r.status===200&&r.reason==='precision-and-coverage'));
  assert.ok(concurrent.every(r=>r.status===200?r.reason==='precision-and-coverage':r.status===409));
  const retry=await call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(retry.status,200);assert.equal(retry.reason,'precision-and-coverage');
  const count=await DB.prepare('SELECT COUNT(*) AS n FROM presentations WHERE session_id=?').bind(s.sessionId).first();assert.equal(count.n,18);
  await call(`/sessions/${s.sessionId}/complete`,{},p.token);
  const report=await call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(report.terminalReason,'precision-and-coverage');assert.equal(report.completed,true);
  assert.equal((await DB.prepare('SELECT stopping_policy_json FROM sessions WHERE id=?').bind(s.sessionId).first()).stopping_policy_json,original.stopping_policy_json);
 }finally{DB.close();}
});

test('precision stop loses its CAS when a concurrent unanswered presentation appears',async()=>{
 const {DB,env,call,p,s,add}=await precisionFixture();
 try{
  let insertedId;
  env.DB={...DB,prepare(sql){const statement=DB.prepare(sql);return {bind(...args){const bound=statement.bind(...args);return {...bound,run:async()=>{
   if(!insertedId&&sql.startsWith('UPDATE sessions SET terminal_reason=?'))insertedId=await add(19,{answered:false});
   return bound.run();
  }};}};}};
  const raced=await call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(raced.status,409);
  assert.equal((await DB.prepare('SELECT terminal_reason FROM sessions WHERE id=?').bind(s.sessionId).first()).terminal_reason,null);
  const resumed=await call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(resumed.status,200);assert.equal(resumed.presentationId,insertedId);assert.equal(resumed.sequence,19);
 }finally{DB.close();}
});
