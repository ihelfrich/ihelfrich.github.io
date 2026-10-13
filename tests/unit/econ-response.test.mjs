import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import worker,{CONSENT_VERSION} from '../../services/econ-response/worker.mjs';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import {buildBank} from '../../src/lib/econ-practice/index.mjs';
const bank=new Map(buildBank().map(q=>[q.id,q]));
function setup(){const DB=createLocalDB();for(const file of readdirSync(new URL('../../services/econ-response/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())DB.exec(readFileSync(new URL(`../../services/econ-response/migrations/${file}`,import.meta.url),'utf8'));const env={DB,ADMIN_TOKEN:'test-only-admin',ALLOW_BOOTSTRAP_ADMIN:'true',ALLOWED_ORIGINS:'https://ihelfrich.github.io'};return {env,call:async(path,data,token,method=data?'POST':'GET')=>{const res=await worker.fetch(new Request(`https://api.example${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:res.status,...await res.json()};}};}
async function enrolled(t,mode='practice'){const p=await t.call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});assert.equal(p.status,200);const s=await t.call('/sessions',{course:'ap-micro',mode},p.token);assert.equal(s.status,200);const next=await t.call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(next.status,200);return {p,s,next};}
function answer(next){const q=bank.get(next.item.id);return {eventId:crypto.randomUUID(),presentationId:next.presentationId,attemptNumber:1,response:q.format==='multipart'?Object.fromEntries(q.parts.map(p=>[p.id,p.answer])):q.format==='choice'?q.answerIndex:q.answer,elapsedMs:5000,activeMs:4500,submittedAt:new Date().toISOString()};}
test('answer receipt proves durable storage and duplicate retry does not create another row',async()=>{const t=setup(),{p,s,next}=await enrolled(t);assert.equal(next.item.answer,undefined);assert.equal(next.item.answerIndex,undefined);const a=answer(next);const r=await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.persisted,true);assert.equal(r.correct,true);const retry=await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);assert.equal(retry.receipt,r.receipt);const count=await t.env.DB.prepare('SELECT COUNT(*) AS n FROM responses').first();assert.equal(count.n,1);const conflict=await t.call(`/sessions/${s.sessionId}/answers`,{...a,activeMs:4000},p.token);assert.equal(conflict.status,200);assert.equal(conflict.persisted,true);assert.equal(conflict.countsTowardResult,false);assert.ok(conflict.receiptId);t.env.DB.close();});
test('profiles cannot read or write another participant session',async()=>{const t=setup(),a=await enrolled(t),b=await enrolled(t);const result=await t.call(`/sessions/${a.s.sessionId}/answers`,answer(a.next),b.p.token);assert.equal(result.status,404);assert.equal((await t.call(`/sessions/${a.s.sessionId}/report`,null,b.p.token)).status,404);t.env.DB.close();});
test('assessment withholds feedback, disallows retries and requires sign-in for assigned mode',async()=>{const t=setup(),{p,s,next}=await enrolled(t,'assessment');const a=answer(next),r=await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);assert.equal(r.status,200);assert.equal(r.correct,undefined);assert.equal((await t.call(`/sessions/${s.sessionId}/hint`,{presentationId:next.presentationId},p.token)).status,403);assert.equal((await t.call('/sessions',{course:'ap-micro',mode:'assessment',assigned:true},p.token)).status,403);assert.equal((await t.call(`/sessions/${s.sessionId}/answers`,{...a,eventId:crypto.randomUUID(),attemptNumber:2},p.token)).countsTowardResult,false);await t.call(`/sessions/${s.sessionId}/complete`,{},p.token);const report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(report.rows[0].correct,true);t.env.DB.close();});
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
test('participant history export isolates owners and withholds unfinished assessment keys',async()=>{
 const t=setup(),a=await enrolled(t,'assessment'),b=await enrolled(t);
 await t.call(`/sessions/${a.s.sessionId}/answers`,answer(a.next),a.p.token);
 await t.call(`/sessions/${b.s.sessionId}/answers`,answer(b.next),b.p.token);
 const first=await t.call('/profile/responses',null,a.p.token);assert.equal(first.status,200);assert.equal(first.rows.length,1);assert.equal(first.rows[0].sessionId,a.s.sessionId);assert.equal(first.rows[0].correct,undefined);assert.equal(first.rows[0].item.answer,undefined);assert.equal(first.rows[0].item.answerIndex,undefined);assert.equal(first.rows[0].item.explanation,undefined);
 assert.equal((await t.call(`/profile/responses?after=${first.nextCursor}`,null,a.p.token)).rows.length,0);
 await t.call(`/sessions/${a.s.sessionId}/complete`,{},a.p.token);
 const completed=await t.call('/profile/responses',null,a.p.token);assert.equal(completed.rows[0].correct,true);assert.ok(completed.rows[0].explanation);
 assert.equal((await t.call('/profile/responses?after=-1',null,a.p.token)).status,400);t.env.DB.close();
});
test('a missing historical archive preserves outstanding answers and returns a recoverable error',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t,'assessment');
 await t.env.DB.prepare('UPDATE sessions SET bank_version=? WHERE id=?').bind('previous-bank',s.sessionId).run();
 const outstanding=await t.call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(outstanding.presentationId,next.presentationId);
 const saved=await t.call(`/sessions/${s.sessionId}/answers`,answer(next),p.token);assert.equal(saved.persisted,true);
 const finished=await t.call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(finished.status,503);assert.equal(finished.done,undefined);
 assert.equal((await t.env.DB.prepare('SELECT COUNT(*) AS n FROM presentations WHERE session_id=?').bind(s.sessionId).first()).n,1);
 await t.call(`/sessions/${s.sessionId}/complete`,{},p.token);const report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(report.bankVersion,'previous-bank');assert.notEqual(report.currentBankVersion,report.bankVersion);assert.equal(report.rows.length,1);assert.equal(report.rows[0].correct,true);t.env.DB.close();
});
test('multipart partial credit is durably stored and excluded from binary calibration',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t,'assessment');
 const item={...bank.get(next.item.id),format:'multipart',parts:[{id:'q',prompt:'Quantity',answer:20,tolerance:.005,points:2,explanation:'Solve quantity.'},{id:'p',prompt:'Price',answer:40,tolerance:.005,points:1,explanation:'Substitute quantity.'}]};
 await t.env.DB.prepare('UPDATE presentations SET item_snapshot_json=? WHERE id=?').bind(JSON.stringify(item),next.presentationId).run();
 const shown=await t.call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(shown.item.parts[0].answer,undefined);
 const r=await t.call(`/sessions/${s.sessionId}/answers`,{...answer(next),response:{q:20,p:41}},p.token);assert.equal(r.persisted,true);assert.equal(r.score,undefined);
 const stored=await t.env.DB.prepare('SELECT score,correct,calibration_eligible,raw_answer_json FROM responses').first();assert.equal(stored.score,2/3);assert.equal(stored.correct,0);assert.equal(stored.calibration_eligible,0);assert.deepEqual(JSON.parse(stored.raw_answer_json),{q:20,p:41});
 await t.call(`/sessions/${s.sessionId}/complete`,{},p.token);const report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(report.rows[0].score,2/3);assert.equal(report.rows[0].parts[0].earned,2);t.env.DB.close();
});
test('malformed request bodies fail without creating participant or response records',async()=>{
 const t=setup();
 for(const raw of ['null','[]','1','"text"','{bad',JSON.stringify({accepted:true,consentVersion:CONSENT_VERSION,padding:'x'.repeat(9000)})]){
  const res=await worker.fetch(new Request('https://api.example/profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:raw}),t.env);
  assert.equal(res.status,raw.length>8192?413:400);
 }
 assert.equal((await t.env.DB.prepare('SELECT COUNT(*) AS n FROM participants').first()).n,0);
 assert.equal((await t.env.DB.prepare('SELECT COUNT(*) AS n FROM responses').first()).n,0);t.env.DB.close();
});

test('concurrent sessions mark only one first exposure to a question family',async()=>{
 const t=setup(),p=await t.call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
 const start=()=>t.call('/sessions',{course:'college-micro',mode:'assessment',topic:'1.2'},p.token);
 const sessions=await Promise.all([start(),start()]);sessions.forEach(s=>assert.equal(s.status,200));
 // Hold both presentation writes until both requests have finished their reads.
 const prepare=t.env.DB.prepare.bind(t.env.DB);let arrivals=0,release;
 const gate=new Promise(resolve=>{release=resolve;});
 t.env.DB.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('INSERT INTO presentations'))return statement;return {bind(...args){const bound=statement.bind(...args);return {...bound,run:async()=>{if(++arrivals===2)release();await gate;return bound.run();}};}};};
 const questions=await Promise.all(sessions.map(s=>t.call(`/sessions/${s.sessionId}/next`,{},p.token)));
 questions.forEach(q=>{assert.equal(q.status,200);assert.equal(q.item.family,'mrs');});
 const rows=(await t.env.DB.prepare('SELECT first_family_exposure FROM presentations').all()).results;
 assert.equal(rows.length,2);assert.equal(rows.reduce((sum,r)=>sum+r.first_family_exposure,0),1);
 const receipts=await Promise.all(sessions.map((s,i)=>t.call(`/sessions/${s.sessionId}/answers`,answer(questions[i]),p.token)));
 receipts.forEach(r=>assert.equal(r.status,200));
 const evidence=await t.env.DB.prepare('SELECT SUM(calibration_eligible) AS n FROM responses').first();assert.equal(evidence.n,1);t.env.DB.close();
});

