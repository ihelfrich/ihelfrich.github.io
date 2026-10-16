import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {canonicalJSON} from '../../src/lib/econ-practice/canonical-json.mjs';
import {buildBank,BANK_VERSION} from '../../src/lib/econ-practice/index.mjs';
import {validateCandidate,reportHash} from './validate-candidate.mjs';

export function packageCandidate(report,review,{bank=buildBank(),bankVersion=BANK_VERSION,model='2PL'}={}){
 const validation=validateCandidate(report,{review,model,bankVersion});
 if(!validation.readyForInstructorApproval)throw new Error(`Candidate cannot be packaged: ${validation.issues.join(' ')}`);
 const index=new Map(bank.map(item=>[item.id,item]));
 if(index.size!==bank.length)throw new Error('Bank contains duplicate item IDs.');
 const parameters=report.models[model].items,bankItemHashes={};
 for(const id of Object.keys(parameters).sort()){
  const item=index.get(id);
  if(!item||item.version!==bankVersion||item.course!==report.course||item.unit!==report.unit)throw new Error(`Item is outside the declared bank/course/unit: ${id}`);
  if(!['numeric','choice'].includes(item.format))throw new Error(`Item is not supported by binary calibration: ${id}`);
  bankItemHashes[id]=reportHash(item);
 }
 const content={schemaVersion:1,status:'candidate',hashFormat:'sorted-json-sha256-v1',bankVersion,course:report.course,unit:report.unit,model,sourceSHA256:report.sourceSHA256,reportSHA256:validation.reportSHA256,reviewSHA256:reportHash(review),bankItemHashes,parameters,report,review};
 // Copy through JSON so later mutations to caller-owned objects cannot change the package.
 return JSON.parse(canonicalJSON({id:`calibration-${reportHash(content)}`,...content}));
}

export function verifyPackage(artifact,options){
 const expected=packageCandidate(artifact.report,artifact.review,{...options,model:artifact.model});
 if(canonicalJSON(expected)!==canonicalJSON(artifact))throw new Error('Calibration package content or identity does not match.');
 return artifact.id;
}

export function writePackage(artifact,directory,options){
 verifyPackage(artifact,options);
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const destination=path.join(directory,`${artifact.id}.json`),encoded=canonicalJSON(artifact)+'\n';
 const temporary=path.join(directory,`.candidate-${randomUUID()}.tmp`);
 try{
  const fd=fs.openSync(temporary,'wx',0o600);
  try{fs.writeFileSync(fd,encoded);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try{fs.linkSync(temporary,destination);}catch(error){
   if(error.code!=='EEXIST')throw error;
   if(fs.readFileSync(destination,'utf8')!==encoded)throw new Error('Existing package differs; it has not been overwritten.');
  }
 }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return destination;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [reportFile,reviewFile,model='2PL']=process.argv.slice(2);
 if(!reportFile||!reviewFile)throw new Error('Usage: node package-candidate.mjs REPORT.json REVIEW.json [1PL|2PL]');
 const artifact=packageCandidate(JSON.parse(fs.readFileSync(reportFile,'utf8')),JSON.parse(fs.readFileSync(reviewFile,'utf8')),{model});
 const file=writePackage(artifact,path.resolve('.local/econ-calibration/packages'));
 console.log(JSON.stringify({id:artifact.id,status:artifact.status,file,note:'Packaged for review only. No model has been approved or activated.'}));
}
