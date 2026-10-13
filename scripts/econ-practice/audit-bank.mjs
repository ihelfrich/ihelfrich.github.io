import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildBank,families,BANK_VERSION} from '../../src/lib/econ-practice/index.mjs';
import {microTopics} from '../../src/lib/econ-practice/curriculum.mjs';
const bank=buildBank(),errors=[],warnings=[],ids=new Set(),prompts=new Map(),positions=[0,0,0,0];
for(const q of bank){
 if(ids.has(q.id))errors.push(`Duplicate ID: ${q.id}`);ids.add(q.id);
 if(!q.prompt||!q.explanation||q.prompt.includes('undefined')||q.explanation.includes('undefined'))errors.push(`Incomplete text: ${q.id}`);
 if(/\d+\.\d{8,}/.test(q.prompt))errors.push(`Unformatted decimal: ${q.id}`);
 if(q.family!=='golden-rule'&&/\bn\b|\d+n\b/.test(q.explanation))errors.push(`Generator index in explanation: ${q.id}`);
 if(q.format==='choice'){if(new Set(q.options).size!==q.options.length||!Number.isInteger(q.answerIndex)||q.answerIndex<0||q.answerIndex>=q.options.length)errors.push(`Invalid options: ${q.id}`);positions[q.answerIndex]++;}
 else if(q.format==='multipart'){if(!q.parts?.length||q.parts.some(p=>!Number.isFinite(p.answer)||!(p.points>0)))errors.push(`Invalid rubric: ${q.id}`);}
 else if(!Number.isFinite(q.answer)||!Number.isFinite(q.tolerance)||q.tolerance<=0)errors.push(`Invalid numeric key: ${q.id}`);
 if(q.graph&&(q.graph.xMax<=0||q.graph.yMax<=0||q.graph.lines.some(l=>![l.slope,l.intercept].every(Number.isFinite))))errors.push(`Invalid graph: ${q.id}`);
 const key=`${q.course}:${q.prompt}`;if(prompts.has(key))warnings.push(`Repeated rendered stem: ${q.id} / ${prompts.get(key)}`);else prompts.set(key,q.id);
}
for(const topic of Object.keys(microTopics))if(!bank.some(q=>q.course==='ap-micro'&&q.topic===topic))errors.push(`Missing AP Micro topic: ${topic}`);
const summaries=families.map(f=>{const items=bank.filter(q=>q.course===f.course&&q.family===f.id);const answers=new Set(items.map(q=>q.format==='multipart'?JSON.stringify(q.parts.map(p=>p.answer)):q.format==='numeric'?q.answer:q.options[q.answerIndex]));return {course:f.course,family:f.id,topic:f.topic,count:items.length,format:items[0].format,distinctAnswers:answers.size,graphItems:items.filter(q=>q.graph).length,contentReview:'pending',structuralChecks:errors.some(e=>items.some(q=>e.includes(q.id)))?'failed':'passed',first:{id:items[0].id,prompt:items[0].prompt,answer:items[0].format==='multipart'?items[0].parts.map(p=>p.answer):items[0].format==='numeric'?items[0].answer:items[0].options[items[0].answerIndex],explanation:items[0].explanation},last:items.length>1?{id:items.at(-1).id,prompt:items.at(-1).prompt,answer:items.at(-1).answer}:null};});
const report={bankVersion:BANK_VERSION,bankSHA256:crypto.createHash('sha256').update(JSON.stringify(bank)).digest('hex'),scope:'Structural checks and review inventory only; not a claim of substantive review, empirical calibration, or complete AP skill coverage.',counts:Object.fromEntries([...new Set(bank.map(q=>q.course))].map(c=>[c,{items:bank.filter(q=>q.course===c).length,families:families.filter(f=>f.course===c).length}])),answerPositions:positions,errors,warnings,families:summaries};
fs.mkdirSync('docs/econ-practice/audits',{recursive:true});fs.writeFileSync('docs/econ-practice/audits/bank-structure.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({counts:report.counts,errors:errors.length,warnings:warnings.length,answerPositions:positions,hash:report.bankSHA256}));if(errors.length)process.exitCode=1;
