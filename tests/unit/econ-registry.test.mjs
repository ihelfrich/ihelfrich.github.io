import {sessionModels} from '../../services/econ-response/session-models.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import worker,{CONSENT_VERSION} from '../../services/econ-response/worker.mjs';
import {buildBank,BANK_VERSION} from '../../src/lib/econ-practice/index.mjs';
import {packageCandidate} from '../../scripts/econ-practice/package-candidate.mjs';
import {reportHash} from '../../scripts/econ-practice/validate-candidate.mjs';
function fixture(){
 const DB=createLocalDB();for(const file of readdirSync(new URL('../../services/econ-response/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())DB.exec(readFileSync(new URL(`../../services/econ-response/migrations/${file}`,import.meta.url),'utf8'));
 const env={DB,ADMIN_TOKEN:'registry-test',ALLOW_BOOTSTRAP_ADMIN:'true'},item=buildBank().find(q=>q.format==='numeric');
 // Fabricated review/fit exercises transport and integrity; never an empirical calibration.
 const report={synthetic:false,matrixSHA256:'e'.repeat(64),bankVersion:BANK_VERSION,course:item.course,unit:item.unit,sourceSHA256:'d'.repeat(64),models:{'2PL':{converged:true,finiteParameters:true,positiveFiniteCovarianceDiagonal:true,holdout:{predictions:100},items:{[item.id]:{a:1,b:0,c:0,d:1}}}}};
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
  const session=await call('/sessions',{course:artifact.course,mode:'assessment',unit:artifact.unit},profile.token);
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
  const legacy=await call('/sessions',{course:artifact.course,mode:'assessment'},profile.token);
  await DB.prepare('INSERT INTO session_model_pins VALUES (?,?,?,?,?)').bind(legacy.sessionId,artifact.bankVersion,artifact.course,'{}','2026-10-13').run();
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM session_model_pins').first()).n,2);
  const emptySession=await DB.prepare('SELECT * FROM sessions WHERE id=?').bind(legacy.sessionId).first();
  assert.deepEqual(await sessionModels({DB},emptySession),{});
  const shown=await call('/sessions',{course:artifact.course,mode:'assessment'},profile.token);
  const unpinned=await DB.prepare('SELECT * FROM sessions WHERE id=?').bind(shown.sessionId).first();
  assert.deepEqual(await sessionModels({DB},unpinned),{});
  assert.equal((await call('/sessions/'+shown.sessionId+'/next',{},profile.token)).httpStatus,200);
  await assert.rejects(DB.prepare('INSERT INTO session_model_pins VALUES (?,?,?,?,?)').bind(shown.sessionId,artifact.bankVersion,artifact.course,'{}','2026-10-13').run(),/before presentation/);
 }finally{DB.close();}
});
