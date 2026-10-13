import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export function auditDraftItems(items){
 const errors=[],ids=new Set(),stems=new Set(),courses=Object.create(null);
 if(!Array.isArray(items))return {errors:['Expected an item array.'],courses};
 const normalized=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
 for(const [i,q] of items.entries()){
  const at=q?.id??`row ${i+1}`;
  if(!q||typeof q!=='object'||Array.isArray(q)){errors.push(`${at}: invalid record`);continue;}
  for(const field of ['id','course','topic','title','prompt','correct','explanation','skill'])if(typeof q[field]!=='string'||!q[field].trim())errors.push(`${at}: missing ${field}`);
  if(typeof q.id==='string'){if(ids.has(q.id))errors.push(`${at}: duplicate ID`);ids.add(q.id);}
  if(typeof q.prompt==='string'){const stem=normalized(q.prompt);if(stems.has(stem))errors.push(`${at}: duplicate prompt`);stems.add(stem);}
  if(!Number.isInteger(q.unit)||q.unit<1||q.unit>6||!new RegExp(`^${q.unit}\\.[1-9][0-9]*$`).test(q.topic??''))errors.push(`${at}: invalid unit/topic`);
  const options=[q.correct,...(Array.isArray(q.wrong)?q.wrong:[])];
  if(options.length!==4||options.some(x=>typeof x!=='string'||!x.trim()))errors.push(`${at}: expected four nonempty options`);
  else if(new Set(options.map(normalized)).size!==4)errors.push(`${at}: duplicate options`);
  if(q.reviewStatus!=='draft')errors.push(`${at}: draft audit cannot authorize release status`);
  if(!Array.isArray(q.sourceUrls)||!q.sourceUrls.length||q.sourceUrls.some(u=>{try{return new URL(u).protocol!=='https:';}catch{return true;}}))errors.push(`${at}: missing/invalid source URLs`);
  if(typeof q.course==='string'&&q.course){courses[q.course]??={items:0,units:Object.create(null),skills:Object.create(null)};const c=courses[q.course];c.items++;c.units[q.unit]=(c.units[q.unit]??0)+1;c.skills[q.skill]=(c.skills[q.skill]??0)+1;}
 }
 return {errors,courses};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const root='content/econ-drafts',files=fs.readdirSync(root).filter(f=>f.endsWith('.json')).sort();
 const items=files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))),result=auditDraftItems(items);
 const report={scope:'Structural draft audit only; not content approval or activation.',files,sha256:crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex'),...result};
 fs.mkdirSync('docs/econ-practice/audits',{recursive:true});fs.writeFileSync('docs/econ-practice/audits/field-drafts.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(result.errors.length)process.exitCode=1;
}
