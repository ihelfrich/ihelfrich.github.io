import {selectionFromSearch,signInReason} from './econ-setup-state.mjs';
import {renderSessionReport} from './econ-session-report.mjs';
import {createSessionActions,loadCurrentHint} from './econ-session-actions.mjs';
import {renderAnswerInputs,readAnswerInputs} from './econ-answer-form.mjs';
import {createOutbox} from './econ-outbox.mjs';
import {setupIdentity} from './econ-identity.mjs';
import {courses} from '../lib/econ-practice/curriculum.mjs';
import {renderGraph} from '../lib/econ-practice/figures.mjs';
const $=id=>document.getElementById(id),root=$('econ-app');
if(root){
 const API=root.dataset.api,PROFILE_KEY='econ-profile-v1',SESSION_KEY='econ-session-v1';
 let profile=null,session=null,current=null,started=0,active=0,lastTick=0,report=null,available=false,busy=false,connection=API?'connecting':'disconnected';
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
 const save=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
 profile=read(PROFILE_KEY,null);session=read(SESSION_KEY,null);const outbox=createOutbox(localStorage);
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 async function request(path,data){const response=await fetch(`${API}${path}`,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(profile?{Authorization:`Bearer ${profile.token}`}:{})},...(data?{body:JSON.stringify(data)}:{})});const result=await response.json();if(!response.ok){const error=new Error(result.error??'The request failed.');error.status=response.status;throw error;}return result;}
 function show(panel){for(const id of ['setup','question-panel','report'])$(id).hidden=id!==panel;}
 function coursesChanged(){const course=$('course').value;$('unit').replaceChildren(new Option('All units','0'),...courses[course].units.map((u,i)=>new Option(`${i+1}. ${u}`,String(i+1))));$('course-count').textContent='Questions adapt within your chosen course and coverage.';}
 const selection=selectionFromSearch(location.search,courses,$('course').value);$('course').value=selection.course;coursesChanged();$('unit').value=String(selection.unit);$('course').addEventListener('change',coursesChanged);
 function ready(){ $('start').disabled=!available||!$('consent').checked||busy;const reason=signInReason({connection,configured:!!root.dataset.signin,consent:$('consent').checked,busy});$('prepare-signin').disabled=!!reason;$('signin-reason').textContent=reason; }
 $('consent').addEventListener('change',ready);ready();
 async function flush(){
  const queue=outbox.list();for(const event of queue){
   const receipt=await request(`/sessions/${event.sessionId}/answers`,event.payload);
   if(receipt.persisted!==true||receipt.eventId!==event.payload.eventId)throw new Error('No storage receipt was returned. Your answer remains queued.');
   outbox.acknowledge(event,receipt);
   if(current?.presentationId===event.payload.presentationId)displayReceipt(receipt);
  }
 }
 function displayReceipt(r){$('answer-options').disabled=true;$('retry-save').hidden=true;$('receipt').textContent=r.receiptId?'Submission saved separately because an answer was already recorded or its attempt number was out of sequence. The scored answer has not changed.':r.countsTowardResult===false?'Answer saved to your history, but received after the deadline or session completion. It does not count toward this assessment.':'Answer saved to your response history.';$('submit-answer').disabled=true;$('next').hidden=false;$('hint').hidden=true;
  if('correct' in r){$('feedback').replaceChildren(node('h3',r.correct?'Correct':'Review this answer'),node('p',`Answer: ${r.answer}`),node('p',r.explanation));if(r.parts)for(const part of r.parts)$('feedback').append(node('p',`${part.id}: ${part.earned}/${part.possible} points. ${part.explanation}`));}
  else $('feedback').replaceChildren(node('p',r.receiptId?'This submission is available in your downloaded history and is excluded from scores and ability estimates.':'Answer recorded. Explanations will appear when you finish the diagnostic.'));
 }
 async function next(){
  await flush();const result=await request(`/sessions/${session.sessionId}/next`,{});if(result.done){await finish();return;}
  current=result;started=performance.now();active=0;lastTick=performance.now();
  const q=result.item;$('question-heading').textContent=q.prompt;$('question-meta').textContent=`${courses[session.course].name} · Unit ${q.unit} · Question ${result.sequence}`;
  $('figure').innerHTML=renderGraph(q.graph);$('feedback').replaceChildren();$('receipt').textContent='';$('next').hidden=true;$('submit-answer').disabled=false;$('hint').hidden=session.mode==='assessment';$('hint').disabled=false;
  renderAnswerInputs($('answer-options'),q);
  show('question-panel');$('question-heading').focus();
 }
 async function finish(){await flush();await request(`/sessions/${session.sessionId}/complete`,{});report=await request(`/sessions/${session.sessionId}/report`);save(SESSION_KEY,null);renderSessionReport($('report-content'),report);show('report');$('report-heading').focus();}
 const identity=setupIdentity({request,flush,getProfile:()=>profile,setProfile:p=>{profile=p;save(PROFILE_KEY,p);},getSession:()=>session,setSession:s=>{session=s;save(SESSION_KEY,s);},beginSession:next,ready,show,save});
 $('start').addEventListener('click',async()=>{busy=true;ready();$('setup-error').textContent='';try{await identity.ensureProfile();await flush();session=await request('/sessions',{course:$('course').value,mode:$('mode').value,unit:Number($('unit').value)});save(SESSION_KEY,session);await next();}catch(e){$('setup-error').textContent=e.message;}finally{busy=false;ready();}});
 $('answer-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;$('submit-answer').disabled=true;try{
  const value=readAnswerInputs($('answer-options'),current.item);
  const elapsed=Math.round(performance.now()-started);const event={sessionId:session.sessionId,payload:{eventId:crypto.randomUUID(),presentationId:current.presentationId,attemptNumber:1,response:value,elapsedMs:elapsed,activeMs:Math.min(elapsed,Math.round(active)),submittedAt:new Date().toISOString()}};
  const queue=outbox.list();if(queue.some(q=>q.payload.presentationId===current.presentationId))throw new Error('This answer is already queued. Reconnect to save it.');outbox.enqueue(event);$('answer-options').disabled=true;$('receipt').textContent='Saving answer…';await flush();
 }catch(error){if(error.status===401&&profile?.identityKind==='account'){await identity.refresh();show('setup');}let queued=true;try{queued=outbox.list().some(e=>e.payload.presentationId===current?.presentationId);}catch{};$('retry-save').hidden=!queued;$('submit-answer').disabled=queued;$('answer-options').disabled=queued;$('receipt').textContent=queued?`${error.message} Your queued answer remains on this browser. Reconnect to retry.`:error.message;}finally{busy=false;}});
 const runSessionAction=createSessionActions({isBusy:()=>busy,setBusy:value=>{busy=value;for(const id of ['next','finish','retry-save'])$(id).disabled=value;ready();},onError:error=>{$('receipt').textContent=error.message;}});
 $('retry-save').addEventListener('click',()=>runSessionAction(flush));
 $('next').addEventListener('click',()=>runSessionAction(next));$('finish').addEventListener('click',()=>runSessionAction(finish));
 $('hint').addEventListener('click',()=>{if(busy||!current)return;const presentationId=current.presentationId,sessionId=session.sessionId;$('hint').disabled=true;loadCurrentHint({presentationId,request:()=>request(`/sessions/${sessionId}/hint`,{presentationId}),isCurrent:id=>current?.presentationId===id&&!$('hint').hidden,show:hint=>$('feedback').replaceChildren(node('p',hint)),onError:error=>{$('receipt').textContent=error.message;}}).finally(()=>{if(current?.presentationId===presentationId)$('hint').disabled=false;});});
 $('again').addEventListener('click',()=>{session=null;current=null;show('setup');});
 $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`economics-session-${report.sessionId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 setInterval(()=>{const now=performance.now();if(current&&!document.hidden)active+=Math.min(now-lastTick,1200);lastTick=now;},1000);
 window.addEventListener('online',()=>flush().catch(e=>$('connection-status').textContent=e.message));
 if(!API){$('connection-status').textContent='Preview: the response service is not connected. Sessions are disabled until answers can be saved.';}
 else request('/health').then(async health=>{available=true;connection='connected';root.dataset.signin=health.signInConfigured?'true':'';$('connection-status').textContent='Response service connected. Submitted answers receive a storage receipt.';ready();if(profile){if(await identity.refresh()===false)return;await flush();if(session){await next();}}}).catch(e=>{if(!available)connection='disconnected';ready();$('connection-status').textContent=`Response service unavailable: ${e.message}`;});
}
