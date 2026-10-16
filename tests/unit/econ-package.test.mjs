import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {packageCandidate,verifyPackage,writePackage} from '../../scripts/econ-practice/package-candidate.mjs';
import {reportHash} from '../../scripts/econ-practice/validate-candidate.mjs';
function fixture(){
 const bank=[{id:'fixture-item',version:'fixture-bank',course:'ap-micro',unit:1,format:'numeric',prompt:'Technical test fixture',answer:1}];
 const report={synthetic:false,matrixSHA256:'e'.repeat(64),bankVersion:'fixture-bank',course:'ap-micro',unit:1,sourceSHA256:'c'.repeat(64),models:{'2PL':{converged:true,finiteParameters:true,positiveFiniteCovarianceDiagonal:true,holdout:{predictions:100},items:{'fixture-item':{a:1,b:0,c:0,d:1}}}}};
 const review={reviewer:'Test fixture only',reviewedAt:'2026-10-12T00:00:00Z',sourceSHA256:report.sourceSHA256,reportSHA256:reportHash(report),model:'2PL',bankVersion:'fixture-bank',course:'ap-micro',unit:1,gates:Object.fromEntries(['content','dimensionality','localDependence','itemFit','fairness','catSimulation','linking','scoreInterpretation'].map(k=>[k,{decision:'accepted',evidence:'Fabricated test fixture',rationale:'Technical package test, not scientific validation'}]))};
 return {bank,report,review,options:{bank,bankVersion:'fixture-bank'}};
}
test('candidate package binds parameters, review and exact bank item content without activation',()=>{
 const {report,review,options}=fixture(),artifact=packageCandidate(report,review,options);
 assert.equal(artifact.status,'candidate');assert.match(artifact.id,/^calibration-[a-f0-9]{64}$/);assert.equal(verifyPackage(artifact,options),artifact.id);
 assert.equal(packageCandidate(report,review,options).id,artifact.id);
 report.models['2PL'].items['fixture-item'].b=.5;
 assert.equal(artifact.parameters['fixture-item'].b,0);assert.throws(()=>packageCandidate(report,review,options),/exact candidate report hash/);
 review.reportSHA256=reportHash(report);assert.notEqual(packageCandidate(report,review,options).id,artifact.id);
 const tampered=structuredClone(artifact);tampered.parameters['fixture-item'].b=2;assert.throws(()=>verifyPackage(tampered,options),/does not match/);
 const changedBank=options.bank.map(q=>({...q,prompt:'Changed content'}));assert.throws(()=>verifyPackage(artifact,{...options,bank:changedBank}),/does not match/);
});
test('candidate package rejects unknown, wrong-scope and nonbinary items',()=>{
 const {report,review,options}=fixture();
 for(const bank of [[],options.bank.map(q=>({...q,unit:2})),options.bank.map(q=>({...q,course:'ap-macro'})),options.bank.map(q=>({...q,version:'other'})),options.bank.map(q=>({...q,format:'multipart'})),[...options.bank,...options.bank]])assert.throws(()=>packageCandidate(report,review,{...options,bank}));
});
test('candidate review cannot omit matrix provenance or survive a changed matrix hash',()=>{
 const {report,review,options}=fixture();
 for(const hash of [undefined,null,'', 'not-a-hash','A'.repeat(64)]){
  const changed={...report,matrixSHA256:hash};
  if(hash===undefined)delete changed.matrixSHA256;
  const rebound={...review,reportSHA256:reportHash(changed)};
  assert.throws(()=>packageCandidate(changed,rebound,options),/response matrix hash/);
 }
 const changed={...report,matrixSHA256:'f'.repeat(64)};
 assert.throws(()=>packageCandidate(changed,review,options),/exact candidate report hash/);
 const original=packageCandidate(report,review,options);
 const rebound={...review,reportSHA256:reportHash(changed)};
 const replacement=packageCandidate(changed,rebound,options);
 assert.notEqual(replacement.id,original.id);
 assert.equal(replacement.report.matrixSHA256,changed.matrixSHA256);
});
test('package storage is idempotent, private and refuses to overwrite different content',()=>{
 const {report,review,options}=fixture(),artifact=packageCandidate(report,review,options),directory=fs.mkdtempSync(path.join(os.tmpdir(),'econ-package-'));
 try{
  const file=writePackage(artifact,directory,options);assert.equal(writePackage(artifact,directory,options),file);assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.equal(verifyPackage(JSON.parse(fs.readFileSync(file,'utf8')),options),artifact.id);
  fs.writeFileSync(file,'corrupted fixture');assert.throws(()=>writePackage(artifact,directory,options),/not been overwritten/);assert.equal(fs.readFileSync(file,'utf8'),'corrupted fixture');
  assert.deepEqual(fs.readdirSync(directory),[path.basename(file)]);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