test('concurrent retries return one durable receipt and conflicting events cannot replace it',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t,'assessment'),a=answer(next);
 const receipts=await Promise.all([t.call(`/sessions/${s.sessionId}/answers`,a,p.token),t.call(`/sessions/${s.sessionId}/answers`,a,p.token)]);
 receipts.forEach(r=>assert.equal(r.status,200));assert.equal(receipts[0].receipt,receipts[1].receipt);
 const conflict=await t.call(`/sessions/${s.sessionId}/answers`,{...a,eventId:crypto.randomUUID()},p.token);assert.equal(conflict.status,200);assert.equal(conflict.persisted,true);assert.equal(conflict.countsTowardResult,false);assert.ok(conflict.receiptId);
 const row=await t.env.DB.prepare('SELECT COUNT(*) AS n,event_id FROM responses').first();assert.equal(row.n,1);assert.equal(row.event_id,a.eventId);t.env.DB.close();
});

test('a hint committed during answer processing is captured at receipt time without retroactive changes',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t,'practice');
 const prepare=t.env.DB.prepare.bind(t.env.DB);let injected=false;
 t.env.DB.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('INSERT INTO responses'))return statement;return {bind(...args){const bound=statement.bind(...args);return {...bound,run:async()=>{
  if(!injected){injected=true;const hint=await t.call(`/sessions/${s.sessionId}/hint`,{presentationId:next.presentationId},p.token);assert.equal(hint.status,200);}
  return bound.run();
 }};}};};
 const receipt=await t.call(`/sessions/${s.sessionId}/answers`,answer(next),p.token);assert.equal(receipt.status,200);
 const stored=await t.env.DB.prepare('SELECT hints_used FROM responses').first();assert.equal(stored.hints_used,1);
 const later=await t.call(`/sessions/${s.sessionId}/hint`,{presentationId:next.presentationId},p.token);assert.equal(later.status,200);
 const unchanged=await t.env.DB.prepare('SELECT hints_used FROM responses').first();assert.equal(unchanged.hints_used,1);
 const report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(report.status,200);t.env.DB.close();
});

