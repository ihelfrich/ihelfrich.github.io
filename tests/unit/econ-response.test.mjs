import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{CONSENT_VERSION} from '../../services/econ-response/worker.mjs';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
const bank=new Map(buildBank().map(q=>[q.id,q]));
function setup(){const DB=createLocalDB();DB.exec(readFileSync(new URL('../../services/econ-response/migrations/0001.sql',import.meta.url),'utf8'));DB.exec(readFileSync(new URL('../../services/econ-response/migrations/0002_identity_assignments.sql',import.meta.url),'utf8'));const env={DB,ADMIN_TOKEN:'test-only-admin',ALLOW_BOOTSTRAP_ADMIN:'true',ALLOWED_ORIGINS:'https://ihelfrich.github.io'};return {env,call:async(path,data,token,method=data?'POST':'GET')=>{const res=await worker.fetch(new Request(`https://api.example${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:res.status,...await res.json()};}};}
async function enrolled(t,mode='practice'){const p=await t.call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});assert.equal(p.status,200);const s=await t.call('/sessions',{course:'ap-micro',mode},p.token);assert.equal(s.status,200);const next=await t.call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(next.status,200);return {p,s,next};}
function answer(next){const q=bank.get(next.item.id);return {eventId:crypto.randomUUID(),presentationId:next.presentationId,attemptNumber:1,response:q.format==='choice'?q.answerIndex:q.answer,elapsedMs:5000,activeMs:4500,submittedAt:new Date().toISOString()};}
test('answer receipt proves durable storage and duplicate retry does not create another row',async()=>{const t=setup(),{p,s,next}=await enrolled(t);assert.equal(next.item.answer,undefined);assert.equal(next.item.answerIndex,undefined);const a=answer(next);const r=await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.persisted,true);assert.equal(r.correct,true);const retry=await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);assert.equal(retry.receipt,r.receipt);const count=await t.env.DB.prepare('SELECT COUNT(*) AS n FROM responses').first();assert.equal(count.n,1);const conflict=await t.call(`/sessions/${s.sessionId}/answers`,{...a,response:999999},p.token);assert.equal(conflict.status,409);t.env.DB.close();});
test('profiles cannot read or write another participant session',async()=>{const t=setup(),a=await enrolled(t),b=await enrolled(t);const result=await t.call(`/sessions/${a.s.sessionId}/answers`,answer(a.next),b.p.token);assert.equal(result.status,404);assert.equal((await t.call(`/sessions/${a.s.sessionId}/report`,null,b.p.token)).status,404);t.env.DB.close();});
test('assessment withholds feedback, disallows retries and requires sign-in for assigned mode',async()=>{const t=setup(),{p,s,next}=await enrolled(t,'assessment');const a=answer(next),r=await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);assert.equal(r.status,200);assert.equal(r.correct,undefined);assert.equal((await t.call(`/sessions/${s.sessionId}/hint`,{presentationId:next.presentationId},p.token)).status,403);assert.equal((await t.call('/sessions',{course:'ap-micro',mode:'assessment',assigned:true},p.token)).status,403);assert.equal((await t.call(`/sessions/${s.sessionId}/answers`,{...a,eventId:crypto.randomUUID(),attemptNumber:2},p.token)).status,409);await t.call(`/sessions/${s.sessionId}/complete`,{},p.token);const report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(report.rows[0].correct,true);t.env.DB.close();});
test('repeated next calls return the same outstanding presentation',async()=>{const t=setup(),{p,s,next}=await enrolled(t);const r=await t.call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(r.presentationId,next.presentationId);t.env.DB.close();});
test('admin exports are private and record an audit entry',async()=>{const t=setup(),{p,s,next}=await enrolled(t);await t.call(`/sessions/${s.sessionId}/answers`,answer(next),p.token);assert.equal((await t.call('/admin/responses',null,p.token)).status,403);const exported=await t.call('/admin/responses',null,'test-only-admin');assert.equal(exported.rows.length,1);assert.equal(exported.hasMore,false);assert.equal((await t.env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log').first()).n,1);t.env.DB.close();});
test('untrusted origins and invalid consent are rejected',async()=>{const t=setup();assert.equal((await t.call('/profiles',{accepted:false,consentVersion:CONSENT_VERSION})).status,400);const r=await worker.fetch(new Request('https://api.example/health',{headers:{Origin:'https://untrusted.example'}}),t.env);assert.equal(r.status,403);t.env.DB.close();});
test('late and post-completion answers are retained exactly once but excluded from measurement',async()=>{
 for(const reason of ['late-receipt','after-completion']){
  const t=setup(),{p,s,next}=await enrolled(t,'assessment');
  if(reason==='late-receipt')await t.env.DB.prepare('UPDATE sessions SET expires_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z',s.sessionId).run();
  else await t.call(`/sessions/${s.sessionId}/complete`,{},p.token);
  const a=answer(next),r=await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);
  assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.persisted,true);assert.equal(r.validity,reason);assert.equal(r.countsTowardResult,false);
  const retry=await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);assert.equal(retry.validity,reason);assert.equal(retry.receipt,r.receipt);
  const stored=await t.env.DB.prepare('SELECT COUNT(*) AS n,calibration_eligible FROM responses').first();assert.equal(stored.n,1);assert.equal(stored.calibration_eligible,0);
  const report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(report.rows[0].countsTowardResult,false);assert.equal(report.rows[0].validity,reason);
  assert.equal((await t.call(`/sessions/${s.sessionId}/next`,{},p.token)).status,409);t.env.DB.close();
 }
});
test('instructor student pagination returns every profile once across multiple pages',async()=>{
 const t=setup(),ids=[];
 for(let i=0;i<205;i++){const id=crypto.randomUUID();ids.push(id);await t.env.DB.prepare('INSERT INTO participants (id,created_at,identity_kind,consent_version,consent_at,verified_email) VALUES (?,?,?,?,?,?)').bind(id,new Date().toISOString(),'account',CONSENT_VERSION,new Date().toISOString(),`synthetic-${i}@example.test`).run();}
 const {readAllPages}=await import('../../src/scripts/econ-pages.mjs');let requests=0;
 const rows=await readAllPages(async path=>{requests++;const page=await t.call(path,null,'test-only-admin');assert.equal(page.status,200);assert.ok(page.students.length<=100);return page;},'/admin/students','students');
 assert.equal(requests,3);assert.deepEqual(rows.map(r=>r.id),ids.sort());
 assert.equal((await t.call('/admin/students?after=invalid',null,'test-only-admin')).status,400);t.env.DB.close();
});
test('client list retrieval fails visibly if a cursor repeats',async()=>{
 const {readAllPages}=await import('../../src/scripts/econ-pages.mjs');
 await assert.rejects(readAllPages(async()=>({students:[],hasMore:true,nextCursor:'same'}),'/admin/students','students'),/did not advance/);
});
