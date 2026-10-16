import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {scopesFor,analyzeRows,matrixCSV,csvTable} from '../../src/lib/econ-practice/irt-workbench.mjs';
import {prepare} from '../../scripts/econ-practice/prepare-calibration.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(){const rows=[];for(const p of ['p1','p2','p3'])for(const i of ['a','b','c','d','e']){if(p==='p3'&&i==='e')continue;rows.push({event_id:`${p}-${i}`,participant_id:p,session_id:`s-${p}`,course:'ap-micro',unit:2,item_version:'test',mode:'assessment',first_family_exposure:1,hints_used:0,feedback_before_answer:0,attempt_number:1,validity:'valid',calibration_eligible:1,server_received_at:'2026-10-12T00:00:00Z',payload_sha256:'fixture',item_id:i,family_id:i,correct:Number(p==='p1'),selection_probability:.1,active_ms:5000,raw_answer_json:'0'});}return rows;}
const scope={course:'ap-micro',unit:2,bankVersion:'test'},thresholds={minPersons:2,minItemResponses:2,minItemsPerPerson:3};
test('browser preparation matches the CLI pipeline and preserves missing matrix entries',async()=>{
 const rows=fixture(),result=analyzeRows(rows,scope,thresholds),cli=prepare(rows,{...scope,...thresholds});
 assert.deepEqual(result.prepared.matrix,cli.matrix);assert.deepEqual(result.prepared.items,cli.items);assert.equal(result.prepared.manifest.readyForCandidateFit,true);
 const csv=await matrixCSV(result.prepared,hash);assert.ok(csv.includes(hash('p3').slice(0,20)));assert.ok(csv.split('\n').find(l=>l.includes(hash('p3').slice(0,20))).endsWith(',""'));assert.ok(!csv.includes('"p3"'));
});
test('analyst exclusions are explicit, reversible and cannot alter source rows',()=>{
 const rows=fixture(),before=JSON.stringify(rows),result=analyzeRows(rows,scope,{...thresholds,excludedItems:['e'],exclusionReason:'Ambiguous wording under review'});assert.equal(JSON.stringify(rows),before);assert.deepEqual(result.prepared.manifest.analystExclusions,{itemIds:['e'],responses:2,reason:'Ambiguous wording under review'});assert.equal(result.prepared.items.includes('e'),false);assert.equal(result.prepared.manifest.readyForCandidateFit,false);
 assert.throws(()=>analyzeRows(rows,scope,{...thresholds,excludedItems:['typo']}),/not in this dataset/);assert.throws(()=>analyzeRows(rows,scope,{...thresholds,minPersons:0}),/positive integers/);
 assert.deepEqual(scopesFor([...rows,{...rows[0],unit:3}]),[scope,{...scope,unit:3}]);
});
test('CSV quoting preserves numeric values and neutralizes spreadsheet formulas in imported identifiers',()=>{assert.equal(csvTable(['=test','x'],[[-1,'a"b']]),'"\'=test","x"\n"-1","a""b"\n');});

test('imported item and response codes cannot overwrite object prototypes',()=>{
 const rows=fixture().map(r=>({...r,item_id:r.item_id==='a'?'__proto__':r.item_id,raw_answer_json:'__proto__'})),result=analyzeRows(rows,scope,thresholds);
 assert.equal(result.prepared.manifest.itemStats.__proto__.n,3);assert.equal(result.prepared.manifest.itemStats.__proto__.distractors.__proto__,3);assert.equal(Object.prototype.n,undefined);
});

test('analyst exclusions require an exported rationale without modifying the ledger',()=>{
 const rows=fixture();
 assert.throws(()=>analyzeRows(rows,scope,{...thresholds,excludedItems:['e']}),/Explain why/);
 const r=analyzeRows(rows,scope,{...thresholds,excludedItems:['e'],exclusionReason:'  Sensitivity analysis for disputed key  '});
 assert.equal(r.prepared.manifest.analystExclusions.reason,'Sensitivity analysis for disputed key');
 assert.equal(rows.length,14);
});

test('analysis manifest binds the exact exported matrix bytes and preserves missing cells',async()=>{
 const {preparedArtifacts}=await import('../../src/lib/econ-practice/irt-workbench.mjs');
 const {writePrepared}=await import('../../scripts/econ-practice/prepare-calibration.mjs');
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const p=analyzeRows(fixture(),scope,thresholds).prepared,a=await preparedArtifacts(p,hash);
 assert.equal(a.manifest.matrixArtifact.sha256,hash(a.matrix));
 assert.notEqual(a.manifest.matrixArtifact.sha256,hash(a.matrix.replace(',""',',"0"')));
 assert.equal(p.manifest.matrixArtifact,undefined);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'econ-matrix-'));
 try{writePrepared(p,dir);const text=fs.readFileSync(path.join(dir,'responses.csv'),'utf8'),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));assert.equal(m.matrixArtifact.sha256,hash(text));assert.equal(text,a.matrix);assert.deepEqual(m.matrixArtifact,a.manifest.matrixArtifact);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