test('completion or expiry between selection and insertion cannot create another presentation',async()=>{
 for(const boundary of ['complete','expire']){
  const t=setup(),{p,s,next}=await enrolled(t,'assessment');await t.call(`/sessions/${s.sessionId}/answers`,answer(next),p.token);
  const prepare=t.env.DB.prepare.bind(t.env.DB);let injected=false;
  t.env.DB.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('INSERT INTO presentations'))return statement;return {bind(...args){const bound=statement.bind(...args);return {...bound,run:async()=>{
   if(!injected){injected=true;if(boundary==='complete'){const completed=await t.call(`/sessions/${s.sessionId}/complete`,{},p.token);assert.equal(completed.status,200);}else await prepare('UPDATE sessions SET expires_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z',s.sessionId).run();}
   return bound.run();
  }};}};};
  const result=await t.call(`/sessions/${s.sessionId}/next`,{},p.token);assert.equal(result.status,409,boundary);assert.equal(result.presentationId,undefined);
  const stored=await prepare('SELECT COUNT(*) AS n FROM presentations WHERE session_id=?').bind(s.sessionId).first();assert.equal(stored.n,1,boundary);t.env.DB.close();
 }
});

test('an answer delayed past expiry is retained with the actual database receipt time and excluded from scoring',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t,'assessment');const prepare=t.env.DB.prepare.bind(t.env.DB);let expiry,injected=false;
 t.env.DB.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('INSERT INTO responses'))return statement;return {bind(...args){const bound=statement.bind(...args);return {...bound,run:async()=>{
  if(!injected){injected=true;expiry=new Date(Date.now()+50).toISOString();await prepare('UPDATE sessions SET expires_at=? WHERE id=?').bind(expiry,s.sessionId).run();await new Promise(resolve=>setTimeout(resolve,100));}
  return bound.run();
 }};}};};
 const payload=answer(next),receipt=await t.call(`/sessions/${s.sessionId}/answers`,payload,p.token);
 assert.equal(receipt.status,200);assert.equal(receipt.persisted,true);assert.equal(receipt.validity,'late-receipt');assert.equal(receipt.countsTowardResult,false);assert.ok(receipt.receipt>=expiry);
 const stored=await prepare('SELECT raw_answer_json,server_received_at,calibration_eligible FROM responses').first();assert.equal(stored.raw_answer_json,JSON.stringify(payload.response));assert.equal(stored.server_received_at,receipt.receipt);assert.equal(stored.calibration_eligible,0);
 const retry=await t.call(`/sessions/${s.sessionId}/answers`,payload,p.token);assert.equal(retry.receipt,receipt.receipt);assert.equal(retry.validity,'late-receipt');t.env.DB.close();
});

