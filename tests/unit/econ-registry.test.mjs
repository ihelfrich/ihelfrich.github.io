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
  const student=await call('/profiles',{accepted:true,consentVersion:CONSENT_VERSION});
  assert.equal((await call('/admin/model-packages',artifact,student.token)).httpStatus,403);
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
