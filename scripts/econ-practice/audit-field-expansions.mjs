import fs from 'node:fs';
import {auditFieldExpansions} from '../../src/lib/econ-practice/field-expansions.mjs';
const root='content/econ-drafts',reports=[];
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('-variants.json')).sort()){
 const baseFile=file.replace('-variants.json','.json');
 const result=auditFieldExpansions(JSON.parse(fs.readFileSync(`${root}/${baseFile}`)),JSON.parse(fs.readFileSync(`${root}/${file}`)));
 reports.push({file,...result});
}
const report={scope:'Unreleased expansion structure and variation checks; not content approval.',reports};
fs.writeFileSync('docs/econ-practice/audits/field-expansions.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(reports.map(r=>({file:r.file,items:r.items,families:r.families.length,errors:r.errors}))));
if(reports.some(r=>r.errors.length))process.exitCode=1;