test('private history exports and student-directory reads identify the authenticated instructor',async()=>{
 const t=setup();t.env.INSTRUCTOR_SUBJECT_HASHES='synthetic-instructor-a,synthetic-instructor-b';
 const instructors=[];
 for(const subject of t.env.INSTRUCTOR_SUBJECT_HASHES.split(',')){
  const p=await t.call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  await t.env.DB.prepare("UPDATE participants SET identity_kind='account',identity_subject_hash=? WHERE id=?").bind(subject,p.participantId).run();instructors.push(p);
 }
 for(const p of instructors){assert.equal((await t.call('/admin/responses',null,p.token)).status,200);assert.equal((await t.call('/admin/students',null,p.token)).status,200);}
 const rows=(await t.env.DB.prepare('SELECT actor,action,details_json FROM audit_log ORDER BY rowid').all()).results;
 assert.deepEqual(rows.map(r=>[r.actor,r.action]),instructors.flatMap(p=>[[p.participantId,'response-export'],[p.participantId,'student-directory-read']]));
 assert.equal(rows.some(r=>r.details_json.includes('verified_email')),false);
 const assignment=await t.call('/admin/assignments',{title:'Synthetic audit test',course:'ap-micro',itemCount:6,maxAttempts:1,opensAt:new Date(Date.now()-1000).toISOString(),closesAt:new Date(Date.now()+60000).toISOString(),participantIds:[instructors[1].participantId]},instructors[0].token);assert.equal(assignment.status,200);
 assert.equal((await t.call('/admin/assignments/'+assignment.assignmentId,null,instructors[0].token)).status,200);
 const access=await t.env.DB.prepare("SELECT actor,target FROM audit_log WHERE action='assignment-report-read'").first();assert.equal(access.actor,instructors[0].participantId);assert.equal(access.target,assignment.assignmentId);
 const outsider=await t.call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});assert.equal((await t.call('/admin/responses',null,outsider.token)).status,403);
 assert.equal((await t.env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log').first()).n,6);t.env.DB.close();
});

test('response exports pin their ledger boundary while later answers continue arriving',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t);await t.call(`/sessions/${s.sessionId}/answers`,answer(next),p.token);
 // Synthetic receipt fixtures isolate pagination from the interactive attempt limit.
 for(let i=2;i<=501;i++)await t.env.DB.prepare(`INSERT INTO responses (event_id,presentation_id,session_id,participant_id,attempt_number,raw_answer_json,correct,score,client_submitted_at,server_received_at,elapsed_ms,active_ms,hints_used,feedback_before_answer,validity,calibration_eligible,payload_sha256) SELECT ?,presentation_id,session_id,participant_id,?,raw_answer_json,correct,score,client_submitted_at,server_received_at,elapsed_ms,active_ms,hints_used,feedback_before_answer,validity,0,payload_sha256 FROM responses WHERE ledger_sequence=1`).bind(crypto.randomUUID(),i).run();
 for(const [route,token] of [['/profile/responses',p.token],['/admin/responses','test-only-admin']]){
  const first=await t.call(route,null,token);assert.equal(first.rows.length,500);assert.equal(first.hasMore,true);
  const before=first.snapshotThrough;
  await t.env.DB.prepare(`INSERT INTO responses (event_id,presentation_id,session_id,participant_id,attempt_number,raw_answer_json,correct,score,client_submitted_at,server_received_at,elapsed_ms,active_ms,hints_used,feedback_before_answer,validity,calibration_eligible,payload_sha256) SELECT ?,presentation_id,session_id,participant_id,?,raw_answer_json,correct,score,client_submitted_at,server_received_at,elapsed_ms,active_ms,hints_used,feedback_before_answer,validity,0,payload_sha256 FROM responses WHERE ledger_sequence=1`).bind(crypto.randomUUID(),before+1).run();
  const second=await t.call(route+'?after='+encodeURIComponent(first.nextCursor),null,token);assert.equal(second.status,200);assert.equal(second.snapshotThrough,before);assert.equal(second.rows.length,before-500);assert.equal(second.hasMore,false);
  const fresh=await t.call(route,null,token);assert.equal(fresh.snapshotThrough,before+1);
  assert.equal((await t.call(route+'?after=v1:10:2',null,token)).status,400);
 }
 t.env.DB.close();
});

