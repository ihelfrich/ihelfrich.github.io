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
