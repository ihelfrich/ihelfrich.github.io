import {readAllPages} from './econ-pages.mjs';
export function setupIdentity({request,flush,getProfile,setProfile,getSession,setSession,beginSession,ready,show,save}){
 const $=id=>document.getElementById(id),node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};let challengeBusy=false;
 async function ensureProfile(){if(!getProfile())setProfile(await request('/profiles',{accepted:true,consentVersion:'2026-10-12-v1'}));$('download-history').hidden=false;}
 async function refresh(){
  if(!getProfile())return;let p;try{p=await request('/profile');}catch(error){
   if(error.status===401&&getProfile().identityKind==='account'){
    setProfile({...getProfile(),needsReauthentication:true});$('identity-status').textContent='Your sign-in expired. Sign in with the same account to save pending answers.';$('prepare-signin').hidden=false;$('signout').hidden=true;$('link-anonymous').closest('label').hidden=true;$('assignments').hidden=true;$('instructor-link').hidden=true;ready();return false;
   }throw error;
  }setProfile({...getProfile(),...p});
  $('download-history').hidden=false;
  $('identity-status').textContent=p.identityKind==='account'?`Signed in as ${p.email}`:'Anonymous practice on this browser';
  $('signout').hidden=p.identityKind!=='account';$('prepare-signin').hidden=p.identityKind==='account';$('link-anonymous').closest('label').hidden=p.identityKind==='account';$('instructor-link').hidden=!p.isInstructor;$('assignments').hidden=p.identityKind!=='account';
  if(p.identityKind==='account'){
   const assignments=await readAllPages(request,'/assignments','assignments'),list=$('assignment-list');list.replaceChildren();if(!assignments.length)list.append(node('p','No assignments yet.'));
   for(const a of assignments){const row=document.createElement('div');row.append(node('p',`${a.title} · ${a.item_count} questions · closes ${new Date(a.closes_at).toLocaleString()} · ${a.attempts}/${a.max_attempts} attempts used`));const b=node('button','Start assignment');b.className='secondary';b.disabled=a.attempts>=a.max_attempts||Date.parse(a.opens_at)>Date.now()||Date.parse(a.closes_at)<=Date.now();const requestId=crypto.randomUUID();b.addEventListener('click',async()=>{b.disabled=true;try{await flush();const s=await request('/sessions',{assignmentId:a.id,requestId});setSession(s);await beginSession();}catch(e){$('identity-error').textContent=e.message;b.disabled=false;}});row.append(b);list.append(row);}
  }
 }
 async function loadGoogle(){if(window.google?.accounts?.id)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Google sign-in could not load.'));document.head.append(s);});}
 $('prepare-signin').addEventListener('click',async()=>{if(challengeBusy)return;challengeBusy=true;$('identity-error').textContent='';try{
  if(getProfile()?.needsReauthentication){const previous=getProfile();const temporary=await request('/profiles',{accepted:true,consentVersion:'2026-10-12-v1'});setProfile({...temporary,recoveryParticipantId:previous.participantId});}
  await ensureProfile();if(!getProfile()?.recoveryParticipantId)await flush();const challenge=await request('/auth/challenge',{});await loadGoogle();window.google.accounts.id.initialize({client_id:challenge.clientId,nonce:challenge.nonce,auto_select:false,callback:async result=>{try{const previous=getProfile(),recovering=!!previous.recoveryParticipantId,link=!recovering&&$('link-anonymous').checked;const signed=await request('/auth/google',{challengeId:challenge.challengeId,credential:result.credential,accepted:$('consent').checked,consentVersion:'2026-10-12-v1',linkAnonymous:link,...(recovering?{expectedParticipantId:previous.recoveryParticipantId}:{})});if(!link&&!recovering&&previous.identityKind==='anonymous')save('econ-unlinked-anonymous-profile-v1',previous);setProfile(signed);if(!link&&!recovering)setSession(null);$('google-signin').replaceChildren();await refresh();if(recovering){await flush();if(getSession())await beginSession();}}catch(e){$('identity-error').textContent=e.message;}}});window.google.accounts.id.renderButton($('google-signin'),{theme:'outline',size:'large',text:'signin_with'});}catch(e){$('identity-error').textContent=e.message;}finally{challengeBusy=false;ready();}});
 $('signout').addEventListener('click',async()=>{try{await flush();await request('/auth/logout',{});setProfile(null);setSession(null);$('identity-status').textContent='Signed out';$('download-history').hidden=true;$('signout').hidden=true;$('prepare-signin').hidden=false;$('link-anonymous').closest('label').hidden=false;$('assignments').hidden=true;$('instructor-link').hidden=true;show('setup');}catch(e){$('identity-error').textContent=e.message;}});
 $('download-history').addEventListener('click',async()=>{
  const button=$('download-history');button.disabled=true;
  try{
   await flush();let cursor='0',rows=[],seen=new Set();
   for(;;){const page=await request(`/profile/responses?after=${encodeURIComponent(cursor)}`);rows.push(...page.rows);if(!page.hasMore)break;if(!page.nextCursor||seen.has(page.nextCursor))throw new Error('History retrieval did not advance. No partial file was downloaded.');seen.add(page.nextCursor);cursor=page.nextCursor;}
   const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),participantId:getProfile().participantId,rows},null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download='my-economics-answer-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   $('identity-error').textContent=`Downloaded ${rows.length} submitted answers. Unfinished assessment keys remain hidden.`;
  }catch(e){$('identity-error').textContent=e.message;}finally{button.disabled=false;}
 });
 return {ensureProfile,refresh};
}
