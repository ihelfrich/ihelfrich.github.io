import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {renderModelRelease} from '../../src/scripts/econ-model-release.mjs';
const artifact={id:'package',bankVersion:'bank',course:'ap-micro',unit:1};
test('release form shows scope, sends reviewed predecessor and prevents implicit changes',async()=>{
 const window=new Window(),doc=window.document,panel=doc.createElement('div'),status=doc.createElement('p'),writes=[];
 const request=async(path,data)=>{if(!data)return {bankVersion:'bank',course:'ap-micro',unit:1,current:{id:'release-old',revision:2,approval_id:'approval-old',released_at:'today',rationale:'<img src=x>'}};writes.push(data);return {release:{bank_version:'bank',course:'ap-micro',unit:1,revision:3}};};
 try{
  await renderModelRelease(artifact,[{id:'approval-new',approved_at:'yesterday'}],panel,request,status,doc);
  assert.equal(panel.querySelector('img'),null);assert.match(panel.textContent,/already started/);
  const form=panel.querySelector('form');form.dispatchEvent(new window.Event('submit'));await new Promise(setImmediate);assert.equal(writes.length,0);
  form.querySelector('select').value='withdraw';form.querySelector('textarea').value='Investigate drift';form.querySelector('input').checked=true;
  form.dispatchEvent(new window.Event('submit'));await new Promise(setImmediate);
  assert.deepEqual(writes,[{bankVersion:'bank',course:'ap-micro',unit:1,approvalId:null,expectedReleaseId:'release-old',rationale:'Investigate drift',confirmRelease:true}]);
  assert.equal(panel.querySelector('form'),null);assert.match(status.textContent,/Existing assessments/);
 }finally{window.happyDOM.abort();}
});
test('stale release rejection remains visible and scope mismatch supplies no controls',async()=>{
 const window=new Window(),doc=window.document,panel=doc.createElement('div'),status=doc.createElement('p');
 try{
  await assert.rejects(renderModelRelease(artifact,[],panel,async()=>({bankVersion:'other',course:'ap-micro',unit:1}),status,doc),/scope/);assert.equal(panel.querySelector('form'),null);
  await renderModelRelease(artifact,[{id:'approved',approved_at:'today'}],panel,async(path,data)=>{if(data)throw new Error('Release changed; reload before retrying.');return {bankVersion:'bank',course:'ap-micro',unit:1,current:null};},status,doc);
  const form=panel.querySelector('form');form.querySelector('select').value='approved';form.querySelector('textarea').value='Reviewed';form.querySelector('input').checked=true;form.dispatchEvent(new window.Event('submit'));await new Promise(setImmediate);
  assert.match(status.textContent,/reload/);assert.equal(form.querySelector('button').disabled,false);
 }finally{window.happyDOM.abort();}
});

test('release history loads earlier decisions and renders rationale safely',async()=>{
 const window=new Window(),doc=window.document,panel=doc.createElement('div'),status=doc.createElement('p'),paths=[];
 try{
  await renderModelRelease(artifact,[],panel,async path=>{paths.push(path);return {bankVersion:'bank',course:'ap-micro',unit:1,current:null,history:[{revision:paths.length===1?2:1,released_at:'today',approval_id:null,rationale:'<script>not markup</script>'}],hasMore:paths.length===1,nextBefore:paths.length===1?2:1};},status,doc);
  panel.querySelector('button').click();await new Promise(setImmediate);
  assert.match(paths[1],/before=2/);assert.equal(panel.querySelectorAll('li').length,2);assert.equal(panel.querySelector('script'),null);assert.equal(panel.querySelector('button').hidden,true);
 }finally{window.happyDOM.abort();}
});
