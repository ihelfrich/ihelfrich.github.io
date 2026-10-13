import {canonicalJSON} from '../../src/lib/econ-practice/canonical-json.mjs';
import {registerModel} from './model-registry.mjs';
import {hash,query,requireValue,iso,uuid,HttpError} from './common.mjs';

export async function latestModelRelease(env,{bankVersion,course,unit}){
 return query(env.DB,'SELECT * FROM model_releases WHERE bank_version=? AND course=? AND unit=? ORDER BY revision DESC LIMIT 1',bankVersion,course,unit).first();
}
// Records an explicit release decision. Session creation must separately pin this
// history atomically; recording a decision never rewrites existing session pins.
export async function recordModelRelease(env,instructor,input){
 requireValue(input?.confirmRelease===true,'Explicit release confirmation is required.');
 const {bankVersion,course,unit,approvalId,expectedReleaseId}=input;
 requireValue(typeof bankVersion==='string'&&bankVersion.length>0&&typeof course==='string'&&course.length>0&&Number.isInteger(unit)&&unit>=1&&unit<=6,'Provide a valid release scope.');
 requireValue(Object.hasOwn(input,'expectedReleaseId')&&(expectedReleaseId===null||typeof expectedReleaseId==='string'),'Provide the release being replaced, or null for the first release.');
 requireValue(Object.hasOwn(input,'approvalId')&&(approvalId===null||typeof approvalId==='string'),'Provide an approval ID, or null to withdraw calibrated use.');
 requireValue(typeof input.rationale==='string'&&input.rationale.trim().length>0&&input.rationale.trim().length<=2000,'Provide a release rationale of 1–2000 characters.');
 const rationale=input.rationale.trim(),scope={bankVersion,course,unit};
 const id='release-'+await hash(canonicalJSON({...scope,approvalId,expectedReleaseId,rationale,actor:instructor.id}));
 const existing=await query(env.DB,'SELECT * FROM model_releases WHERE id=?',id).first();
 if(existing)return {release:existing,replayed:true};
 const current=await latestModelRelease(env,scope);
 requireValue((current?.id??null)===expectedReleaseId,'Release changed; reload before retrying.',409);
 requireValue(approvalId!==null||current?.approval_id,'There is no active release to withdraw.');
 if(approvalId!==null){
  const row=await query(env.DB,'SELECT p.* FROM model_approvals a JOIN model_packages p ON p.id=a.package_id WHERE a.id=?',approvalId).first();
  requireValue(row,'Approved model not found.',404);
  requireValue(row.bank_version===bankVersion&&row.course===course&&row.unit===unit,'Release approval scope mismatch.');
  await registerModel(env,instructor,JSON.parse(row.artifact_json));
 }
 const at=iso();
 try{await env.DB.batch([
  query(env.DB,'INSERT INTO model_releases (id,bank_version,course,unit,approval_id,previous_id,revision,released_at,released_by,rationale) VALUES (?,?,?,?,?,?,?,?,?,?)',id,bankVersion,course,unit,approvalId,expectedReleaseId,(current?.revision??0)+1,at,instructor.id,rationale),
  query(env.DB,"INSERT INTO audit_log (id,at,actor,action,target,details_json) VALUES (?,?,?,'model-release-recorded',?,?)",uuid(),at,instructor.id,id,JSON.stringify({...scope,approvalId,expectedReleaseId,rationale}))
 ]);}catch(error){
  const retry=await query(env.DB,'SELECT * FROM model_releases WHERE id=?',id).first();
  if(retry)return {release:retry,replayed:true};
  if(((await latestModelRelease(env,scope))?.id??null)!==expectedReleaseId)throw new HttpError(409,'Release changed; reload before retrying.');
  throw error;
 }
 return {release:await query(env.DB,'SELECT * FROM model_releases WHERE id=?',id).first(),replayed:false};
}
