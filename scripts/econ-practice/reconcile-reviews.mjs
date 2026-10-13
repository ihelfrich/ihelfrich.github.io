import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {buildBank,BANK_VERSION} from '../../src/lib/econ-practice/index.mjs';
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const content=items=>items.map(({version,...item})=>item);
const sources=[
 ['61db1aa1','ap-micro-core-units-1-2.json',false],
 ['1295ad35','ap-micro-core-units-3-6.json',false],
 ['437e7897','ap-micro-concepts-middle.json',true],
 ['45f9b6e4','ap-micro-concepts-remainder.json',true],
 ['1aa241df','ap-macro-concepts-additional.json',true,'ap-macro'],
 ['d3f541ee','ap-macro-core.json',false,'ap-macro'],
 ['34da9a1f','college-micro-concepts.json',true,'college-micro'],
 ['34da9a1f','college-macro-concepts.json',true,'college-macro'],
 ['9bbc62f8','ap-micro-multipart.json',false,'ap-micro'],
 ['865562e3','college-micro-numeric.json',false,'college-micro'],
 ['9435b034','college-macro-numeric.json',false,'college-macro']
];
const current=buildBank(),evidence=new Map(),errors=[];
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'econ-review-'));
try{
 for(const [commit,file,single,course='ap-micro'] of sources){
  const review=JSON.parse(fs.readFileSync(`docs/econ-practice/audits/${file}`,'utf8'));
  const directory=path.join(scratch,commit);fs.mkdirSync(directory,{recursive:true});
  const files=execFileSync('git',['ls-tree','--name-only',commit,'src/lib/econ-practice/'],{encoding:'utf8',timeout:10000}).trim().split('\n');
  for(const source of files.filter(f=>f.endsWith('.mjs')))fs.writeFileSync(path.join(directory,path.basename(source)),execFileSync('git',['show',`${commit}:${source}`],{timeout:10000}));
  const historical=await import(pathToFileURL(path.join(directory,'index.mjs')).href);const oldBank=historical.buildBank();
  if(historical.BANK_VERSION!==review.bankVersion)throw Error(`Review source version mismatch: ${file}`);
  for(const entry of review.entries){
   const old=oldBank.filter(q=>q.course===course&&q.family===entry.family),now=current.filter(q=>q.course===course&&q.family===entry.family);
   if(!old.length||!now.length){errors.push(`Missing historical or current family: ${file}/${entry.family}`);continue;}
   if(single&&old.length!==1){errors.push(`Single-item review has multiple variants: ${file}/${entry.family}`);continue;}
   if(evidence.has(`${course}:${entry.family}`)){errors.push(`Duplicate review evidence: ${file}/${entry.family}`);continue;}
   if(sha(single?old[0]:old)!==entry.contentSHA256){errors.push(`Stored review hash mismatch: ${file}/${entry.family}`);continue;}
   const matches=sha(content(old))===sha(content(now));
   evidence.set(`${course}:${entry.family}`,{status:matches?'first-self-review-content-matches':'changed-since-first-self-review',source:file,sourceCommit:commit,reviewBankVersion:review.bankVersion,currentContentSHA256:sha(content(now))});
  }
 }
 const groups=new Map();for(const item of current){const key=`${item.course}:${item.family}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
 const families=[...groups].map(([key,items])=>({course:items[0].course,family:items[0].family,items:items.length,...(evidence.get(key)??{status:'no-recorded-substantive-review',currentContentSHA256:sha(content(items))})}));
 const counts={};for(const family of families)counts[family.status]=(counts[family.status]??0)+1;
 const report={bankVersion:BANK_VERSION,scope:'Verifies historical review hashes against their committed bank, then compares current content excluding only the global bank version field. Matching a first self-review is not second review, independent review, empirical validation, or release approval.',counts,errors,families};
 fs.writeFileSync('docs/econ-practice/audits/review-current.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({bankVersion:BANK_VERSION,counts,errors}));if(errors.length)process.exitCode=1;
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
