import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {canonicalJSON} from '../../src/lib/econ-practice/canonical-json.mjs';
export const reportHash=report=>createHash('sha256').update(canonicalJSON(report)).digest('hex');
import {validateCandidateContent} from '../../src/lib/econ-practice/calibration-validation.mjs';
export function validateCandidate(report,options={}){
 let reportSHA256;try{reportSHA256=reportHash(report);}catch{}
 return validateCandidateContent(report,{...options,reportSHA256});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [file,version,reviewFile]=process.argv.slice(2);const result=validateCandidate(JSON.parse(fs.readFileSync(file)),{bankVersion:version,review:reviewFile?JSON.parse(fs.readFileSync(reviewFile)):null});console.log(JSON.stringify(result,null,2));if(!result.readyForInstructorApproval)process.exitCode=2;}
