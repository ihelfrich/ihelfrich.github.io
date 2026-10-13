import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {setupIrtWorkbench} from '../../src/scripts/econ-irt-workbench.mjs';
function fixture(request){const window=new Window(),d=window.document;const source=readFileSync(new URL('../../src/pages/economics-practice/instructor/index.astro',import.meta.url),'utf8');d.body.innerHTML=source.slice(source.indexOf('<section id="irt-workbench"'),source.indexOf('<div id="instructor-content"'));const control=setupIrtWorkbench(request,d);control.enableLive();return {window,d,click:()=>d.querySelector('#irt-load-live').click(),flush:()=>new Promise(resolve=>setImmediate(resolve))};}
const row={course:'ap-micro',unit:1,item_version:'test-bank'};
test('failed replacement load clears old analysis controls and restores loading controls',async()=>{
 let fail=false;const f=fixture(async()=>{if(fail)throw new Error('Connection interrupted');return {rows:[row],snapshotThrough:1,hasMore:false};});try{f.click();await f.flush();assert.equal(f.d.querySelector('#irt-analysis-form').hidden,false);fail=true;f.click();assert.equal(f.d.querySelector('#irt-analysis-form').hidden,true);assert.equal(f.d.querySelector('#irt-file').disabled,true);await f.flush();assert.equal(f.d.querySelector('#irt-analysis-form').hidden,true);assert.equal(f.d.querySelector('#irt-scope').children.length,0);assert.equal(f.d.querySelector('#irt-file').disabled,false);assert.equal(f.d.querySelector('#irt-load-live').disabled,false);assert.match(f.d.querySelector('#irt-load-status').textContent,/interrupted/);}finally{f.window.happyDOM.abort();}
});
test('live workbench rejects changing snapshot boundaries instead of loading partial data',async()=>{
 let n=0;const f=fixture(async()=>({rows:[row],snapshotThrough:++n,hasMore:n===1,nextCursor:'v1:1:2'}));try{f.click();await f.flush();assert.equal(n,2);assert.equal(f.d.querySelector('#irt-analysis-form').hidden,true);assert.equal(f.d.querySelector('#irt-results').hidden,true);assert.match(f.d.querySelector('#irt-load-status').textContent,/snapshot changed/);}finally{f.window.happyDOM.abort();}
});

test('instructor exclusion control requires a reason, shows it safely, and clears it on dataset change',async()=>{
 const records=[];
 for(let p=0;p<3;p++)for(let i=0;i<5;i++)records.push({...row,event_id:`e${p}-${i}`,participant_id:`p${p}`,session_id:`s${p}`,item_id:`i${i}`,family_id:`f${i}`,mode:'assessment',first_family_exposure:1,hints_used:0,feedback_before_answer:0,attempt_number:1,validity:'valid',calibration_eligible:1,server_received_at:'2026-10-12T00:00:00Z',payload_sha256:'test',correct:Number(p===0),raw_answer_json:'0',active_ms:5000});
 const f=fixture(async()=>({rows:records,snapshotThrough:15,hasMore:false}));
 try{
  f.click();await f.flush();const q=id=>f.d.getElementById(id);
  q('irt-excluded').value='i4';
  q('irt-analysis-form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));await f.flush();
  assert.match(q('irt-analysis-status').textContent,/Explain why/);assert.equal(q('irt-results').hidden,true);
  q('irt-exclusion-reason').value='<b>Disputed key</b>';
  q('irt-analysis-form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));
  for(let i=0;i<20&&q('irt-results').hidden;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(q('irt-results').hidden,false);assert.match(q('irt-exclusions').textContent,/<b>Disputed key<\/b>/);assert.equal(q('irt-exclusions').querySelector('b'),null);
  q('irt-scope').dispatchEvent(new f.window.Event('change'));
  assert.equal(q('irt-excluded').value,'');assert.equal(q('irt-exclusion-reason').value,'');assert.equal(q('irt-results').hidden,true);
 }finally{f.window.happyDOM.abort();}
});
