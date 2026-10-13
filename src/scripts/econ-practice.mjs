import {setupIdentity} from './econ-identity.mjs';
import {courses} from '../lib/econ-practice/curriculum.mjs';
import {renderGraph} from '../lib/econ-practice/figures.mjs';
const $=id=>document.getElementById(id),root=$('econ-app');
if(root){
 const API=root.dataset.api,PROFILE_KEY='econ-profile-v1',QUEUE_KEY='econ-answer-outbox-v1',SESSION_KEY='econ-session-v1';
 let profile=null,session=null,current=null,started=0,active=0,lastTick=0,report=null,available=false,busy=false;
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
 const save=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
 profile=read(PROFILE_KEY,null);session=read(SESSION_KEY,null);
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 async function request(path,data){const response=await fetch(`${API}${path}`,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(profile?{Authorization:`Bearer ${profile.token}`}:{})},...(data?{body:JSON.stringify(data)}:{})});const result=await response.json();if(!response.ok)throw new Error(result.error??'The request failed.');return result;}
 function show(panel){for(const id of ['setup','question-panel','report'])$(id).hidden=id!==panel;}
 function coursesChanged(){const course=$('course').value;$('unit').replaceChildren(new Option('All units','0'),...courses[course].units.map((u,i)=>new Option(`${i+1}. ${u}`,String(i+1))));$('course-count').textContent='Questions adapt within your chosen course and coverage.';}
 coursesChanged();$('course').addEventListener('change',coursesChanged);
 function ready(){ $('start').disabled=!available||!$('consent').checked||busy;$('prepare-signin').disabled=!available||!$('consent').checked||busy||!root.dataset.signin; }
 $('consent').addEventListener('change',ready);
 async function flush(){
  const queue=read(QUEUE_KEY,[]);for(const event of queue){
   const receipt=await request(`/sessions/${event.sessionId}/answers`,event.payload);
   if(receipt.persisted!==true||receipt.eventId!==event.payload.eventId)throw new Error('No storage receipt was returned. Your answer remains queued.');
   const remaining=read(QUEUE_KEY,[]).filter(e=>e.payload.eventId!==event.payload.eventId);save(QUEUE_KEY,remaining);
   if(current?.presentationId===event.payload.presentationId)displayReceipt(receipt);
  }
 }
 function displayReceipt(r){$('retry-save').hidden=true;$('receipt').textContent='Answer saved to your response history.';$('submit-answer').disabled=true;$('next').hidden=false;$('hint').hidden=true;
  if('correct' in r){$('feedback').replaceChildren(node('h3',r.correct?'Correct':'Review this answer'),node('p',`Answer: ${r.answer}`),node('p',r.explanation));}
  else $('feedback').replaceChildren(node('p','Answer recorded. Explanations will appear when you finish the diagnostic.'));
 }
 async function next(){
  await flush();const result=await request(`/sessions/${session.sessionId}/next`,{});if(result.done){await finish();return;}
  current=result;started=performance.now();active=0;lastTick=performance.now();
  const q=result.item;$('question-heading').textContent=q.prompt;$('question-meta').textContent=`${courses[session.course].name} · Unit ${q.unit} · Question ${result.sequence}`;
  $('figure').innerHTML=renderGraph(q.graph);$('feedback').replaceChildren();$('receipt').textContent='';$('next').hidden=true;$('submit-answer').disabled=false;$('hint').hidden=session.mode==='assessment';
  const field=$('answer-options');field.replaceChildren(node('legend','Your answer'));
  if(q.format==='choice')q.options.forEach((text,i)=>{const label=node('label',''),input=document.createElement('input');input.type='radio';input.name='answer';input.value=String(i);input.required=true;label.append(input,node('span',text));field.append(label);});
  else{const label=node('label','Numerical answer'),input=document.createElement('input');input.type='number';input.step='any';input.name='answer';input.required=true;input.inputMode='decimal';label.append(input);field.append(label);field.append(node('p','Use the units requested in the question. Enter at least three decimal places when rounding is needed.'));}
  show('question-panel');$('question-heading').focus();
 }
 async function finish(){await flush();await request(`/sessions/${session.sessionId}/complete`,{});report=await request(`/sessions/${session.sessionId}/report`);save(SESSION_KEY,null);const container=$('report-content');container.replaceChildren();const correct=report.rows.filter(r=>r.correct).length;container.append(node('p',`${correct} of ${report.rows.length} submitted answers correct. This is a practice summary, not an AP score prediction.`));
  report.rows.forEach((r,i)=>{const details=document.createElement('details');details.append(node('summary',`${i+1}. ${r.correct?'Correct':'Review'} · ${r.item.title}`),node('p',r.item.prompt),node('p',`Your answer: ${r.item.format==='choice'?r.item.options[r.response]:r.response}`),node('p',`Answer: ${r.answer}`),node('p',r.explanation));container.append(details);});show('report');$('report-heading').focus();}
 const identity=setupIdentity({request,flush,getProfile:()=>profile,setProfile:p=>{profile=p;save(PROFILE_KEY,p);},getSession:()=>session,setSession:s=>{session=s;save(SESSION_KEY,s);},beginSession:next,ready,show,save});
 $('start').addEventListener('click',async()=>{busy=true;ready();$('setup-error').textContent='';try{await identity.ensureProfile();await flush();session=await request('/sessions',{course:$('course').value,mode:$('mode').value,unit:Number($('unit').value)});save(SESSION_KEY,session);await next();}catch(e){$('setup-error').textContent=e.message;}finally{busy=false;ready();}});
 $('answer-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;$('submit-answer').disabled=true;try{
  const value=new FormData($('answer-form')).get('answer');if(value===null||String(value).trim()==='')throw new Error('Enter an answer first.');
  const elapsed=Math.round(performance.now()-started);const event={sessionId:session.sessionId,payload:{eventId:crypto.randomUUID(),presentationId:current.presentationId,attemptNumber:1,response:current.item.format==='choice'?Number(value):String(value),elapsedMs:elapsed,activeMs:Math.min(elapsed,Math.round(active)),submittedAt:new Date().toISOString()}};
  const queue=read(QUEUE_KEY,[]);if(queue.some(q=>q.payload.presentationId===current.presentationId))throw new Error('This answer is already queued. Reconnect to save it.');queue.push(event);save(QUEUE_KEY,queue);$('receipt').textContent='Saving answer…';await flush();
 }catch(error){$('retry-save').hidden=false;$('receipt').textContent=`${error.message} Any queued answer remains on this browser. Reconnect to retry.`;}finally{busy=false;}});
 $('retry-save').addEventListener('click',()=>flush().catch(e=>$('receipt').textContent=e.message));
 $('next').addEventListener('click',()=>next().catch(e=>$('receipt').textContent=e.message));$('finish').addEventListener('click',()=>finish().catch(e=>$('receipt').textContent=e.message));
 $('hint').addEventListener('click',async()=>{try{const r=await request(`/sessions/${session.sessionId}/hint`,{presentationId:current.presentationId});$('feedback').replaceChildren(node('p',r.hint));}catch(e){$('receipt').textContent=e.message;}});
 $('again').addEventListener('click',()=>{session=null;current=null;show('setup');});
 $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`economics-session-${report.sessionId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 setInterval(()=>{const now=performance.now();if(current&&!document.hidden)active+=Math.min(now-lastTick,1200);lastTick=now;},1000);
 window.addEventListener('online',()=>flush().catch(e=>$('connection-status').textContent=e.message));
 if(!API){$('connection-status').textContent='Preview: the response service is not connected. Sessions are disabled until answers can be saved.';}
 else request('/health').then(async health=>{available=true;root.dataset.signin=health.signInConfigured?'true':'';$('connection-status').textContent='Response service connected. Submitted answers receive a storage receipt.';ready();if(profile){await identity.refresh();await flush();if(session){await next();}}}).catch(e=>{$('connection-status').textContent=`Response service unavailable: ${e.message}`;});
}
