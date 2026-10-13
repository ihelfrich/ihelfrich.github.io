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
export async function replayHistory(env,participantId){
 const {last}=await query(env.DB,'SELECT COALESCE(MAX(ledger_sequence),0) AS last FROM responses WHERE participant_id=?',participantId).first();
 const state=newState(),record=createAnswerRecorder(state);let after=0;
 for(;;){
  const rows=await all(env.DB,`SELECT r.*,p.item_snapshot_json,p.model_version,p.measurement_parameters_json,s.mode FROM responses r JOIN presentations p ON p.id=r.presentation_id JOIN sessions s ON s.id=r.session_id WHERE r.participant_id=? AND r.attempt_number=1 AND r.ledger_sequence>? AND r.ledger_sequence<=? ORDER BY r.ledger_sequence LIMIT 500`,participantId,after,last);
  if(!rows.length)break;
  for(const r of rows){
   if(['late-receipt','after-completion'].includes(r.validity))continue;
   const item=JSON.parse(r.item_snapshot_json);
   record(item,{parameterSnapshot:replayParameters(r,item),response:JSON.parse(r.raw_answer_json),at:Date.parse(r.server_received_at),mode:r.mode,hints:r.hints_used,sessionId:r.session_id,eventId:r.event_id,measurementEligible:r.calibration_eligible===1});
  }
  after=rows.at(-1).ledger_sequence;
  if(after>=last)break;
 }
 return state;
}