test('instructor summary separates practice retries, first attempts, assessments and excluded receipts',async()=>{
 const t=setup(),practice=await enrolled(t,'practice'),a=answer(practice.next),item=bank.get(practice.next.item.id);
 const wrong=item.format==='choice'?(a.response+1)%item.options.length:item.format==='multipart'?Object.fromEntries(Object.entries(a.response).map(([k,v])=>[k,v+100])):a.response+100;
 await t.call(`/sessions/${practice.s.sessionId}/answers`,{...a,response:wrong},practice.p.token);
 await t.call(`/sessions/${practice.s.sessionId}/answers`,{...a,eventId:crypto.randomUUID(),attemptNumber:2},practice.p.token);
 const assessment=await enrolled(t,'assessment');await t.call(`/sessions/${assessment.s.sessionId}/answers`,answer(assessment.next),assessment.p.token);
 const late=await enrolled(t,'practice');await t.call(`/sessions/${late.s.sessionId}/complete`,{},late.p.token);await t.call(`/sessions/${late.s.sessionId}/answers`,answer(late.next),late.p.token);
 const report=await t.call('/admin/summary',null,'test-only-admin');assert.equal(report.status,200);assert.equal(report.courses.length,2);
 const p=report.courses.find(r=>r.mode==='practice'),d=report.courses.find(r=>r.mode==='assessment');
 assert.equal(p.responses,3);assert.equal(p.countedAttempts,2);assert.equal(p.excludedReceipts,1);assert.equal(p.attemptAccuracy,.5);assert.equal(p.firstAttempts,1);assert.equal(p.firstAttemptAccuracy,0);assert.equal(p.firstAttemptMeanCredit,0);
 assert.equal(d.responses,1);assert.equal(d.firstAttempts,1);assert.equal(d.firstAttemptAccuracy,1);assert.equal(d.firstAttemptMeanCredit,1);t.env.DB.close();
});

test('conflicting submissions have durable idempotent receipts and private exports without changing scores',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t,'assessment'),a=answer(next),path=`/sessions/${s.sessionId}/answers`;
 const original=await t.call(path,a,p.token);
 const alternate={...a,eventId:crypto.randomUUID(),activeMs:4000};
 const receipts=await Promise.all([t.call(path,alternate,p.token),t.call(path,alternate,p.token)]);
 for(const r of receipts){assert.equal(r.status,200);assert.equal(r.persisted,true);assert.equal(r.countsTowardResult,false);assert.equal(r.correct,undefined);assert.equal(r.calibrationEligible,false);}
 assert.equal(receipts[0].receiptId,receipts[1].receiptId);assert.equal(receipts[0].receipt,receipts[1].receipt);
 const changed={...a,activeMs:3500};const conflict=await t.call(path,changed,p.token);assert.equal(conflict.validity,'idempotency-conflict');
 const originalRetry=await t.call(path,a,p.token);assert.equal(originalRetry.receipt,original.receipt);assert.equal(originalRetry.receiptId,undefined);
 const history=await t.call('/profile/unscored-submissions',null,p.token);assert.equal(history.rows.length,2);assert.deepEqual(JSON.parse(history.rows[0].payload_json),alternate);
 const stranger=await enrolled(t);assert.equal((await t.call('/profile/unscored-submissions',null,stranger.p.token)).rows.length,0);
 assert.equal((await t.call('/admin/unscored-submissions',null,p.token)).status,403);
 const exported=await t.call('/admin/unscored-submissions',null,'test-only-admin');assert.equal(exported.rows.length,2);
 assert.equal((await t.env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='unscored-submission-export'").first()).n,1);
 const summary=await t.call('/admin/summary',null,'test-only-admin');assert.equal(summary.courses[0].responses,1);
 assert.equal((await t.call(`/sessions/${s.sessionId}/report`,null,p.token)).rows.length,1);
 // An invalid shape and another participant's presentation are not accepted into this ledger.
 assert.equal((await t.call(path,{...a,eventId:crypto.randomUUID(),response:[]},p.token)).status,400);
 assert.equal((await t.call(path,{...a,eventId:crypto.randomUUID(),presentationId:stranger.next.presentationId},p.token)).status,404);
 assert.equal((await t.call('/profile/unscored-submissions',null,p.token)).rows.length,2);
 t.env.DB.close();
});

