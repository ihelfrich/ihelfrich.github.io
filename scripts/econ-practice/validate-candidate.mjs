import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {canonicalJSON} from '../../src/lib/econ-practice/canonical-json.mjs';
export const reportHash=report=>createHash('sha256').update(canonicalJSON(report)).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
export function validateCandidate(report,{model='2PL',bankVersion,review}={}){
 const issues=[];
 if(!object(report)){issues.push('Report must be a JSON object.');report={};}
 const candidate=object(report.models)?report.models[model]:undefined;
 let reportSHA256;try{reportSHA256=reportHash(report);}catch{issues.push('Report is not a finite JSON artifact.');}
 if(report.synthetic===true)issues.push('Synthetic data cannot authorize an operational calibration.');
 else if(report.synthetic!==false)issues.push('Explicit non-synthetic provenance is required.');
 if(!['1PL','2PL'].includes(model))issues.push('Unsupported calibration model.');
 if(!text(bankVersion)||report.bankVersion!==bankVersion)issues.push('Bank version mismatch.');
 if(typeof report.sourceSHA256!=='string'||!/^[a-f0-9]{64}$/.test(report.sourceSHA256))issues.push('Missing or invalid source data hash.');
 if(!['ap-micro','ap-macro','college-micro','college-macro'].includes(report.course)||!Number.isInteger(report.unit)||report.unit<1||report.unit>6)issues.push('Missing or invalid calibration course/unit scope.');
 if(!object(candidate))issues.push('Selected model unavailable.');
 else{
  if(candidate.converged!==true)issues.push('Model convergence is not explicitly confirmed.');
  if(candidate.finiteParameters!==true||candidate.positiveFiniteCovarianceDiagonal!==true)issues.push('Parameter or covariance diagnostics failed.');
  if(!Number.isSafeInteger(candidate.holdout?.predictions)||candidate.holdout.predictions<=0)issues.push('No valid positive held-out prediction count.');
  if(!object(candidate.items)||!Object.keys(candidate.items).length)issues.push('No item parameters.');
  for(const [id,p] of Object.entries(object(candidate.items)?candidate.items:{}))if(!text(id)||!object(p)||![p.a,p.b,p.c,p.d].every(Number.isFinite)||p.a<=0||p.c!==0||p.d!==1)issues.push(`Invalid 1PL/2PL parameters: ${id}`);
 }
 const required=['content','dimensionality','localDependence','itemFit','fairness','catSimulation','linking','scoreInterpretation'];
 for(const key of required){const gate=review?.gates?.[key];if(!object(gate)||!['accepted','not-applicable-with-rationale'].includes(gate.decision)||!text(gate.evidence)||!text(gate.rationale))issues.push(`Missing substantive review: ${key}`);}
 if(typeof review?.reviewer!=='string'||!review.reviewer.trim()||typeof review?.reviewedAt!=='string'||!Number.isFinite(Date.parse(review.reviewedAt))||review?.sourceSHA256!==report.sourceSHA256)issues.push('Review must identify a reviewer, valid time and matching data hash.');
 if(!reportSHA256||review?.reportSHA256!==reportSHA256)issues.push('Review must match the exact candidate report hash.');
 if(review?.model!==model||review?.bankVersion!==bankVersion||review?.course!==report.course||review?.unit!==report.unit)issues.push('Review must match the selected model, bank version and course/unit scope.');
 return {readyForInstructorApproval:issues.length===0,issues,status:'candidate',reportSHA256:reportSHA256??null,hashFormat:'sorted-json-sha256-v1',note:'This validator never approves or activates a model. Instructor approval is a separate authenticated action.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [file,version,reviewFile]=process.argv.slice(2);const result=validateCandidate(JSON.parse(fs.readFileSync(file)),{bankVersion:version,review:reviewFile?JSON.parse(fs.readFileSync(reviewFile)):null});console.log(JSON.stringify(result,null,2));if(!result.readyForInstructorApproval)process.exitCode=2;}
