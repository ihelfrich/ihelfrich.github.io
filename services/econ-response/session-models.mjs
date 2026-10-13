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