test('a retained out-of-sequence submission never becomes scored on a later retry',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t),a=answer(next),path=`/sessions/${s.sessionId}/answers`,early={...a,eventId:crypto.randomUUID(),attemptNumber:2};
 const retained=await t.call(path,early,p.token);assert.equal(retained.validity,'attempt-sequence-conflict');
 await t.call(path,a,p.token);
 const retry=await t.call(path,early,p.token);assert.equal(retry.receiptId,retained.receiptId);assert.equal(retry.countsTowardResult,false);
 assert.equal((await t.env.DB.prepare('SELECT COUNT(*) AS n FROM responses').first()).n,1);
 const fresh=await t.call(path,{...early,eventId:crypto.randomUUID()},p.token);assert.equal(fresh.countsTowardResult,true);
 t.env.DB.close();
});

test('anonymous linking transfers separately retained submissions and preserves their receipt identity',async()=>{
 const {createChallenge,finishSignIn}=await import('../../services/econ-response/auth.mjs');
 const t=setup(),{p,s,next}=await enrolled(t),a=answer(next),path=`/sessions/${s.sessionId}/answers`;
 await t.call(path,a,p.token);const alternate={...a,eventId:crypto.randomUUID()};const receipt=await t.call(path,alternate,p.token);
 const anonymous=await t.env.DB.prepare('SELECT * FROM participants WHERE id=?').bind(p.participantId).first();
 t.env.GOOGLE_CLIENT_ID='test-only-client';const challenge=await createChallenge(t.env,anonymous);
 const signed=await finishSignIn(t.env,anonymous,{challengeId:challenge.challengeId,credential:'test-only',accepted:true,consentVersion:CONSENT_VERSION,linkAnonymous:true},async()=>({subjectHash:'test-link-submission',email:'link@example.test'}));
 const history=await t.call('/profile/unscored-submissions',null,signed.token);assert.equal(history.rows.length,1);assert.equal(history.rows[0].participant_id,signed.participantId);assert.equal(history.rows[0].receipt_id,receipt.receiptId);
 assert.equal((await t.call(path,alternate,signed.token)).receiptId,receipt.receiptId);
 assert.equal((await t.call('/profile/unscored-submissions',null,p.token)).status,401);t.env.DB.close();
});

test('unscored export pagination pins its own boundary while new submissions arrive',async()=>{
 const t=setup(),{p,s,next}=await enrolled(t),a=answer(next),path=`/sessions/${s.sessionId}/answers`;
 const retained=await t.call(path,{...a,attemptNumber:3},p.token);assert.ok(retained.receiptId);
 for(let i=0;i<500;i++)await t.env.DB.prepare("INSERT INTO unscored_submissions (receipt_id,participant_id,session_id,presentation_id,event_id,payload_sha256,payload_json,reason,server_received_at) VALUES (?,?,?,?,?,?,?,'attempt-sequence-conflict',?)").bind(crypto.randomUUID(),p.participantId,s.sessionId,next.presentationId,crypto.randomUUID(),`fixture-${i}`,'{}',new Date().toISOString()).run();
 const first=await t.call('/profile/unscored-submissions',null,p.token);assert.equal(first.rows.length,500);assert.equal(first.hasMore,true);assert.equal(first.snapshotThrough,501);
 await t.call(path,{...a,eventId:crypto.randomUUID(),attemptNumber:4},p.token);
 const last=await t.call(`/profile/unscored-submissions?after=${encodeURIComponent(first.nextCursor)}`,null,p.token);assert.equal(last.rows.length,1);assert.equal(last.hasMore,false);assert.equal(last.snapshotThrough,501);
 const refreshed=await t.call('/profile/unscored-submissions',null,p.token);assert.equal(refreshed.snapshotThrough,502);t.env.DB.close();
});

test('linking between authorization and insertion cannot strand an answer under the anonymous owner',async()=>{
 const {createChallenge,finishSignIn}=await import('../../services/econ-response/auth.mjs');
 for(const ledger of ['responses','unscored_submissions']){
  const t=setup(),{p,s,next}=await enrolled(t),a=answer(next),path=`/sessions/${s.sessionId}/answers`;
  if(ledger==='unscored_submissions')a.attemptNumber=3;
  t.env.GOOGLE_CLIENT_ID='test-only-client';
  const anonymous=await t.env.DB.prepare('SELECT * FROM participants WHERE id=?').bind(p.participantId).first();
  const challenge=await createChallenge(t.env,anonymous),prepare=t.env.DB.prepare.bind(t.env.DB);let signed;
  t.env.DB.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith(`INSERT INTO ${ledger} `))return statement;return {bind(...args){const bound=statement.bind(...args);return {...bound,run:async()=>{
   if(!signed)signed=await finishSignIn(t.env,anonymous,{challengeId:challenge.challengeId,credential:'test-only',accepted:true,consentVersion:CONSENT_VERSION,linkAnonymous:true},async()=>({subjectHash:'race-link',email:'race@example.test'}));
   return bound.run();
  }};}};};
  const interrupted=await t.call(path,a,p.token);assert.equal(interrupted.status,401,ledger);assert.equal(interrupted.persisted,undefined);
  assert.equal((await prepare(`SELECT COUNT(*) AS n FROM ${ledger} WHERE participant_id=?`).bind(p.participantId).first()).n,0);
  const retry=await t.call(path,a,signed.token);assert.equal(retry.status,200,ledger);assert.equal(retry.persisted,true);
  assert.equal((await prepare(`SELECT COUNT(*) AS n FROM ${ledger} WHERE participant_id=?`).bind(signed.participantId).first()).n,1);
  t.env.DB.close();
 }
});

