import {iso,uuid,query,all,requireValue,HttpError} from './common.mjs';
import {BANK_VERSION,courses,buildBank} from '../../src/lib/econ-practice/index.mjs';
const bank=buildBank();
export async function createAssignment(env,instructor,b){
 requireValue(typeof b.title==='string'&&b.title.trim().length>0&&b.title.length<=160,'Provide an assignment title.');requireValue(courses[b.course],'Unknown course.');
 requireValue(Number.isInteger(b.unit??0)&&(b.unit??0)>=0&&(b.unit??0)<=6,'Invalid unit.');
 requireValue(typeof (b.topic??'')==='string','Invalid topic.');
 requireValue(Number.isInteger(b.itemCount)&&b.itemCount>=6&&b.itemCount<=48,'Use 6–48 items.');requireValue(Number.isInteger(b.maxAttempts)&&b.maxAttempts>=1&&b.maxAttempts<=10,'Use 1–10 attempts.');
 requireValue(Number.isFinite(Date.parse(b.opensAt))&&Number.isFinite(Date.parse(b.closesAt))&&Date.parse(b.closesAt)>Date.parse(b.opensAt),'Provide valid opening and closing times.');
 const eligible=bank.filter(q=>q.course===b.course&&(!b.unit||q.unit===b.unit)&&(!b.topic||q.topic===b.topic));requireValue(new Set(eligible.map(q=>q.family)).size>=b.itemCount,'Not enough distinct question families in that coverage.');
 requireValue(Array.isArray(b.participantIds)&&b.participantIds.length>0&&b.participantIds.length<=100,'Assign to 1–100 signed-in student profiles.');const students=[...new Set(b.participantIds)];
 for(const id of students){const p=await query(env.DB,'SELECT id FROM participants WHERE id=? AND identity_kind=? AND disabled_at IS NULL',id,'account').first();requireValue(p,'Every recipient must be a current signed-in student profile.');}
 const id=uuid();await env.DB.batch([
  query(env.DB,'INSERT INTO assignments (id,title,course,bank_version,unit_filter,topic_filter,item_count,max_attempts,opens_at,closes_at,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',id,b.title.trim(),b.course,BANK_VERSION,b.unit??0,b.topic??'',b.itemCount,b.maxAttempts,new Date(b.opensAt).toISOString(),new Date(b.closesAt).toISOString(),iso(),instructor.id),
  ...students.map(p=>query(env.DB,'INSERT INTO assignment_members VALUES (?,?)',id,p)),
  query(env.DB,'INSERT INTO audit_log VALUES (?,?,?,?,?,?)',uuid(),iso(),instructor.id,'assignment-created',id,JSON.stringify({participants:students.length,course:b.course,itemCount:b.itemCount}))
 ]);return {assignmentId:id};
}
export async function listAssignments(env,p){return {assignments:await all(env.DB,`SELECT a.*, (SELECT COUNT(*) FROM sessions s WHERE s.assignment_id=a.id AND s.participant_id=?) AS attempts FROM assignments a JOIN assignment_members m ON m.assignment_id=a.id WHERE m.participant_id=? AND a.disabled_at IS NULL ORDER BY a.closes_at LIMIT 101`,p.id,p.id)};}
export async function startAssignment(env,p,b){
 requireValue(p.identity_kind==='account','Assigned assessments require a verified account.',403);
 requireValue(typeof b.requestId==='string'&&/^[a-f0-9-]{36}$/.test(b.requestId),'Provide a session request ID.');
 const existing=await query(env.DB,'SELECT * FROM sessions WHERE id=?',b.requestId).first();if(existing){requireValue(existing.participant_id===p.id&&existing.assignment_id===b.assignmentId,'Session request conflict.',409);return {sessionId:existing.id,course:existing.course,mode:existing.mode,bankVersion:existing.bank_version,assignmentId:existing.assignment_id};}
 const a=await query(env.DB,`SELECT a.* FROM assignments a JOIN assignment_members m ON m.assignment_id=a.id WHERE a.id=? AND m.participant_id=? AND a.disabled_at IS NULL`,b.assignmentId,p.id).first();requireValue(a,'Assignment not available to this profile.',404);
 requireValue(a.bank_version===BANK_VERSION,'This assignment needs an instructor update for the current bank version.',409);requireValue(a.opens_at<=iso()&&a.closes_at>iso(),'The assignment is not open.',403);
 // The unique assignment/participant/attempt index serializes concurrent slot claims.
 const previous=await query(env.DB,'SELECT COUNT(*) AS n FROM sessions WHERE assignment_id=? AND participant_id=?',a.id,p.id).first();requireValue(previous.n<a.max_attempts,'No assignment attempts remain.',409);
 try{await query(env.DB,'INSERT INTO sessions (id,participant_id,course,mode,bank_version,started_at,token_hash,expires_at,assigned,unit_filter,topic_filter,assignment_id,assignment_attempt,target_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',b.requestId,p.id,a.course,'assessment',a.bank_version,iso(),'participant-auth',a.closes_at,1,a.unit_filter,a.topic_filter,a.id,previous.n+1,a.item_count).run();}catch(error){const raced=await query(env.DB,'SELECT * FROM sessions WHERE id=? AND participant_id=? AND assignment_id=?',b.requestId,p.id,a.id).first();if(!raced)throw new HttpError(409,'An assignment attempt was started concurrently. Reload your assignments.');}
 return {sessionId:b.requestId,course:a.course,mode:'assessment',bankVersion:a.bank_version,assignmentId:a.id};
}
export async function assignmentReport(env,id){
 const a=await query(env.DB,'SELECT * FROM assignments WHERE id=?',id).first();requireValue(a,'Assignment not found.',404);
 const students=await all(env.DB,`SELECT p.id,p.verified_email FROM participants p JOIN assignment_members m ON m.participant_id=p.id WHERE m.assignment_id=? ORDER BY p.id`,id);
 const sessions=await all(env.DB,`SELECT s.id,s.participant_id,s.assignment_attempt,s.started_at,s.completed_at,s.target_count,COUNT(r.event_id) AS received,COALESCE(SUM(CASE WHEN r.validity NOT IN ('late-receipt','after-completion') THEN 1 ELSE 0 END),0) AS answered,COALESCE(SUM(CASE WHEN r.validity NOT IN ('late-receipt','after-completion') THEN r.correct ELSE 0 END),0) AS correct FROM sessions s LEFT JOIN responses r ON r.session_id=s.id AND r.attempt_number=1 WHERE s.assignment_id=? GROUP BY s.id ORDER BY s.started_at`,id);
 return {assignment:a,students,sessions,interpretation:'Observed first-attempt counts; no standardized score or mastery claim.'};
}
