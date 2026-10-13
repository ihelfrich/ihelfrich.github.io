import {createAssignment,listAssignments,startAssignment,assignmentReport} from './assignments.mjs';
import {buildBank,BANK_VERSION,courses} from '../../src/lib/econ-practice/index.mjs';
import {newState,recordAnswer,selectItem,score,progress} from '../../src/lib/econ-practice/adaptive.mjs';
const bank=buildBank(),byId=new Map(bank.map(q=>[q.id,q]));
import {iso,uuid,secret,hash,query,all,requireValue,HttpError,CONSENT_VERSION} from './common.mjs';
import {participant,issueCredential,createChallenge,finishSignIn,bearer,requireInstructor,isInstructor} from './auth.mjs';
export {hash,CONSENT_VERSION};
function publicItem(item){const {answer,answerDisplay,answerIndex,explanation,tolerance,...visible}=item;return visible;}
function feedback(item,response){return {correct:score(item,response),answer:item.format==='choice'?item.options[item.answerIndex]:item.answerDisplay,explanation:item.explanation};}
async function ownSession(env,p,id){
 const s=await query(env.DB,'SELECT * FROM sessions WHERE id=? AND participant_id=?',id,p.id).first();
 requireValue(s,'Session not found.',404);return s;
}
async function stateFor(env,p){
 const rows=await all(env.DB,`SELECT r.*,p.item_id,p.item_snapshot_json,s.mode FROM responses r JOIN presentations p ON p.id=r.presentation_id JOIN sessions s ON s.id=r.session_id WHERE r.participant_id=? AND r.attempt_number=1 ORDER BY r.server_received_at,r.event_id LIMIT 10001`,p.id);
 requireValue(rows.length<=10000,'This profile needs a history checkpoint before starting more sessions.',409);
 const state=newState();
 for(const r of rows){if(['late-receipt','after-completion'].includes(r.validity))continue;const item=JSON.parse(r.item_snapshot_json);recordAnswer(state,item,{response:JSON.parse(r.raw_answer_json),at:Date.parse(r.server_received_at),mode:r.mode,hints:r.hints_used,sessionId:r.session_id,eventId:r.event_id,measurementEligible:r.calibration_eligible===1});}
 return state;
}
async function body(request){
 requireValue(request.headers.get('Content-Type')?.split(';')[0]==='application/json','Use JSON.');
 const reader=request.body?.getReader();requireValue(reader,'Missing request body.');let chunks=[],size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new HttpError(413,'Request too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'Invalid JSON.');}
}
async function route(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/health'&&method==='GET')return {ok:true,bankVersion:BANK_VERSION,consentVersion:CONSENT_VERSION,tracking:'server-receipts',signInConfigured:!!env.GOOGLE_CLIENT_ID};
 if(path==='/profiles'&&method==='POST'){
  const b=await body(request);requireValue(b.consentVersion===CONSENT_VERSION&&b.accepted===true,'Accept the current response-collection notice to begin.');
  const id=uuid(),at=iso();
  await query(env.DB,'INSERT INTO participants (id,created_at,identity_kind,consent_version,consent_at) VALUES (?,?,?,?,?)',id,at,'anonymous',CONSENT_VERSION,at).run();
  return {participantId:id,identityKind:'anonymous',...await issueCredential(env,id,'anonymous')};
 }
 if(path.startsWith('/admin/')){
  const instructor=await requireInstructor(request,env);
  if(path==='/admin/assignments'&&method==='POST')return createAssignment(env,instructor,await body(request));
  if(path==='/admin/assignments'&&method==='GET')return {assignments:await all(env.DB,'SELECT * FROM assignments ORDER BY created_at DESC LIMIT 101')};
  if(path==='/admin/students'&&method==='GET')return {students:await all(env.DB,"SELECT id,verified_email,created_at FROM participants WHERE identity_kind='account' AND disabled_at IS NULL ORDER BY created_at DESC LIMIT 101")};
  const assignmentMatch=path.match(/^\/admin\/assignments\/([a-f0-9-]{36})$/);if(assignmentMatch&&method==='GET')return assignmentReport(env,assignmentMatch[1]);
  if(path==='/admin/responses'&&method==='GET'){
   const after=url.searchParams.get('after')??'';
   const rows=await all(env.DB,`SELECT r.*,p.item_id,p.family_id,p.item_version,p.topic,p.unit,p.selection_probability,p.selection_pool_size,p.selection_engine_version,p.model_version,p.first_family_exposure,s.course,s.mode FROM responses r JOIN presentations p ON p.id=r.presentation_id JOIN sessions s ON s.id=r.session_id WHERE r.ledger_sequence > CAST(? AS INTEGER) ORDER BY r.ledger_sequence LIMIT 501`,after||'0');
   // Cursor is obtained independently by row identity, not timestamps which can collide.
   const page=rows.slice(0,500);let next=null;if(page.length){const last=await query(env.DB,'SELECT ledger_sequence AS cursor FROM responses WHERE event_id=?',page.at(-1).event_id).first();next=String(last.cursor);}
   await query(env.DB,'INSERT INTO audit_log VALUES (?,?,?,?,?,?)',uuid(),iso(),'instructor','response-export',next??'empty',JSON.stringify({count:page.length})).run();
   return {rows:page,nextCursor:next,hasMore:rows.length>500};
  }
  if(path==='/admin/summary'&&method==='GET')return {courses:await all(env.DB,`SELECT s.course,COUNT(*) AS responses,COUNT(DISTINCT r.participant_id) AS participants,AVG(CASE WHEN r.validity NOT IN ('late-receipt','after-completion') THEN r.correct END) AS observedAccuracy,SUM(r.calibration_eligible) AS calibrationResponses FROM responses r JOIN sessions s ON s.id=r.session_id GROUP BY s.course`)};
  throw new HttpError(404,'Unknown instructor route.');
 }
 const p=await participant(request,env);
 if(path==='/profile'&&method==='GET')return {participantId:p.id,identityKind:p.identity_kind,email:p.verified_email,isInstructor:isInstructor(p,env)};
 if(path==='/auth/challenge'&&method==='POST')return createChallenge(env,p);
 if(path==='/auth/google'&&method==='POST')return finishSignIn(env,p,await body(request));
 if(path==='/auth/logout'&&method==='POST'){await query(env.DB,'UPDATE credentials SET revoked_at=? WHERE token_hash=?',iso(),await hash(bearer(request))).run();return {signedOut:true};}
 if(path==='/assignments'&&method==='GET')return listAssignments(env,p);
 if(path==='/sessions'&&method==='POST'){
  const b=await body(request);if(b.assignmentId)return startAssignment(env,p,b);requireValue(!b.assigned,'Provide an instructor assignment ID; assigned mode cannot be self-declared.',403);requireValue(courses[b.course],'Unknown course.');requireValue(['practice','assessment'].includes(b.mode),'Unknown mode.');
  requireValue(!b.assigned||p.identity_kind==='account','Assigned assessments require a verified account.',403);
  requireValue(Number.isInteger(b.unit??0)&&(b.unit??0)>=0&&(b.unit??0)<=6,'Invalid unit.');
  requireValue(!b.topic||(typeof b.topic==='string'&&bank.some(q=>q.course===b.course&&q.topic===b.topic)),'Invalid topic.');
  const recent=await query(env.DB,'SELECT COUNT(*) AS n FROM sessions WHERE participant_id=? AND started_at>?',p.id,new Date(Date.now()-86400000).toISOString()).first();requireValue(recent.n<100,'Daily session limit reached.',429);
  const id=uuid(),at=iso();await query(env.DB,'INSERT INTO sessions (id,participant_id,course,mode,bank_version,started_at,token_hash,expires_at,assigned,unit_filter,topic_filter) VALUES (?,?,?,?,?,?,?,?,?,?,?)',id,p.id,b.course,b.mode,BANK_VERSION,at,'participant-auth',new Date(Date.now()+30*86400000).toISOString(),Number(!!b.assigned),b.unit??0,b.topic??'').run();
  return {sessionId:id,course:b.course,mode:b.mode,bankVersion:BANK_VERSION};
 }
 const match=path.match(/^\/sessions\/([a-f0-9-]{36})\/(next|answers|hint|complete|report)$/);requireValue(match,'Unknown route.',404);
 const [,sid,action]=match,s=await ownSession(env,p,sid);
 if(action==='report'&&method==='GET'){
  const rows=await all(env.DB,'SELECT r.*,p.item_snapshot_json FROM responses r JOIN presentations p ON p.id=r.presentation_id WHERE r.session_id=? ORDER BY p.sequence,r.attempt_number',sid);
  return {sessionId:sid,completed:!!s.completed_at,rows:rows.map(r=>({eventId:r.event_id,item:publicItem(JSON.parse(r.item_snapshot_json)),response:JSON.parse(r.raw_answer_json),...(s.mode==='practice'||s.completed_at?feedback(JSON.parse(r.item_snapshot_json),JSON.parse(r.raw_answer_json)):{}),receipt:r.server_received_at,validity:r.validity,countsTowardResult:!['late-receipt','after-completion'].includes(r.validity)})),progress:progress(await stateFor(env,p),s.course)};
 }
 requireValue(method==='POST','Method not allowed.',405);
 if(action==='complete'){
  await query(env.DB,'UPDATE sessions SET completed_at=COALESCE(completed_at,?) WHERE id=?',iso(),sid).run();return {completed:true};
 }
 if(action==='answers'){
  const b=await body(request);requireValue(typeof b.eventId==='string'&&/^[a-f0-9-]{36}$/.test(b.eventId),'Invalid event ID.');
  requireValue(typeof b.presentationId==='string','Missing presentation.');
  requireValue(Number.isInteger(b.attemptNumber)&&b.attemptNumber>=1&&b.attemptNumber<=20,'Invalid attempt number.');
  requireValue(typeof b.response==='number'||typeof b.response==='string','Invalid answer.');requireValue(String(b.response).length<=100,'Answer too long.');
  requireValue(Number.isInteger(b.elapsedMs)&&b.elapsedMs>=0&&b.elapsedMs<=86400000,'Invalid elapsed time.');requireValue(Number.isInteger(b.activeMs)&&b.activeMs>=0&&b.activeMs<=b.elapsedMs,'Invalid active time.');
  requireValue(typeof b.submittedAt==='string'&&Number.isFinite(Date.parse(b.submittedAt)),'Invalid submission time.');
  const canonical=JSON.stringify({presentationId:b.presentationId,attemptNumber:b.attemptNumber,response:b.response,elapsedMs:b.elapsedMs,activeMs:b.activeMs,submittedAt:b.submittedAt});const digest=await hash(canonical);
  const existing=await query(env.DB,'SELECT * FROM responses WHERE event_id=?',b.eventId).first();
  if(existing){requireValue(existing.participant_id===p.id&&existing.session_id===sid&&existing.payload_sha256===digest,'Idempotency conflict.',409);const pr=await query(env.DB,'SELECT * FROM presentations WHERE id=?',existing.presentation_id).first();return {eventId:b.eventId,receipt:existing.server_received_at,persisted:true,validity:existing.validity,countsTowardResult:!['late-receipt','after-completion'].includes(existing.validity),...(s.mode==='practice'||s.completed_at?feedback(JSON.parse(pr.item_snapshot_json),b.response):{})};}
  const pr=await query(env.DB,'SELECT * FROM presentations WHERE id=? AND session_id=?',b.presentationId,sid).first();requireValue(pr,'Presentation not found.',404);
  const item=JSON.parse(pr.item_snapshot_json);
  if(item.format==='choice')requireValue(Number.isInteger(b.response)&&b.response>=0&&b.response<item.options.length,'Choose an available answer.');
  else requireValue(String(b.response).trim()!==''&&Number.isFinite(Number(b.response)),'Enter a finite number.');
  const previous=await query(env.DB,'SELECT COUNT(*) AS n FROM responses WHERE presentation_id=?',pr.id).first();requireValue(b.attemptNumber===previous.n+1,'Attempt sequence conflict.',409);requireValue(s.mode==='practice'||previous.n===0,'Assessment answers cannot be changed.',409);
  const correct=score(item,b.response),at=iso(),validity=b.activeMs<1500?'rapid-response':'valid';
  const eligible=s.mode==='assessment'&&pr.first_family_exposure===1&&pr.hints_used===0&&previous.n===0&&validity==='valid';
  try{await query(env.DB,`INSERT INTO responses (event_id,presentation_id,session_id,participant_id,attempt_number,raw_answer_json,correct,score,client_submitted_at,server_received_at,elapsed_ms,active_ms,hints_used,feedback_before_answer,validity,calibration_eligible,payload_sha256) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN completed_at IS NOT NULL THEN 'after-completion' WHEN expires_at<=? THEN 'late-receipt' ELSE ? END,CASE WHEN completed_at IS NOT NULL OR expires_at<=? THEN 0 ELSE ? END,? FROM sessions WHERE id=?`,b.eventId,pr.id,sid,p.id,b.attemptNumber,JSON.stringify(b.response),Number(correct),Number(correct),b.submittedAt,at,b.elapsedMs,b.activeMs,pr.hints_used,Number(previous.n>0&&s.mode==='practice'),at,validity,at,Number(eligible),digest,sid).run();}
  catch(error){
   const raced=await query(env.DB,'SELECT * FROM responses WHERE event_id=?',b.eventId).first();
   if(!raced){const duplicate=await query(env.DB,'SELECT event_id FROM responses WHERE presentation_id=? AND attempt_number=?',pr.id,b.attemptNumber).first();if(duplicate)throw new HttpError(409,'This attempt was already saved under a different event ID.');throw error;}
   requireValue(raced.participant_id===p.id&&raced.session_id===sid&&raced.payload_sha256===digest,'Idempotency conflict.',409);
   return {eventId:b.eventId,receipt:raced.server_received_at,persisted:true,validity:raced.validity,countsTowardResult:!['late-receipt','after-completion'].includes(raced.validity),...(s.mode==='practice'?feedback(item,b.response):{})};
  }
  const stored=await query(env.DB,'SELECT validity FROM responses WHERE event_id=?',b.eventId).first();
  return {eventId:b.eventId,receipt:at,persisted:true,validity:stored.validity,countsTowardResult:!['late-receipt','after-completion'].includes(stored.validity),...(s.mode==='practice'?feedback(item,b.response):{})};
 }
 requireValue(!s.completed_at,'Session is complete.',409);requireValue(s.expires_at>iso(),'Session expired.',409);
 if(action==='hint'){
  requireValue(s.mode==='practice','Hints are unavailable during assessments.',403);const b=await body(request);
  const pr=await query(env.DB,'SELECT * FROM presentations WHERE id=? AND session_id=?',b.presentationId,sid).first();requireValue(pr,'Presentation not found.',404);
  await query(env.DB,'UPDATE presentations SET hints_used=hints_used+1 WHERE id=?',pr.id).run();
  return {hint:'Identify the relevant economic condition, write it in symbols, and distinguish marginal quantities from averages. Check the units before calculating.'};
 }
 if(action==='next'){
  const current=await query(env.DB,'SELECT * FROM presentations WHERE session_id=? ORDER BY sequence DESC LIMIT 1',sid).first();
  if(current){const answered=await query(env.DB,'SELECT event_id FROM responses WHERE presentation_id=? LIMIT 1',current.id).first();if(!answered)return {presentationId:current.id,item:publicItem(JSON.parse(current.item_snapshot_json)),sequence:current.sequence};}
  const length=s.mode==='assessment'?s.target_count:100;
  if((current?.sequence??0)>=length)return {done:true,reason:'session-length'};
  const state=await stateFor(env,p),selected=selectItem(bank,state,{course:s.course,mode:s.mode,unit:s.unit_filter,topic:s.topic_filter,sessionId:sid});if(!selected)return {done:true,reason:'eligible-bank-exhausted'};
  const {item,selection}=selected,id=uuid(),sequence=(current?.sequence??0)+1;
  const exposed=await query(env.DB,'SELECT p.id FROM presentations p JOIN sessions s ON s.id=p.session_id WHERE s.participant_id=? AND p.family_id=? AND s.course=? LIMIT 1',p.id,item.family,s.course).first();
  try{await query(env.DB,'INSERT INTO presentations (id,session_id,item_id,item_version,family_id,topic,unit,presented_at,selection_probability,selection_pool_size,selection_engine_version,model_version,first_family_exposure,item_snapshot_json,sequence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,sid,item.id,item.version,item.family,item.topic,item.unit,iso(),selection.probability,selection.eligibleItems,selection.engineVersion,selection.modelVersion,Number(!exposed),JSON.stringify(item),sequence).run();}
  catch(error){const raced=await query(env.DB,'SELECT * FROM presentations WHERE session_id=? AND sequence=?',sid,sequence).first();if(!raced)throw error;return {presentationId:raced.id,item:publicItem(JSON.parse(raced.item_snapshot_json)),sequence:raced.sequence};}
  return {presentationId:id,item:publicItem(item),sequence,selection};
 }
 throw new HttpError(404,'Unknown route.');
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS??'https://ihelfrich.github.io').split(',');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin&&!allowed.includes(origin))return Response.json({error:'Origin not allowed.'},{status:403,headers});
 if(origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{return Response.json(await route(request,env),{headers});}catch(error){return Response.json({error:error instanceof HttpError?error.message:'The response service could not finish this operation. Retry with the same event ID.'},{status:error.status??500,headers});}
}};
