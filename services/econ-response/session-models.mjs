import {query,requireValue} from './common.mjs';
import {validateParameterSnapshot} from '../../src/lib/econ-practice/irt.mjs';

// Never consult current approvals when replaying an existing session.
export async function sessionModels(env,session){
 const pin=await query(env.DB,'SELECT * FROM session_model_pins WHERE session_id=?',session.id).first();
 if(!pin)return {}; // Legacy sessions remain explicitly provisional.
 requireValue(pin.bank_version===session.bank_version&&pin.course===session.course,'Pinned model scope does not match the session.',503);
 const approvals=JSON.parse(pin.approvals_json),models={};
 for(const [unit,approvalId] of Object.entries(approvals)){
  const row=await query(env.DB,'SELECT p.* FROM model_approvals a JOIN model_packages p ON p.id=a.package_id WHERE a.id=?',approvalId).first();
  requireValue(row&&row.bank_version===session.bank_version&&row.course===session.course&&String(row.unit)===unit,'Pinned model is unavailable or incompatible.',503);
  const artifact=JSON.parse(row.artifact_json);
  requireValue(artifact.id===row.id&&artifact.bankVersion===row.bank_version&&artifact.course===row.course&&artifact.unit===row.unit&&artifact.parameters&&Object.keys(artifact.parameters).length>0,'Pinned model content is incompatible.',503);
  for(const parameters of Object.values(artifact.parameters))validateParameterSnapshot({...parameters,status:'calibrated',modelVersion:row.id});
  models[unit]={id:row.id,approvalId,status:'approved',bankVersion:row.bank_version,course:row.course,unit:row.unit,items:artifact.parameters};
 }
 return models;
}

// Stable order makes the exact snapshot comparable inside the creation transaction.
const releaseMapSQL=`SELECT COALESCE(json_group_object(unit,approval_id),'{}') AS approvals FROM (
 SELECT r.unit,r.approval_id FROM model_releases r
 WHERE r.bank_version=? AND r.course=? AND r.approval_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM model_releases newer WHERE newer.bank_version=r.bank_version AND newer.course=r.course AND newer.unit=r.unit AND newer.revision>r.revision)
 ORDER BY r.unit
)`;
export async function prepareSessionModels(env,{bankVersion,course,unit=0,topic='',targetCount},bank){
 const snapshot=await query(env.DB,releaseMapSQL,bankVersion,course).first();
 const approvals=JSON.parse(snapshot.approvals),parameters={};
 const eligible=bank.filter(q=>q.course===course&&(!unit||q.unit===unit)&&(!topic||q.topic===topic));
 requireValue(eligible.length>0,'No questions match this assessment coverage.');
 for(const dimension of new Set(eligible.map(q=>q.unit))){
  if(!approvals[dimension])continue;
  const record=await query(env.DB,'SELECT p.artifact_json FROM model_approvals a JOIN model_packages p ON p.id=a.package_id WHERE a.id=?',approvals[dimension]).first();
  requireValue(record,'Released model is unavailable.',503);
  const artifact=JSON.parse(record.artifact_json);parameters[dimension]=artifact.parameters;
  for(const p of Object.values(artifact.parameters))validateParameterSnapshot({...p,status:'calibrated',modelVersion:artifact.id});
 }
 const pool=eligible.filter(q=>!parameters[q.unit]||Object.hasOwn(parameters[q.unit],q.id));
 for(const dimension of new Set(eligible.map(q=>q.unit)))requireValue(pool.some(q=>q.unit===dimension),'The released model does not cover every requested unit. Ask the instructor to review the calibration release.',409);
 requireValue(new Set(pool.map(q=>q.family)).size>=targetCount,'The released model has too few distinct question families for this assessment. Ask the instructor to review its coverage.',409);
 return {approvalsJSON:snapshot.approvals,bankVersion,course};
}
export function sessionModelPinStatement(env,sessionId,plan,at){
 // An intervening release makes JSON validation fail, rolling back session + pin.
 // Never leave an accepted assessment with an unvalidated or missing pin.
 return query(env.DB,`INSERT INTO session_model_pins (session_id,bank_version,course,approvals_json,pinned_at)
 VALUES (?,?,?,CASE WHEN (${releaseMapSQL})=? THEN ? ELSE '[]' END,?)`,sessionId,plan.bankVersion,plan.course,plan.bankVersion,plan.course,plan.approvalsJSON,plan.approvalsJSON,at);
}
