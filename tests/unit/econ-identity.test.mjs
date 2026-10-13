import test from 'node:test';
import assert from 'node:assert/strict';
import {setupIdentity} from '../../src/scripts/econ-identity.mjs';
import {createLocalDB} from '../../services/econ-response/local-db.mjs';
import {readFileSync,readdirSync} from 'node:fs';
import {finishSignIn,participant} from '../../services/econ-response/auth.mjs';
import worker from '../../services/econ-response/worker.mjs';
import {CONSENT_VERSION} from '../../services/econ-response/common.mjs';

test('lost link response, reload and wrong-account retry preserve pending answers and session',async()=>{
 const DB=createLocalDB();for(const name of readdirSync('services/econ-response/migrations').filter(n=>n.endsWith('.sql')).sort())DB.exec(readFileSync('services/econ-response/migrations/'+name,'utf8'));
 const env={DB,GOOGLE_CLIENT_ID:'synthetic'},nodes=new Map(),oldDocument=globalThis.document,oldWindow=globalThis.window;
 let profile=null,session=null,callback,googleAccount='owner',loseResponse=true,flushes=0;
 const pending=[];let pendingEvent;
 globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{checked:true,handlers:{},addEventListener(k,f){this.handlers[k]=f;},closest(){return this;},replaceChildren(){},append(){}});return nodes.get(id);},createElement(){return {append(){},addEventListener(){}};}};
 globalThis.window={google:{accounts:{id:{initialize(options){callback=options.callback;},renderButton(){}}}}};
 async function request(path,data){
  if(path==='/auth/google'){
   const p=await participant(new Request('https://local.test',{headers:{Authorization:`Bearer ${profile.token}`}}),env);
   const signed=await finishSignIn(env,p,data,async()=>({subjectHash:googleAccount,email:googleAccount+'@example.test'}));
   if(loseResponse){loseResponse=false;pending.push(pendingEvent);throw new Error('Connection lost after commit');}return signed;
  }
  const r=await worker.fetch(new Request('https://local.test'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(profile?{Authorization:`Bearer ${profile.token}`}:{})},...(data?{body:JSON.stringify(data)}:{})}),env),b=await r.json();if(!r.ok){const e=new Error(b.error);e.status=r.status;throw e;}return b;
 }
 const setup=()=>setupIdentity({request,flush:async()=>{flushes++;for(const event of [...pending]){const receipt=await request(`/sessions/${event.sessionId}/answers`,event.payload);assert.equal(receipt.persisted,true);assert.equal(receipt.eventId,event.payload.eventId);pending.splice(pending.indexOf(event),1);}},getProfile:()=>profile,setProfile:p=>{profile=JSON.parse(JSON.stringify(p));},getSession:()=>session,setSession:s=>{session=s;},beginSession:async()=>{},ready(){},show(){},save(){}});
 try{
  let ui=setup();await ui.ensureProfile();const oldToken=profile.token;session=await request('/sessions',{course:'ap-micro',mode:'practice'});const sessionId=session.sessionId;
  const presented=await request(`/sessions/${sessionId}/next`,{});pendingEvent={sessionId,payload:{eventId:crypto.randomUUID(),presentationId:presented.presentationId,attemptNumber:1,response:0,elapsedMs:5000,activeMs:4500,submittedAt:new Date().toISOString()}};
  await nodes.get('prepare-signin').handlers.click();await callback({credential:'synthetic'});
  assert.equal(profile.linkPending,true);assert.equal(profile.token,oldToken);assert.equal(pending.length,1);
  // Reload uses the persisted profile and session, not in-memory transition state.
  ui=setup();assert.equal(await ui.refresh(),false);assert.equal(profile.needsReauthentication,true);
  await nodes.get('prepare-signin').handlers.click();assert.equal(profile.recoveryAnonymousToken,oldToken);
  const beforeRecoveryFlush=flushes;googleAccount='wrong';await callback({credential:'synthetic'});
  assert.match(nodes.get('identity-error').textContent,/same account/);assert.equal(pending.length,1);assert.equal(session.sessionId,sessionId);assert.equal(flushes,beforeRecoveryFlush);
  ui=setup();await ui.refresh();await assert.rejects(ui.ensureProfile(),/same account/);
  googleAccount='owner';await nodes.get('prepare-signin').handlers.click();await callback({credential:'synthetic'});
  assert.equal(profile.identityKind,'account');assert.equal(profile.recoveryAnonymousToken,undefined);assert.equal(pending.length,0);assert.equal(session.sessionId,sessionId);
  assert.equal((await DB.prepare('SELECT participant_id FROM responses WHERE event_id=?').bind(pendingEvent.payload.eventId).first()).participant_id,profile.participantId);
  assert.equal((await DB.prepare('SELECT participant_id FROM sessions WHERE id=?').bind(sessionId).first()).participant_id,profile.participantId);
  await assert.rejects(participant(new Request('https://local.test',{headers:{Authorization:`Bearer ${oldToken}`}}),env));
 }finally{DB.close();globalThis.document=oldDocument;globalThis.window=oldWindow;}
});

