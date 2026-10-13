import fs from 'node:fs';
import path from 'node:path';
import {buildBank,BANK_VERSION} from '../../src/lib/econ-practice/index.mjs';
import {prepare,writePrepared,sha} from './prepare-calibration.mjs';
let seed=20261012;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return (seed+.5)/4294967296;};
const normal=()=>Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
const directory=process.argv[2]??'.local/econ-calibration/synthetic';
const bank=buildBank().filter(q=>q.course==='ap-micro'&&q.unit===2&&q.variant===1).slice(0,12);
const truth=Object.fromEntries(bank.map((q,j)=>[q.id,{a:.7+1.0*(j%4)/3,b:-2+4*j/(bank.length-1),family:q.family}]));
const rows=[];
for(let i=0;i<1000;i++){const theta=normal();for(const q of bank){const {a,b}=truth[q.id],correct=Number(random()<1/(1+Math.exp(-a*(theta-b))));rows.push({event_id:`synthetic-${i}-${q.id}`,participant_id:`synthetic-person-${i}`,session_id:`synthetic-session-${i}`,course:q.course,unit:q.unit,item_version:BANK_VERSION,mode:'assessment',first_family_exposure:1,hints_used:0,feedback_before_answer:0,attempt_number:1,validity:'valid',calibration_eligible:1,server_received_at:'2026-10-12T12:00:00Z',payload_sha256:'synthetic-not-a-production-receipt',item_id:q.id,family_id:q.family,correct,selection_probability:1/12,active_ms:5000,raw_answer_json:JSON.stringify(correct)});}}
const result=prepare(rows,{course:'ap-micro',unit:2,bankVersion:BANK_VERSION});result.manifest.sourceSHA256=sha(JSON.stringify(rows));result.manifest.synthetic=true;writePrepared(result,directory);fs.writeFileSync(path.join(directory,'truth.json'),JSON.stringify({synthetic:true,seed:20261012,items:truth},null,2));console.log(JSON.stringify({directory,people:result.people.length,items:result.items.length,ready:result.manifest.readyForCandidateFit}));
