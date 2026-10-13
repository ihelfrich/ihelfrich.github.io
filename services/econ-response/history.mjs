import {newState,createAnswerRecorder} from '../../src/lib/econ-practice/adaptive.mjs';
import {all,query,requireValue} from './common.mjs';
import {validateParameterSnapshot} from '../../src/lib/econ-practice/irt.mjs';

export function replayParameters(row,item){
 if(row.measurement_parameters_json!==null){
  const parameters=validateParameterSnapshot(JSON.parse(row.measurement_parameters_json));
  requireValue(parameters.modelVersion===row.model_version,'Stored measurement model does not match its parameter snapshot.',503);
  return parameters;
 }
 // Only this known legacy model is reconstructible without a stored parameter record.
 requireValue(row.model_version==='author-seeded-rasch-v1','Historical measurement parameters are unavailable.',503);
 return validateParameterSnapshot({a:1,b:item.difficulty-2,c:0,d:1,status:'provisional',modelVersion:'author-seeded-rasch-v1'});
}

// Bound each read, not the participant's lifetime history. A high-water mark
// prevents concurrent new receipts from extending this replay indefinitely.
// Course scope retains lifetime topic/exposure evidence for selection. Session
// scope is sufficient for occasion reports because eligibility is persisted.
// Course scope still grows with within-course lifetime history; never truncate it.
export async function replayHistory(env,participantId,{course,sessionId}={}){
 const filters=[],scopeArgs=[];
 if(course!==undefined){requireValue(typeof course==='string'&&course.length>0,'Invalid history course scope.');filters.push('s.course=?');scopeArgs.push(course);}
 if(sessionId!==undefined){requireValue(typeof sessionId==='string'&&sessionId.length>0,'Invalid history session scope.');filters.push('r.session_id=?');scopeArgs.push(sessionId);}
 const scope=filters.length?` AND ${filters.join(' AND ')}`:'';
 const {last}=await query(env.DB,scope?`SELECT COALESCE(MAX(r.ledger_sequence),0) AS last FROM responses r JOIN sessions s ON s.id=r.session_id WHERE r.participant_id=?${scope}`:'SELECT COALESCE(MAX(ledger_sequence),0) AS last FROM responses WHERE participant_id=?',participantId,...scopeArgs).first();
 const state=newState(),record=createAnswerRecorder(state);let after=0;
 for(;;){
  const rows=await all(env.DB,`SELECT r.*,p.item_snapshot_json,p.model_version,p.measurement_parameters_json,p.first_family_exposure,p.session_id AS presentation_session_id,s.mode FROM responses r JOIN presentations p ON p.id=r.presentation_id JOIN sessions s ON s.id=r.session_id WHERE r.participant_id=?${scope} AND r.attempt_number=1 AND r.ledger_sequence>? AND r.ledger_sequence<=? ORDER BY r.ledger_sequence LIMIT 500`,participantId,...scopeArgs,after,last);
  if(!rows.length)break;
  for(const r of rows){
   if(['late-receipt','after-completion'].includes(r.validity))continue;
   const item=JSON.parse(r.item_snapshot_json);
   const persistedPresentationEligible=r.calibration_eligible===1;
   if(persistedPresentationEligible)requireValue(r.first_family_exposure===1&&r.presentation_session_id===r.session_id&&r.attempt_number===1&&r.mode==='assessment'&&r.hints_used===0&&r.feedback_before_answer===0&&r.validity==='valid'&&item.format!=='multipart','Stored measurement eligibility has inconsistent presentation provenance.',503);
   record(item,{parameterSnapshot:replayParameters(r,item),response:JSON.parse(r.raw_answer_json),at:Date.parse(r.server_received_at),mode:r.mode,hints:r.hints_used,sessionId:r.session_id,eventId:r.event_id,measurementEligible:persistedPresentationEligible,persistedPresentationEligible});
  }
  after=rows.at(-1).ledger_sequence;
  if(after>=last)break;
 }
 return state;
}
