import {hintFor} from '../../src/lib/econ-practice/hints.mjs';
import {registerModel} from './model-registry.mjs';
import {ensureCurrentBank,archivedBank} from './bank-archive.mjs';
import {findUnscored,retainUnscored,unscoredReceipt} from './unscored.mjs';
import {responseWindow} from './response-cursor.mjs';
import {replayHistory} from './history.mjs';
import {gradeResponse,publicQuestion,responseFeedback,validResponseShape} from '../../src/lib/econ-practice/scoring.mjs';
import {pageCursor,listPage} from './pagination.mjs';
import {createAssignment,listAssignments,startAssignment,assignmentReport} from './assignments.mjs';
import {buildBank,BANK_VERSION,courses} from '../../src/lib/econ-practice/index.mjs';
import {selectItem,progress} from '../../src/lib/econ-practice/adaptive.mjs';
const bank=buildBank(),byId=new Map(bank.map(q=>[q.id,q]));
import {iso,uuid,secret,hash,query,all,requireValue,HttpError,CONSENT_VERSION} from './common.mjs';
import {participant,issueCredential,createChallenge,finishSignIn,bearer,requireInstructor,isInstructor} from './auth.mjs';
export {hash,CONSENT_VERSION};
const publicItem=publicQuestion,feedback=responseFeedback;
async function ownSession(env,p,id){
 const s=await query(env.DB,'SELECT * FROM sessions WHERE id=? AND participant_id=?',id,p.id).first();
 requireValue(s,'Session not found.',404);return s;
}
const stateFor=(env,p)=>replayHistory(env,p.id);
async function body(request,maxBytes=8192){
 requireValue(request.headers.get('Content-Type')?.split(';')[0]==='application/json','Use JSON.');
 const reader=request.body?.getReader();requireValue(reader,'Missing request body.');let chunks=[],size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new HttpError(413,'Request too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new HttpError(400,'Invalid JSON.');}
 requireValue(parsed!==null&&typeof parsed==='object'&&!Array.isArray(parsed),'Provide a JSON object.');return parsed;
}
async function unscoredPage(env,url,participantId){
 const window=await responseWindow(env.DB,url.searchParams.get('after')??'',participantId,'unscored_submissions');
 const rows=await all(env.DB,`SELECT * FROM unscored_submissions WHERE ledger_sequence>? AND ledger_sequence<=?${participantId?' AND participant_id=?':''} ORDER BY ledger_sequence LIMIT 501`,window.after,window.until,...(participantId?[participantId]:[]));
 const page=rows.slice(0,500);return {rows:page,nextCursor:page.length?window.next(page.at(-1).ledger_sequence):null,hasMore:rows.length>500,snapshotThrough:window.until};
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
  const audit=async(action,target,details)=>query(env.DB,'INSERT INTO audit_log VALUES (?,?,?,?,?,?)',uuid(),iso(),instructor.id,action,target,JSON.stringify(details)).run();
  if(path==='/admin/questions'&&method==='GET'){
   const course=url.searchParams.get('course')??'',unit=url.searchParams.get('unit')??'',search=(url.searchParams.get('q')??'').trim().toLowerCase(),after=url.searchParams.get('after')??'';
   const expectedVersion=url.searchParams.get('version');
   requireValue(!after||expectedVersion,'A bank version is required to continue this search.');
   requireValue(!expectedVersion||expectedVersion===BANK_VERSION,'The question bank changed. Start a new search to avoid mixing versions.',409);
   requireValue(search.length<=200&&after.length<=160,'Invalid question filter.');
   requireValue(!course||bank.some(q=>q.course===course),'Unknown course.');
   requireValue(!unit||/^[1-9][0-9]*$/.test(unit),'Invalid unit.');
   const filtered=bank.filter(q=>(!course||q.course===course)&&(!unit||q.unit===Number(unit))&&(!search||[q.id,q.family,q.title,q.topicName,q.prompt].join(' ').toLowerCase().includes(search))).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
   const remaining=filtered.filter(q=>q.id>after),items=remaining.slice(0,30);
   await audit('question-library-read',BANK_VERSION,{course,unit,count:items.length});
   return {bankVersion:BANK_VERSION,total:filtered.length,families:new Set(filtered.map(q=>q.family)).size,items,hasMore:remaining.length>30,nextCursor:items.at(-1)?.id??null};
  }
  if(path==='/admin/model-packages'&&method==='POST')return registerModel(env,instructor,await body(request,1024*1024));
  const modelMatch=path.match(/^\/admin\/model-packages\/(calibration-[a-f0-9]{64})$/);
  if(modelMatch&&method==='GET'){const record=await query(env.DB,'SELECT * FROM model_packages WHERE id=?',modelMatch[1]).first();requireValue(record,'Model package not found.',404);await audit('model-package-read',record.id,{});return {artifact:JSON.parse(record.artifact_json),registeredAt:record.created_at,registeredBy:record.created_by,status:'candidate',activated:false};}
  if(path==='/admin/assignments'&&method==='POST')return createAssignment(env,instructor,await body(request));
  if(path==='/admin/assignments'&&method==='GET')return listPage(await all(env.DB,'SELECT * FROM assignments WHERE id>? ORDER BY id LIMIT 101',pageCursor(url.searchParams.get('after')??'')),'assignments');
  if(path==='/admin/students'&&method==='GET'){const after=pageCursor(url.searchParams.get('after')??'');const page=listPage(await all(env.DB,"SELECT id,verified_email,created_at FROM participants WHERE identity_kind='account' AND disabled_at IS NULL AND id>? ORDER BY id LIMIT 101",after),'students');await audit('student-directory-read',after||'start',{count:page.students.length,nextCursor:page.nextCursor});return page;}
  const assignmentMatch=path.match(/^\/admin\/assignments\/([a-f0-9-]{36})$/);if(assignmentMatch&&method==='GET'){const report=await assignmentReport(env,assignmentMatch[1]);await audit('assignment-report-read',assignmentMatch[1],{});return report;}
  if(path==='/admin/unscored-submissions'&&method==='GET'){const page=await unscoredPage(env,url);await audit('unscored-submission-export',page.nextCursor??'empty',{count:page.rows.length,snapshotThrough:page.snapshotThrough});return page;}
  if(path==='/admin/responses'&&method==='GET'){
   const window=await responseWindow(env.DB,url.searchParams.get('after')??'');
   const rows=await all(env.DB,`SELECT r.*,p.item_id,p.family_id,p.item_version,p.topic,p.unit,p.selection_probability,p.selection_pool_size,p.selection_engine_version,p.model_version,p.measurement_parameters_json,p.first_family_exposure,s.course,s.mode FROM responses r JOIN presentations p ON p.id=r.presentation_id JOIN sessions s ON s.id=r.session_id WHERE r.ledger_sequence>? AND r.ledger_sequence<=? ORDER BY r.ledger_sequence LIMIT 501`,window.after,window.until);
   // Cursor is obtained independently by row identity, not timestamps which can collide.
   const page=rows.slice(0,500),next=page.length?window.next(page.at(-1).ledger_sequence):null;
   await audit('response-export',next??'empty',{count:page.length,after:window.after,snapshotThrough:window.until});
   return {rows:page,nextCursor:next,hasMore:rows.length>500,snapshotThrough:window.until};
  }
  if(path==='/admin/summary'&&method==='GET')return {definition:'Descriptive response statistics by course and mode; not ability estimates. Late/completed-session receipts are retained but excluded from accuracy and credit.',courses:await all(env.DB,`SELECT s.course,s.mode,COUNT(*) AS responses,COUNT(DISTINCT r.participant_id) AS participants,
   SUM(CASE WHEN r.validity NOT IN ('late-receipt','after-completion') THEN 1 ELSE 0 END) AS countedAttempts,
   SUM(CASE WHEN r.validity IN ('late-receipt','after-completion') THEN 1 ELSE 0 END) AS excludedReceipts,
   AVG(CASE WHEN r.validity NOT IN ('late-receipt','after-completion') THEN r.correct END) AS attemptAccuracy,
   SUM(CASE WHEN r.attempt_number=1 AND r.validity NOT IN ('late-receipt','after-completion') THEN 1 ELSE 0 END) AS firstAttempts,
   AVG(CASE WHEN r.attempt_number=1 AND r.validity NOT IN ('late-receipt','after-completion') THEN r.correct END) AS firstAttemptAccuracy,
   AVG(CASE WHEN r.attempt_number=1 AND r.validity NOT IN ('late-receipt','after-completion') THEN r.score END) AS firstAttemptMeanCredit,
   SUM(CASE WHEN r.attempt_number=1 AND r.hints_used>0 AND r.validity NOT IN ('late-receipt','after-completion') THEN 1 ELSE 0 END) AS assistedFirstAttempts,
   SUM(r.calibration_eligible) AS calibrationResponses FROM responses r JOIN sessions s ON s.id=r.session_id GROUP BY s.course,s.mode ORDER BY s.course,s.mode`)};
  throw new HttpError(404,'Unknown instructor route.');
 }
 const p=await participant(request,env);
 if(path==='/profile'&&method==='GET')return {participantId:p.id,identityKind:p.identity_kind,email:p.verified_email,isInstructor:isInstructor(p,env)};
 if(path==='/profile/unscored-submissions'&&method==='GET')return unscoredPage(env,url,p.id);
 if(path==='/profile/responses'&&method==='GET'){
  const window=await responseWindow(env.DB,url.searchParams.get('after')??'',p.id);
  const raw=await all(env.DB,`SELECT r.*,pr.item_snapshot_json,s.course,s.mode,s.completed_at FROM responses r JOIN presentations pr ON pr.id=r.presentation_id JOIN sessions s ON s.id=r.session_id WHERE r.participant_id=? AND r.ledger_sequence>? AND r.ledger_sequence<=? ORDER BY r.ledger_sequence LIMIT 501`,p.id,window.after,window.until);
  const page=raw.slice(0,500);
  return {participantId:p.id,rows:page.map(r=>({eventId:r.event_id,sessionId:r.session_id,presentationId:r.presentation_id,course:r.course,mode:r.mode,item:publicItem(JSON.parse(r.item_snapshot_json)),response:JSON.parse(r.raw_answer_json),attemptNumber:r.attempt_number,submittedAt:r.client_submitted_at,receipt:r.server_received_at,elapsedMs:r.elapsed_ms,activeMs:r.active_ms,hintsUsed:r.hints_used,validity:r.validity,countsTowardResult:!['late-receipt','after-completion'].includes(r.validity),...(r.mode==='practice'||r.completed_at?feedback(JSON.parse(r.item_snapshot_json),JSON.parse(r.raw_answer_json)): {})})),hasMore:raw.length>500,snapshotThrough:window.until,nextCursor:page.length?window.next(page.at(-1).ledger_sequence):null};
 }
 if(path==='/auth/challenge'&&method==='POST')return createChallenge(env,p);
 if(path==='/auth/google'&&method==='POST')return finishSignIn(env,p,await body(request));
 if(path==='/auth/logout'&&method==='POST'){await query(env.DB,'UPDATE credentials SET revoked_at=? WHERE token_hash=?',iso(),await hash(bearer(request))).run();return {signedOut:true};}
 if(path==='/assignments'&&method==='GET')return listAssignments(env,p,pageCursor(url.searchParams.get('after')??''));
 if(path==='/sessions'&&method==='POST'){
  const b=await body(request);if(b.assignmentId)return startAssignment(env,p,b);requireValue(!b.assigned,'Provide an instructor assignment ID; assigned mode cannot be self-declared.',403);requireValue(courses[b.course],'Unknown course.');requireValue(['practice','assessment'].includes(b.mode),'Unknown mode.');
  requireValue(!b.assigned||p.identity_kind==='account','Assigned assessments require a verified account.',403);
  requireValue(Number.isInteger(b.unit??0)&&(b.unit??0)>=0&&(b.unit??0)<=6,'Invalid unit.');
  requireValue(!b.topic||(typeof b.topic==='string'&&bank.some(q=>q.course===b.course&&q.topic===b.topic)),'Invalid topic.');
  const recent=await query(env.DB,'SELECT COUNT(*) AS n FROM sessions WHERE participant_id=? AND started_at>?',p.id,new Date(Date.now()-86400000).toISOString()).first();requireValue(recent.n<100,'Daily session limit reached.',429);
  await ensureCurrentBank(env.DB);
  const id=uuid(),at=iso();await query(env.DB,'INSERT INTO sessions (id,participant_id,course,mode,bank_version,started_at,token_hash,expires_at,assigned,unit_filter,topic_filter) VALUES (?,?,?,?,?,?,?,?,?,?,?)',id,p.id,b.course,b.mode,BANK_VERSION,at,'participant-auth',new Date(Date.now()+30*86400000).toISOString(),Number(!!b.assigned),b.unit??0,b.topic??'').run();
  return {sessionId:id,course:b.course,mode:b.mode,bankVersion:BANK_VERSION};
 }
 const match=path.match(/^\/sessions\/([a-f0-9-]{36})\/(next|answers|hint|complete|report)$/);requireValue(match,'Unknown route.',404);
 const [,sid,action]=match,s=await ownSession(env,p,sid);
 if(action==='report'&&method==='GET'){
  const rows=await all(env.DB,'SELECT r.*,p.item_snapshot_json,p.sequence FROM responses r JOIN presentations p ON p.id=r.presentation_id WHERE r.session_id=? ORDER BY p.sequence,r.attempt_number',sid);
  const hints=await all(env.DB,'SELECT h.* FROM hint_events h JOIN presentations p ON p.id=h.presentation_id WHERE p.session_id=? ORDER BY h.ledger_sequence',sid);
  const presentationCounts=await query(env.DB,'SELECT COUNT(*) AS presented,COUNT(CASE WHEN NOT EXISTS (SELECT 1 FROM responses r WHERE r.presentation_id=p.id) THEN 1 END) AS unanswered FROM presentations p WHERE p.session_id=?',sid).first();
  return {sessionId:sid,bankVersion:s.bank_version,currentBankVersion:BANK_VERSION,completed:!!s.completed_at,hints,coverage:{planned:s.target_count,presented:presentationCounts.presented,unanswered:presentationCounts.unanswered,answered:presentationCounts.presented-presentationCounts.unanswered},rows:rows.map(r=>({eventId:r.event_id,presentationId:r.presentation_id,sequence:r.sequence,attemptNumber:r.attempt_number,item:publicItem(JSON.parse(r.item_snapshot_json)),response:JSON.parse(r.raw_answer_json),...(s.mode==='practice'||s.completed_at?feedback(JSON.parse(r.item_snapshot_json),JSON.parse(r.raw_answer_json)):{}),receipt:r.server_received_at,validity:r.validity,countsTowardResult:!['late-receipt','after-completion'].includes(r.validity)})),progress:progress(await stateFor(env,p),s.course,{sessionId:sid})};
 }
 requireValue(method==='POST','Method not allowed.',405);
 if(action==='complete'){
  await query(env.DB,'UPDATE sessions SET completed_at=COALESCE(completed_at,?) WHERE id=?',iso(),sid).run();return {completed:true};
 }
 if(action==='answers'){
  const b=await body(request);requireValue(typeof b.eventId==='string'&&/^[a-f0-9-]{36}$/.test(b.eventId),'Invalid event ID.');
  requireValue(typeof b.presentationId==='string','Missing presentation.');
  requireValue(Number.isInteger(b.attemptNumber)&&b.attemptNumber>=1&&b.attemptNumber<=20,'Invalid attempt number.');
  requireValue(b.response!==null&&['number','string','object'].includes(typeof b.response)&&!Array.isArray(b.response),'Invalid answer.');
  requireValue(Number.isInteger(b.elapsedMs)&&b.elapsedMs>=0&&b.elapsedMs<=86400000,'Invalid elapsed time.');requireValue(Number.isInteger(b.activeMs)&&b.activeMs>=0&&b.activeMs<=b.elapsedMs,'Invalid active time.');
  requireValue(typeof b.submittedAt==='string'&&Number.isFinite(Date.parse(b.submittedAt)),'Invalid submission time.');
  const canonical=JSON.stringify({presentationId:b.presentationId,attemptNumber:b.attemptNumber,response:b.response,elapsedMs:b.elapsedMs,activeMs:b.activeMs,submittedAt:b.submittedAt});const digest=await hash(canonical);
  const pr=await query(env.DB,'SELECT * FROM presentations WHERE id=? AND session_id=?',b.presentationId,sid).first();requireValue(pr,'Presentation not found.',404);
  const item=JSON.parse(pr.item_snapshot_json);
  requireValue(validResponseShape(item,b.response),'Provide a valid answer for every part.');
  const retained=await findUnscored(env.DB,p.id,sid,b.eventId,digest);if(retained)return unscoredReceipt(retained);
  const archive=reason=>retainUnscored(env.DB,p.id,sid,{eventId:b.eventId,...JSON.parse(canonical)},digest,reason);
  const existing=await query(env.DB,'SELECT * FROM responses WHERE event_id=?',b.eventId).first();
  if(existing){if(existing.participant_id!==p.id||existing.session_id!==sid||existing.payload_sha256!==digest)return archive('idempotency-conflict');const pr=await query(env.DB,'SELECT * FROM presentations WHERE id=?',existing.presentation_id).first();return {eventId:b.eventId,receipt:existing.server_received_at,persisted:true,validity:existing.validity,countsTowardResult:!['late-receipt','after-completion'].includes(existing.validity),...(s.mode==='practice'||s.completed_at?feedback(JSON.parse(pr.item_snapshot_json),b.response):{})};}
  const previous=await query(env.DB,'SELECT COUNT(*) AS n FROM responses WHERE presentation_id=?',pr.id).first();if(b.attemptNumber!==previous.n+1)return archive('attempt-sequence-conflict');if(s.mode!=='practice'&&previous.n!==0)return archive('assessment-answer-locked');
  const grade=gradeResponse(item,b.response),correct=grade.correct,validity=b.activeMs<1500?'rapid-response':'valid';
  const eligible=item.format!=='multipart'&&s.mode==='assessment'&&pr.first_family_exposure===1&&pr.hints_used===0&&previous.n===0&&validity==='valid';
  let inserted;try{inserted=await query(env.DB,`INSERT INTO responses (event_id,presentation_id,session_id,participant_id,attempt_number,raw_answer_json,correct,score,client_submitted_at,server_received_at,elapsed_ms,active_ms,hints_used,feedback_before_answer,validity,calibration_eligible,payload_sha256) SELECT ?,?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),?,?,current.hints_used,?,CASE WHEN completed_at IS NOT NULL THEN 'after-completion' WHEN expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'late-receipt' ELSE ? END,CASE WHEN completed_at IS NOT NULL OR expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR current.hints_used>0 THEN 0 ELSE ? END,? FROM sessions JOIN presentations current ON current.id=? WHERE sessions.id=? AND sessions.participant_id=?`,b.eventId,pr.id,sid,p.id,b.attemptNumber,JSON.stringify(b.response),Number(correct),grade.score,b.submittedAt,b.elapsedMs,b.activeMs,Number(previous.n>0&&s.mode==='practice'),validity,Number(eligible),digest,pr.id,sid,p.id).run();}
  catch(error){
   const raced=await query(env.DB,'SELECT * FROM responses WHERE event_id=?',b.eventId).first();
   if(!raced){const duplicate=await query(env.DB,'SELECT event_id FROM responses WHERE presentation_id=? AND attempt_number=?',pr.id,b.attemptNumber).first();if(duplicate)return archive('attempt-sequence-conflict');throw error;}
   if(raced.participant_id!==p.id||raced.session_id!==sid||raced.payload_sha256!==digest)return archive('idempotency-conflict');
   return {eventId:b.eventId,receipt:raced.server_received_at,persisted:true,validity:raced.validity,countsTowardResult:!['late-receipt','after-completion'].includes(raced.validity),...(s.mode==='practice'?feedback(item,b.response):{})};
  }
  requireValue(inserted.meta.changes===1,'Session ownership changed. Sign in again to save this queued answer.',401);
  const stored=await query(env.DB,'SELECT validity,server_received_at FROM responses WHERE event_id=?',b.eventId).first();
  return {eventId:b.eventId,receipt:stored.server_received_at,persisted:true,validity:stored.validity,countsTowardResult:!['late-receipt','after-completion'].includes(stored.validity),...(s.mode==='practice'?feedback(item,b.response):{})};
 }
 requireValue(!s.completed_at,'Session is complete.',409);requireValue(s.expires_at>iso(),'Session expired.',409);
 if(action==='hint'){
  requireValue(s.mode==='practice','Hints are unavailable during assessments.',403);const b=await body(request);
  const pr=await query(env.DB,'SELECT * FROM presentations WHERE id=? AND session_id=?',b.presentationId,sid).first();requireValue(pr,'Presentation not found.',404);
  const hint=hintFor(JSON.parse(pr.item_snapshot_json)),hintId=uuid();
  const saved=await query(env.DB,`INSERT INTO hint_events (id,presentation_id,hint_version,hint_scope,hint_text) SELECT ?,p.id,?,?,? FROM presentations p JOIN sessions s ON s.id=p.session_id WHERE p.id=? AND s.participant_id=? AND s.mode='practice' AND s.completed_at IS NULL AND s.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')`,hintId,hint.hintVersion,hint.hintScope,hint.hint,pr.id,p.id).run();
  requireValue(saved.meta.changes===1,'Session changed before the hint could be recorded.',409);
  return {...hint,hintId};
 }
 if(action==='next'){
  const current=await query(env.DB,'SELECT * FROM presentations WHERE session_id=? ORDER BY sequence DESC LIMIT 1',sid).first();
  if(current){const answered=await query(env.DB,'SELECT event_id FROM responses WHERE presentation_id=? LIMIT 1',current.id).first();if(!answered)return {presentationId:current.id,item:publicItem(JSON.parse(current.item_snapshot_json)),sequence:current.sequence};}
  // Continue with the immutable bank selected when the session was created.
  if(s.bank_version===BANK_VERSION)await ensureCurrentBank(env.DB);
  const sessionBank=await archivedBank(env.DB,s.bank_version,s.course);
  const length=s.mode==='assessment'?s.target_count:100;
  if((current?.sequence??0)>=length)return {done:true,reason:'session-length'};
  const state=await stateFor(env,p),exposed=s.mode==='assessment'?await all(env.DB,'SELECT DISTINCT pr.family_id FROM presentations pr JOIN sessions owner ON owner.id=pr.session_id WHERE owner.participant_id=? AND owner.course=?',p.id,s.course):[],selected=selectItem(sessionBank,state,{course:s.course,mode:s.mode,unit:s.unit_filter,topic:s.topic_filter,sessionId:sid,exposedFamilies:exposed.map(r=>r.family_id)});if(!selected)return {done:true,reason:'eligible-bank-exhausted'};
  const {item,selection,parameters}=selected,id=uuid(),sequence=(current?.sequence??0)+1;
  try{const inserted=await query(env.DB,`INSERT INTO presentations (id,session_id,item_id,item_version,family_id,topic,unit,presented_at,selection_probability,selection_pool_size,selection_engine_version,model_version,first_family_exposure,item_snapshot_json,sequence,measurement_parameters_json) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN EXISTS (SELECT 1 FROM presentations old JOIN sessions owner ON owner.id=old.session_id WHERE owner.participant_id=? AND old.family_id=? AND owner.course=?) THEN 0 ELSE 1 END,?,?,? FROM sessions target WHERE target.id=? AND target.participant_id=? AND target.completed_at IS NULL AND target.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')`,id,sid,item.id,item.version,item.family,item.topic,item.unit,iso(),selection.probability,selection.eligibleItems,selection.engineVersion,selection.modelVersion,p.id,item.family,s.course,JSON.stringify(item),sequence,JSON.stringify(parameters),sid,p.id).run();requireValue(inserted.meta.changes===1,'Session is no longer available for new questions.',409);}
  catch(error){if(error instanceof HttpError)throw error;const raced=await query(env.DB,'SELECT * FROM presentations WHERE session_id=? AND sequence=?',sid,sequence).first();if(!raced)throw error;return {presentationId:raced.id,item:publicItem(JSON.parse(raced.item_snapshot_json)),sequence:raced.sequence};}
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
