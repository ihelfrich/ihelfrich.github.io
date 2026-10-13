import {canonicalJSON} from '../../src/lib/econ-practice/canonical-json.mjs';
import {validateCandidateContent} from '../../src/lib/econ-practice/calibration-validation.mjs';
import {archivedBank,ensureCurrentBank} from './bank-archive.mjs';
import {BANK_VERSION} from '../../src/lib/econ-practice/index.mjs';
import {hash,query,requireValue,iso,uuid} from './common.mjs';
const digest=value=>hash(canonicalJSON(value));
export async function registerModel(env,instructor,artifact){
 requireValue(artifact&&typeof artifact==='object'&&artifact.report&&artifact.review,'Provide a complete candidate package.');
 const {report,review,model,bankVersion}=artifact;
 let reportSHA256;try{reportSHA256=await digest(report);}catch{requireValue(false,'Invalid candidate JSON.');}
 const validation=validateCandidateContent(report,{model,bankVersion,review,reportSHA256});
 requireValue(validation.readyForInstructorApproval,`Candidate failed validation: ${validation.issues.join(' ')}`);
 if(bankVersion===BANK_VERSION)await ensureCurrentBank(env.DB);
 const bank=await archivedBank(env.DB,bankVersion,report.course),byId=new Map(bank.map(q=>[q.id,q]));
 const parameters=report.models[model].items,bankItemHashes={};
 for(const id of Object.keys(parameters).sort()){
  const item=byId.get(id);requireValue(item&&item.unit===report.unit&&item.version===bankVersion&&['numeric','choice'].includes(item.format),`Item is outside the supported bank/course/unit: ${id}`);
  bankItemHashes[id]=await digest(item);
 }
 const content={schemaVersion:1,status:'candidate',hashFormat:'sorted-json-sha256-v1',bankVersion,course:report.course,unit:report.unit,model,sourceSHA256:report.sourceSHA256,reportSHA256,reviewSHA256:await digest(review),bankItemHashes,parameters,report,review};
 const expected={id:`calibration-${await digest(content)}`,...content};
 requireValue(canonicalJSON(expected)===canonicalJSON(artifact),'Package identity or content does not match the reviewed report and archived bank.');
 const encoded=canonicalJSON(expected),at=iso();
 // Registration and the first registration audit commit together. Retries do not duplicate either.
 await env.DB.batch([
  query(env.DB,"INSERT INTO audit_log (id,at,actor,action,target,details_json) SELECT ?,?,?,'model-package-registered',?,? WHERE NOT EXISTS (SELECT 1 FROM model_packages WHERE id=?)",uuid(),at,instructor.id,expected.id,JSON.stringify({bankVersion,course:report.course,unit:report.unit,model}),expected.id),
  query(env.DB,'INSERT INTO model_packages (id,bank_version,course,unit,model,artifact_json,created_at,created_by) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',expected.id,bankVersion,report.course,report.unit,model,encoded,at,instructor.id)
 ]);
 const stored=await query(env.DB,'SELECT artifact_json FROM model_packages WHERE id=?',expected.id).first();
 requireValue(stored?.artifact_json===encoded,'Existing model package differs; nothing was overwritten.',409);
 return {id:expected.id,status:'candidate',registered:true,activated:false};
}

export async function approveModel(env,instructor,packageId,input){
 requireValue(input?.confirmApproval===true,'Explicit approval confirmation is required.');
 requireValue(typeof input.rationale==='string'&&input.rationale.trim().length>0&&input.rationale.trim().length<=2000,'Provide an approval rationale of 1–2000 characters.');
 const rationale=input.rationale.trim();
 const record=await query(env.DB,'SELECT artifact_json FROM model_packages WHERE id=?',packageId).first();
 requireValue(record,'Model package not found.',404);
 const artifact=JSON.parse(record.artifact_json);
 // Re-run scientific-review and archived-content integrity gates before approval.
 await registerModel(env,instructor,artifact);
 const id=`approval-${await digest({packageId,approvedBy:instructor.id,rationale})}`,at=iso();
 await env.DB.batch([
  query(env.DB,"INSERT INTO audit_log (id,at,actor,action,target,details_json) SELECT ?,?,?,'model-package-approved',?,? WHERE NOT EXISTS (SELECT 1 FROM model_approvals WHERE id=?)",uuid(),at,instructor.id,id,JSON.stringify({packageId,rationale}),id),
  query(env.DB,'INSERT INTO model_approvals (id,package_id,approved_at,approved_by,rationale) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING',id,packageId,at,instructor.id,rationale)
 ]);
 const approval=await query(env.DB,'SELECT * FROM model_approvals WHERE id=?',id).first();
 requireValue(approval?.package_id===packageId&&approval.approved_by===instructor.id&&approval.rationale===rationale,'Existing approval differs.',409);
 return {approvalId:id,packageId,status:'approved',approvedAt:approval.approved_at,activated:false};
}
