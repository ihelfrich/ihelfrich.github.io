import {recordModelRelease,latestModelRelease} from '../../services/econ-response/model-releases.mjs';
import {sessionModels,prepareSessionModels,sessionModelPinStatement} from '../../services/econ-response/session-models.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import worker from '../../services/econ-response/worker.mjs';
import {CONSENT_VERSION} from '../../services/econ-response/common.mjs';
import {buildBank,BANK_VERSION} from '../../src/lib/econ-practice/index.mjs';
import {packageCandidate} from '../../scripts/econ-practice/package-candidate.mjs';
import {reportHash} from '../../scripts/econ-practice/validate-candidate.mjs';
function fixture({course,complete=false}={}){
 const DB=createLocalDB();for(const file of readdirSync(new URL('../../services/econ-response/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())DB.exec(readFileSync(new URL(`../../services/econ-response/migrations/${file}`,import.meta.url),'utf8'));
 const env={DB,ADMIN_TOKEN:'registry-test',ALLOW_BOOTSTRAP_ADMIN:'true'},item=buildBank().find(q=>course?q.course===course:q.format==='numeric');
 // Fabricated review/fit exercises transport and integrity; never an empirical calibration.
 const report={synthetic:false,matrixSHA256:'e'.repeat(64),bankVersion:BANK_VERSION,course:item.course,unit:item.unit,sourceSHA256:'d'.repeat(64),models:{'2PL':{converged:true,finiteParameters:true,positiveFiniteCovarianceDiagonal:true,holdout:{predictions:100},items:Object.fromEntries((complete?buildBank().filter(q=>q.course===item.course&&q.unit===item.unit&&q.format!=='multipart'):[item]).map(q=>[q.id,{a:1,b:0,c:0,d:1}]))}}};
 const review={reviewer:'Technical fixture only',reviewedAt:'2026-10-12T00:00:00Z',sourceSHA256:report.sourceSHA256,reportSHA256:reportHash(report),model:'2PL',bankVersion:BANK_VERSION,course:item.course,unit:item.unit,gates:Object.fromEntries(['content','dimensionality','localDependence','itemFit','fairness','catSimulation','linking','scoreInterpretation'].map(k=>[k,{decision:'accepted',evidence:'Fixture only',rationale:'No scientific validation implied'}]))};
 const artifact=packageCandidate(report,review);
 async function call(path,data,token='registry-test'){const response=await worker.fetch(new Request(`https://api.test${path}`,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(data?{body:JSON.stringify(data)}:{})}),env);return {httpStatus:response.status,...await response.json()};}
 return {DB,artifact,call};
}
test('instructor candidate registration is idempotent, audited, private and never activates a model',async()=>{
 const {DB,artifact,call}=fixture();try{
  const results=await Promise.all([call('/admin/model-packages',artifact),call('/admin/model-packages',artifact)]);
  for(const r of results){assert.equal(r.httpStatus,200);assert.equal(r.registered,true);assert.equal(r.activated,false);assert.equal(r.id,artifact.id);}
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM model_packages').first()).n,1);
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='model-package-registered'").first()).n,1);
  const read=await call(`/admin/model-packages/${artifact.id}`);assert.deepEqual(read.artifact,artifact);assert.equal(read.activated,false);
  const directory=await call('/admin/model-packages');
  assert.equal(directory.httpStatus,200);assert.equal(directory.packages.length,1);
  assert.equal(directory.packages[0].id,artifact.id);assert.equal(directory.packages[0].activated,false);
  assert.equal(directory.packages[0].artifact_json,undefined);assert.equal(directory.packages[0].created_by,undefined);
  assert.equal(directory.hasMore,false);assert.equal(directory.nextCursor,artifact.id);
  assert.deepEqual((await call('/admin/model-packages?after='+artifact.id)).packages,[]);
  assert.equal((await call('/admin/model-packages?after=invalid')).httpStatus,400);
  const student=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  assert.equal((await call('/admin/model-packages',artifact,student.token)).httpStatus,403);
  assert.equal((await call('/admin/model-packages',null,student.token)).httpStatus,403);
  assert.equal((await call(`/admin/model-packages/${artifact.id}`,null,student.token)).httpStatus,403);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM calibrations').first()).n,0);
  await assert.rejects(DB.prepare("UPDATE model_packages SET artifact_json='{}'").run(),/immutable/);
 }finally{DB.close();}
});
test('server independently rejects package tampering and oversized upload without registering it',async()=>{
 const {DB,artifact,call}=fixture();try{
  for(const mutate of [a=>a.parameters[Object.keys(a.parameters)[0]].b=3,a=>a.id='calibration-'+'0'.repeat(64),a=>a.review.gates.content.rationale='Changed',a=>a.bankItemHashes[Object.keys(a.bankItemHashes)[0]]='0'.repeat(64),a=>a.status='approved']){
   const changed=structuredClone(artifact);mutate(changed);assert.equal((await call('/admin/model-packages',changed)).httpStatus,400);
  }
  assert.equal((await call('/admin/model-packages',{padding:'x'.repeat(1024*1024)})).httpStatus,413);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM model_packages').first()).n,0);
 }finally{DB.close();}
});

test('local transaction batches roll back entirely and do not interleave under concurrent calls',async()=>{
 const DB=createLocalDB();DB.exec('CREATE TABLE fixture (id INTEGER PRIMARY KEY)');
 try{
  const results=await Promise.allSettled([
   DB.batch([DB.prepare('INSERT INTO fixture VALUES (1)'),DB.prepare('INSERT INTO fixture VALUES (1)')]),
   DB.batch([DB.prepare('INSERT INTO fixture VALUES (2)'),DB.prepare('INSERT INTO fixture VALUES (3)')])
  ]);
  assert.equal(results[0].status,'rejected');assert.equal(results[1].status,'fulfilled');
  assert.deepEqual((await DB.prepare('SELECT id FROM fixture ORDER BY id').all()).results.map(r=>r.id),[2,3]);
 }finally{DB.close();}
});

test('session model pins require approved matching scope and remain immutable',async()=>{
 const {DB,artifact,call}=fixture();try{
  await call('/admin/model-packages',artifact);
  const profile=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  async function legacySession(){const id=crypto.randomUUID();await DB.prepare('INSERT INTO sessions (id,participant_id,course,mode,bank_version,started_at,token_hash,expires_at,assigned,unit_filter,topic_filter) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,profile.participantId,artifact.course,'assessment',artifact.bankVersion,new Date().toISOString(),'participant-auth',new Date(Date.now()+86400000).toISOString(),0,artifact.unit,'').run();return {sessionId:id};}
  const session=await legacySession();
  const insert=map=>DB.prepare('INSERT INTO session_model_pins VALUES (?,?,?,?,?)').bind(session.sessionId,artifact.bankVersion,artifact.course,JSON.stringify(map),'2026-10-13').run();
  await assert.rejects(insert({[artifact.unit]:'not-approved'}),/approval mismatch/);
  await DB.prepare('INSERT INTO model_approvals VALUES (?,?,?,?,?)').bind('approval-test',artifact.id,'2026-10-13','fixture','Technical fixture, not scientific approval').run();
  await assert.rejects(insert({[artifact.unit+1]:'approval-test'}),/approval mismatch/);
  await assert.rejects(insert({[artifact.unit]:42}),/approval mismatch/);
  await insert({[artifact.unit]:'approval-test'});
  const storedSession=await DB.prepare('SELECT * FROM sessions WHERE id=?').bind(session.sessionId).first();
  const models=await sessionModels({DB},storedSession);
  assert.equal(models[artifact.unit].id,artifact.id);assert.equal(models[artifact.unit].approvalId,'approval-test');
  assert.deepEqual(models[artifact.unit].items,artifact.parameters);
  const next=await call('/sessions/'+session.sessionId+'/next',{},profile.token);
  assert.equal(next.httpStatus,200);assert.equal(next.item.id,Object.keys(artifact.parameters)[0]);
  const presentation=await DB.prepare('SELECT * FROM presentations WHERE session_id=?').bind(session.sessionId).first();
  assert.equal(presentation.model_version,artifact.id);
  assert.equal(JSON.parse(presentation.measurement_parameters_json).status,'calibrated');
  await assert.rejects(sessionModels({DB},{...storedSession,course:'wrong'}),/scope/);
  await assert.rejects(DB.prepare("UPDATE session_model_pins SET approvals_json='{}'").run(),/immutable/);
  await assert.rejects(DB.prepare('DELETE FROM session_model_pins').run(),/retained/);
  await assert.rejects(DB.prepare("UPDATE model_approvals SET rationale='changed'").run(),/immutable/);
  await assert.rejects(DB.prepare('DELETE FROM model_approvals').run(),/retained/);
  const legacy=await legacySession();
  await DB.prepare('INSERT INTO session_model_pins VALUES (?,?,?,?,?)').bind(legacy.sessionId,artifact.bankVersion,artifact.course,'{}','2026-10-13').run();
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM session_model_pins').first()).n,2);
  const emptySession=await DB.prepare('SELECT * FROM sessions WHERE id=?').bind(legacy.sessionId).first();
  assert.deepEqual(await sessionModels({DB},emptySession),{});
  const shown=await legacySession();
  const unpinned=await DB.prepare('SELECT * FROM sessions WHERE id=?').bind(shown.sessionId).first();
  assert.deepEqual(await sessionModels({DB},unpinned),{});
  assert.equal((await call('/sessions/'+shown.sessionId+'/next',{},profile.token)).httpStatus,200);
  await assert.rejects(DB.prepare('INSERT INTO session_model_pins VALUES (?,?,?,?,?)').bind(shown.sessionId,artifact.bankVersion,artifact.course,'{}','2026-10-13').run(),/before presentation/);
 }finally{DB.close();}
});

test('model approval requires explicit instructor decision and is idempotent without activation',async()=>{
 const {DB,artifact,call}=fixture();try{
  await call('/admin/model-packages',artifact);
  const path=`/admin/model-packages/${artifact.id}/approve`,body={confirmApproval:true,rationale:'Technical test approval only, no scientific inference.'};
  for(const invalid of [{},{rationale:'reason'},{confirmApproval:true,rationale:' '},{confirmApproval:true,rationale:'x'.repeat(2001)}])assert.equal((await call(path,invalid)).httpStatus,400);
  const profile=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  assert.equal((await call(path,body,profile.token)).httpStatus,403);
  const results=await Promise.all([call(path,body),call(path,body)]);
  for(const result of results){assert.equal(result.httpStatus,200);assert.equal(result.status,'approved');assert.equal(result.activated,false);}
  assert.equal(results[0].approvalId,results[1].approvalId);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM model_approvals').first()).n,1);
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='model-package-approved'").first()).n,1);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM session_model_pins').first()).n,0);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM calibrations').first()).n,0);
  assert.equal((await call('/admin/model-packages/calibration-'+'0'.repeat(64)+'/approve',body)).httpStatus,404);
 }finally{DB.close();}
});

test('release history supports withdrawal and rollback with atomic stale-write protection',async()=>{
 const {DB,artifact,call}=fixture(),env={DB},actor={id:'release-fixture'};
 try{
  await call('/admin/model-packages',artifact);
  const approved=await call(`/admin/model-packages/${artifact.id}/approve`,{confirmApproval:true,rationale:'Technical fixture only.'});
  const input={confirmRelease:true,bankVersion:artifact.bankVersion,course:artifact.course,unit:artifact.unit,approvalId:approved.approvalId,expectedReleaseId:null,rationale:'Exercise release transaction only.'};
  await assert.rejects(recordModelRelease(env,actor,{...input,confirmRelease:false}),/confirmation/);
  await assert.rejects(recordModelRelease(env,actor,{...input,unit:artifact.unit+1}),/scope mismatch/);
  await assert.rejects(recordModelRelease(env,actor,{...input,approvalId:null}),/no active release/);
  const starts=await Promise.all([recordModelRelease(env,actor,input),recordModelRelease(env,actor,input)]);
  assert.equal(starts[0].release.id,starts[1].release.id);
  const first=starts[0].release;assert.equal(first.revision,1);
  assert.equal((await DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='model-release-recorded'").first()).n,1);
  const races=await Promise.allSettled([
   recordModelRelease(env,actor,{...input,expectedReleaseId:first.id,approvalId:null,rationale:'Withdraw for investigation.'}),
   recordModelRelease(env,actor,{...input,expectedReleaseId:first.id,approvalId:null,rationale:'Competing withdrawal.'})
  ]);
  assert.equal(races.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(races.find(x=>x.status==='rejected').reason.status,409);
  const withdrawn=await latestModelRelease(env,input);assert.equal(withdrawn.revision,2);assert.equal(withdrawn.approval_id,null);
  const rollback=await recordModelRelease(env,actor,{...input,expectedReleaseId:withdrawn.id,rationale:'Restore previously reviewed approval after investigation.'});
  assert.equal(rollback.release.revision,3);assert.equal(rollback.release.approval_id,approved.approvalId);
  assert.equal((await recordModelRelease(env,actor,input)).release.id,first.id,'Retry returns original receipt, never reinstates old state');
  assert.equal((await latestModelRelease(env,input)).id,rollback.release.id);
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM session_model_pins').first()).n,0);
  await assert.rejects(DB.prepare("UPDATE model_releases SET rationale='changed'").run(),/immutable/);
  await assert.rejects(DB.prepare('DELETE FROM model_releases').run(),/retained/);
  const raw=DB.prepare('INSERT INTO model_releases VALUES (?,?,?,?,?,?,?,?,?,?)');
  await assert.rejects(raw.bind('bad-scope',artifact.bankVersion,artifact.course,artifact.unit+1,approved.approvalId,null,1,'now',actor.id,'test').run(),/scope mismatch/);
  await assert.rejects(raw.bind('stale',artifact.bankVersion,artifact.course,artifact.unit,approved.approvalId,first.id,4,'now',actor.id,'test').run(),/reload/);
  assert.equal((await DB.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='model-release-recorded'").first()).n,3);
 }finally{DB.close();}
});

test('new assessments pin release snapshots; withdrawal only affects future starts',async()=>{
 const {DB,artifact,call}=fixture({course:'intro-econometrics',complete:true}),env={DB},actor={id:'fixture'};
 try{
  await call('/admin/model-packages',artifact);
  const approval=await call(`/admin/model-packages/${artifact.id}/approve`,{confirmApproval:true,rationale:'Technical fixture only.'});
  const input={confirmRelease:true,bankVersion:artifact.bankVersion,course:artifact.course,unit:artifact.unit,approvalId:approval.approvalId,expectedReleaseId:null,rationale:'Test selection.'};
  const release=await recordModelRelease(env,actor,input);
  const profile=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  const session=await call('/sessions',{course:artifact.course,mode:'assessment',unit:artifact.unit},profile.token);
  assert.equal(session.httpStatus,200);
  const stored=await DB.prepare('SELECT * FROM sessions WHERE id=?').bind(session.sessionId).first();
  assert.equal(stored.target_count,5);
  const models=await sessionModels(env,stored);assert.equal(models[artifact.unit].id,artifact.id);
  const plan=await prepareSessionModels(env,{bankVersion:artifact.bankVersion,course:artifact.course,unit:artifact.unit,targetCount:5},buildBank());
  await recordModelRelease(env,actor,{...input,expectedReleaseId:release.release.id,approvalId:null,rationale:'Withdraw test release.'});
  const racedId=crypto.randomUUID();
  await assert.rejects(DB.batch([
   DB.prepare('INSERT INTO sessions (id,participant_id,course,mode,bank_version,started_at,token_hash,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(racedId,profile.participantId,artifact.course,'assessment',artifact.bankVersion,'now','fixture','later'),
   sessionModelPinStatement(env,racedId,plan,'now')
  ]),/json_valid/);
  assert.equal(await DB.prepare('SELECT id FROM sessions WHERE id=?').bind(racedId).first(),null);
  assert.equal((await sessionModels(env,stored))[artifact.unit].id,artifact.id);
  const next=await call('/sessions/'+session.sessionId+'/next',{},profile.token);assert.equal(next.httpStatus,200);
  assert.equal((await DB.prepare('SELECT model_version FROM presentations WHERE session_id=?').bind(session.sessionId).first()).model_version,artifact.id);
  const fresh=await call('/sessions',{course:artifact.course,mode:'assessment',unit:artifact.unit},profile.token);
  assert.equal((await DB.prepare('SELECT approvals_json FROM session_model_pins WHERE session_id=?').bind(fresh.sessionId).first()).approvals_json,'{}');
  const practice=await call('/sessions',{course:artifact.course,mode:'practice'},profile.token);
  assert.equal(await DB.prepare('SELECT * FROM session_model_pins WHERE session_id=?').bind(practice.sessionId).first(),null);
 }finally{DB.close();}
});
test('insufficient calibrated coverage rejects assessment before consuming a session',async()=>{
 const {DB,artifact,call}=fixture();try{
  await call('/admin/model-packages',artifact);
  const approval=await call(`/admin/model-packages/${artifact.id}/approve`,{confirmApproval:true,rationale:'Technical fixture only.'});
  await recordModelRelease({DB},{id:'fixture'},{confirmRelease:true,bankVersion:artifact.bankVersion,course:artifact.course,unit:artifact.unit,approvalId:approval.approvalId,expectedReleaseId:null,rationale:'Test insufficient pool.'});
  const profile=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  const session=await call('/sessions',{course:artifact.course,mode:'assessment',unit:artifact.unit},profile.token);
  assert.equal(session.httpStatus,409);assert.match(session.error,/too few/);
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);
 }finally{DB.close();}
});

test('release routes require instructor authorization and report live activation honestly',async()=>{
 const {DB,artifact,call}=fixture({course:'intro-econometrics',complete:true});try{
  await call('/admin/model-packages',artifact);
  const approval=await call(`/admin/model-packages/${artifact.id}/approve`,{confirmApproval:true,rationale:'Technical fixture only.'});
  const scope={bankVersion:artifact.bankVersion,course:artifact.course,unit:artifact.unit},path='/admin/model-releases?'+new URLSearchParams(scope);
  const profile=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  const input={...scope,approvalId:approval.approvalId,expectedReleaseId:null,confirmRelease:true,rationale:'Test route only.'};
  assert.equal((await call(path,null,profile.token)).httpStatus,403);
  assert.equal((await call('/admin/model-releases',input,profile.token)).httpStatus,403);
  assert.equal((await call('/admin/model-releases?unit=0')).httpStatus,400);
  assert.equal((await call(path)).current,null);
  const released=await call('/admin/model-releases',input);assert.equal(released.httpStatus,200);
  assert.equal((await call(path)).current.id,released.release.id);
  assert.equal((await call(`/admin/model-packages/${artifact.id}`)).activated,true);
  assert.equal((await call('/admin/model-packages')).packages[0].activated,true);
  assert.equal((await call('/admin/model-releases',{...input,rationale:'Stale competing request'})).httpStatus,409);
  const withdrawn=await call('/admin/model-releases',{...input,approvalId:null,expectedReleaseId:released.release.id,rationale:'Withdraw technical fixture.'});assert.equal(withdrawn.httpStatus,200);
  assert.equal((await call(`/admin/model-packages/${artifact.id}`)).activated,false);
  assert.equal((await call('/admin/model-packages')).packages[0].activated,false);
 }finally{DB.close();}
});

test('release history uses bounded revision pagination without skipping decisions',async()=>{
 const {DB,artifact,call}=fixture();try{
  await call('/admin/model-packages',artifact);
  const approval=await call(`/admin/model-packages/${artifact.id}/approve`,{confirmApproval:true,rationale:'Technical fixture only.'});
  for(let revision=1;revision<=53;revision++)await DB.prepare('INSERT INTO model_releases VALUES (?,?,?,?,?,?,?,?,?,?)').bind('history-'+revision,artifact.bankVersion,artifact.course,artifact.unit,revision%2?approval.approvalId:null,revision===1?null:'history-'+(revision-1),revision,'today','fixture','History fixture').run();
  const path='/admin/model-releases?'+new URLSearchParams({bankVersion:artifact.bankVersion,course:artifact.course,unit:artifact.unit});
  const first=await call(path);assert.equal(first.history.length,50);assert.equal(first.hasMore,true);assert.equal(first.nextBefore,4);
  const second=await call(path+'&before='+first.nextBefore);assert.deepEqual(second.history.map(x=>x.revision),[3,2,1]);assert.equal(second.hasMore,false);
  assert.equal(new Set([...first.history,...second.history].map(x=>x.id)).size,53);
  assert.equal((await call(path+'&before=-1')).httpStatus,400);
 }finally{DB.close();}
});