test('a successful credential refresh clears a stale reauthentication flag',async()=>{
 const oldDocument=globalThis.document,nodes=new Map();let profile={identityKind:'anonymous',participantId:'active',token:'active-token',needsReauthentication:true};
 globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{addEventListener(){},closest(){return this;}});return nodes.get(id);}};
 try{const ui=setupIdentity({request:async path=>{assert.equal(path,'/profile');return {identityKind:'anonymous',participantId:'active'};},getProfile:()=>profile,setProfile:p=>profile=p,ready(){}});await ui.refresh();assert.equal(profile.needsReauthentication,false);await ui.ensureProfile();}finally{globalThis.document=oldDocument;}
});

test('expired anonymous recovery asks for fresh consent before linking and retains it across reload',async()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window,nodes=new Map();let profile={identityKind:'anonymous',participantId:'expired',token:'expired-token'},callback,consentRequests=[],flushes=0;
 globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{checked:true,handlers:{},addEventListener(k,f){this.handlers[k]=f;},closest(){return this;},replaceChildren(){},append(){}});return nodes.get(id);},createElement(){return {};}};
 globalThis.window={google:{accounts:{id:{initialize(options){callback=options.callback;},renderButton(){}}}}};
 async function request(path,data){if(path==='/profile'){if(profile.token==='expired-token'){const e=new Error('Expired');e.status=401;throw e;}return profile;}if(path==='/profiles')return {identityKind:'anonymous',participantId:'temp',token:'temp-token'};if(path==='/auth/challenge')return {challengeId:'challenge',nonce:'nonce',clientId:'synthetic'};if(path==='/auth/google'){consentRequests.push(data.recoverExpiredAnonymous);if(!data.recoverExpiredAnonymous){const e=new Error('Select the history-linking checkbox');e.status=428;throw e;}return {identityKind:'account',participantId:'recovered',token:'fresh-token'};}if(path.startsWith('/assignments'))return {assignments:[],hasMore:false};throw new Error(path);}
 const setup=()=>setupIdentity({request,flush:async()=>{flushes++;assert.equal(profile.participantId,'recovered');},getProfile:()=>profile,setProfile:p=>profile=JSON.parse(JSON.stringify(p)),getSession:()=>null,ready(){}});
 try{let ui=setup();await ui.refresh();await nodes.get('prepare-signin').handlers.click();await callback({credential:'synthetic'});assert.equal(profile.recoveryNeedsLinkConsent,true);assert.equal(nodes.get('link-anonymous').hidden,false);assert.equal(nodes.get('link-anonymous').checked,false);assert.equal(flushes,0);
 ui=setup();await ui.refresh();nodes.get('link-anonymous').checked=true;await nodes.get('prepare-signin').handlers.click();await callback({credential:'synthetic'});assert.deepEqual(consentRequests,[false,true]);assert.equal(profile.participantId,'recovered');assert.equal(flushes,1);
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
