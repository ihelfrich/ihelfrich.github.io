import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function validateCandidate(report,{model='2PL',bankVersion,review}={}){
 const issues=[],candidate=report.models?.[model];
 if(report.synthetic)issues.push('Synthetic data cannot authorize an operational calibration.');
 if(report.bankVersion!==bankVersion)issues.push('Bank version mismatch.');
 if(!report.sourceSHA256)issues.push('Missing source data hash.');
 if(!candidate)issues.push('Selected model unavailable.');
 else{
  if(!candidate.converged)issues.push('Model did not converge.');
  if(!candidate.finiteParameters||!candidate.positiveFiniteCovarianceDiagonal)issues.push('Parameter or covariance diagnostics failed.');
  if(!candidate.holdout?.predictions)issues.push('No held-out predictions.');
  if(!candidate.items||!Object.keys(candidate.items).length)issues.push('No item parameters.');
  for(const [id,p] of Object.entries(candidate.items??{}))if(![p.a,p.b,p.c,p.d].every(Number.isFinite)||p.a<=0||p.c<0||p.d>1||p.c>=p.d)issues.push(`Invalid parameters: ${id}`);
 }
 const required=['content','dimensionality','localDependence','itemFit','fairness','catSimulation','linking','scoreInterpretation'];
 for(const key of required){const gate=review?.gates?.[key];if(!gate||!['accepted','not-applicable-with-rationale'].includes(gate.decision)||!gate.evidence||!gate.rationale)issues.push(`Missing substantive review: ${key}`);}
 if(!review?.reviewer||!review?.reviewedAt||review?.sourceSHA256!==report.sourceSHA256)issues.push('Review must identify a reviewer, time and matching data hash.');
 return {readyForInstructorApproval:issues.length===0,issues,status:'candidate',note:'This validator never approves or activates a model. Instructor approval is a separate authenticated action.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [file,version,reviewFile]=process.argv.slice(2);const result=validateCandidate(JSON.parse(fs.readFileSync(file)),{bankVersion:version,review:reviewFile?JSON.parse(fs.readFileSync(reviewFile)):null});console.log(JSON.stringify(result,null,2));if(!result.readyForInstructorApproval)process.exitCode=2;}