test('bank archive rejects version reuse and detects missing chunks instead of ending sessions',async()=>{
 const {registerBank,archivedBank}=await import('../../services/econ-response/bank-archive.mjs');
 const t=setup(),items=[...bank.values()].filter(q=>q.course==='college-macro').map(q=>({...q,version:'archive-test'}));
 await registerBank(t.env.DB,'archive-test',items);await registerBank(t.env.DB,'archive-test',items);
 const archived=await archivedBank(t.env.DB,'archive-test','college-macro');assert.equal(archived.length,items.length);
 await assert.rejects(registerBank(t.env.DB,'archive-test',items.map((q,i)=>i? q:{...q,prompt:'Changed'})),/without a new version/);
 await assert.rejects(t.env.DB.prepare("UPDATE bank_chunks SET items_json='[]' WHERE version='archive-test'").run(),/immutable/);
 await t.env.DB.prepare("DELETE FROM bank_chunks WHERE version='archive-test' AND unit=?").bind(items[0].unit).run();
 await assert.rejects(archivedBank(t.env.DB,'archive-test','college-macro'),/incomplete/);t.env.DB.close();
});

test('presentations retain and export the exact parameters returned by selection',async()=>{
 const {itemParameters}=await import('../../src/lib/econ-practice/irt.mjs');
 const t=setup(),{p,s,next}=await enrolled(t,'assessment');
 const row=await t.env.DB.prepare('SELECT * FROM presentations WHERE id=?').bind(next.presentationId).first();
 await assert.rejects(t.env.DB.prepare('UPDATE presentations SET model_version=? WHERE id=?').bind('changed',next.presentationId).run(),/immutable/);
 const params=JSON.parse(row.measurement_parameters_json);assert.deepEqual(params,itemParameters(JSON.parse(row.item_snapshot_json)));assert.equal(params.modelVersion,row.model_version);
 await t.call(`/sessions/${s.sessionId}/answers`,answer(next),p.token);
 const exported=await t.call('/admin/responses',null,'test-only-admin');assert.deepEqual(JSON.parse(exported.rows[0].measurement_parameters_json),params);t.env.DB.close();
});

test('question library protects keys, audits access, and paginates the complete filtered bank',async()=>{
 const t=setup();try{
  const p=await t.call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  assert.equal((await t.call('/admin/questions',null,p.token)).status,403);
  assert.equal((await t.call('/admin/questions')).status,401);
  const ids=[];let cursor='',version='',hasMore=true;
  while(hasMore){const page=await t.call(`/admin/questions?course=ap-micro&unit=1&after=${encodeURIComponent(cursor)}${version?`&version=${encodeURIComponent(version)}`:''}`,null,'test-only-admin');assert.equal(page.status,200);assert.ok(page.items.length<=30);for(const q of page.items){assert.deepEqual(q,bank.get(q.id));ids.push(q.id);}hasMore=page.hasMore;cursor=page.nextCursor;version=page.bankVersion;}
  assert.equal((await t.call('/admin/questions?version=old-bank',null,'test-only-admin')).status,409);
  assert.equal((await t.call('/admin/questions?after=some-id',null,'test-only-admin')).status,400);
  const expected=[...bank.values()].filter(q=>q.course==='ap-micro'&&q.unit===1).map(q=>q.id).sort();assert.deepEqual(ids,expected);
  assert.ok((await t.env.DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='question-library-read'").first()).n>0);
  assert.equal((await t.call('/admin/questions?course=invalid',null,'test-only-admin')).status,400);
 }finally{t.env.DB.close();}
});

test('session report distinguishes planned, presented, unanswered and repeated attempts',async()=>{
 const t=setup();try{const {p,s,next}=await enrolled(t);let report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.deepEqual(report.coverage,{planned:36,presented:1,unanswered:1,answered:0});const a=answer(next);await t.call(`/sessions/${s.sessionId}/answers`,a,p.token);await t.call(`/sessions/${s.sessionId}/answers`,{...a,eventId:crypto.randomUUID(),attemptNumber:2},p.token);await t.call(`/sessions/${s.sessionId}/next`,{},p.token);report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.deepEqual(report.coverage,{planned:36,presented:2,unanswered:1,answered:1});assert.equal(report.rows.length,2);assert.deepEqual(report.rows.map(r=>r.attemptNumber),[1,2]);assert.ok(report.rows.every(r=>r.sequence===1&&r.presentationId===next.presentationId));}finally{t.env.DB.close();}
});

test('instructor assignment report separates unanswered questions from excluded receipts',async()=>{
 const t=setup();try{
  const {p,s,next}=await enrolled(t,'assessment'),assignmentId=crypto.randomUUID(),at=new Date().toISOString();
  await t.env.DB.prepare('INSERT INTO assignments (id,title,course,bank_version,item_count,max_attempts,opens_at,closes_at,created_at,created_by,unit_filter,topic_filter) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(assignmentId,'Test report','ap-micro',[...bank.values()][0].version,6,1,at,'2099-01-01T00:00:00Z',at,'test',0,'').run();
  await t.env.DB.prepare('UPDATE sessions SET assignment_id=?,assignment_attempt=1,target_count=6 WHERE id=?').bind(assignmentId,s.sessionId).run();
  const {assignmentReport}=await import('../../services/econ-response/assignments.mjs');
  let report=await assignmentReport(t.env,assignmentId);assert.equal(report.sessions[0].presented,1);assert.equal(report.sessions[0].unanswered,1);assert.equal(report.sessions[0].answered,0);
  await t.call(`/sessions/${s.sessionId}/complete`,{},p.token);await t.call(`/sessions/${s.sessionId}/answers`,answer(next),p.token);
  report=await assignmentReport(t.env,assignmentId);assert.equal(report.sessions[0].received,1);assert.equal(report.sessions[0].answered,0);assert.equal(report.sessions[0].unanswered,0);assert.equal(report.sessions[0].total_credit,0);assert.equal(report.sessions[0].separately_retained,0);
 }finally{t.env.DB.close();}
});

test('hint content and version are durable and counted atomically in the owner report',async()=>{
 const t=setup();try{const {p,s,next}=await enrolled(t);const hint=await t.call(`/sessions/${s.sessionId}/hint`,{presentationId:next.presentationId},p.token);assert.equal(hint.status,200);assert.ok(hint.hintId);const stored=await t.env.DB.prepare('SELECT * FROM hint_events WHERE id=?').bind(hint.hintId).first();assert.equal(stored.hint_text,hint.hint);assert.equal(stored.hint_version,hint.hintVersion);assert.equal((await t.env.DB.prepare('SELECT hints_used FROM presentations WHERE id=?').bind(next.presentationId).first()).hints_used,1);const report=await t.call(`/sessions/${s.sessionId}/report`,null,p.token);assert.equal(report.hints[0].id,hint.hintId);await assert.rejects(t.env.DB.prepare('UPDATE hint_events SET hint_text=? WHERE id=?').bind('changed',hint.hintId).run(),/immutable/);await t.call(`/sessions/${s.sessionId}/complete`,{},p.token);assert.equal((await t.call(`/sessions/${s.sessionId}/hint`,{presentationId:next.presentationId},p.token)).status,409);assert.equal((await t.env.DB.prepare('SELECT COUNT(*) n FROM hint_events').first()).n,1);}finally{t.env.DB.close();}
});

test('instructor hint export is private and freezes its ledger boundary across pages',async()=>{
 const t=setup();try{const {p,s,next}=await enrolled(t);assert.equal((await t.call('/admin/hints',null,p.token)).status,403);
 for(let i=0;i<501;i++)await t.env.DB.prepare('INSERT INTO hint_events (id,presentation_id,hint_version,hint_scope,hint_text) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),next.presentationId,'test','test','Synthetic guidance').run();
 const first=await t.call('/admin/hints',null,'test-only-admin');assert.equal(first.rows.length,500);assert.equal(first.hasMore,true);assert.equal(first.snapshotThrough,501);assert.equal(first.rows[0].participant_id,p.participantId);
 await t.call(`/sessions/${s.sessionId}/hint`,{presentationId:next.presentationId},p.token);
 const last=await t.call(`/admin/hints?after=${encodeURIComponent(first.nextCursor)}`,null,'test-only-admin');assert.equal(last.rows.length,1);assert.equal(last.hasMore,false);assert.equal(last.snapshotThrough,501);assert.equal((await t.env.DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='hint-export'").first()).n,2);
 }finally{t.env.DB.close();}
});
