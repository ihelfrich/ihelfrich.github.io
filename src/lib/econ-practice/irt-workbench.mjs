import {prepare} from './prepare-calibration.mjs';
export function scopesFor(rows){
 const scopes=new Map();for(const r of rows){if(typeof r.course!=='string'||!Number.isInteger(r.unit)||typeof r.item_version!=='string')continue;const scope={course:r.course,unit:r.unit,bankVersion:r.item_version};scopes.set(JSON.stringify(scope),scope);}
 return [...scopes.values()].sort((a,b)=>a.course.localeCompare(b.course)||a.unit-b.unit||a.bankVersion.localeCompare(b.bankVersion));
}
export function analyzeRows(rows,scope,{excludedItems=[],minItemResponses=100,minPersons=300,minItemsPerPerson=3}={}){
 for(const n of [minItemResponses,minPersons,minItemsPerPerson])if(!Number.isSafeInteger(n)||n<1)throw new Error('Screening thresholds must be positive integers.');
 const scoped=rows.filter(r=>r.course===scope.course&&r.unit===scope.unit&&r.item_version===scope.bankVersion),known=new Set(scoped.map(r=>r.item_id));
 const excluded=[...new Set(excludedItems)].sort();for(const id of excluded)if(!known.has(id))throw new Error(`Excluded item is not in this dataset: ${id}`);
 const retained=scoped.filter(r=>!excluded.includes(r.item_id)),prepared=prepare(retained,{...scope,minItemResponses,minPersons,minItemsPerPerson});
 prepared.manifest.analystExclusions={itemIds:excluded,responses:scoped.length-retained.length};
 prepared.manifest.scopeSourceRows=scoped.length;
 return {scoped,prepared};
}
export function csvTable(headers,rows){
 const cell=v=>{const text=String(v??''),safe=typeof v==='string'&&/^[=+@\-\t\r\n]/.test(text)?"'"+text:text;return `"${safe.replaceAll('"','""')}"`;};
 return [headers,...rows].map(row=>row.map(cell).join(',')).join('\n')+'\n';
}
export async function matrixCSV(prepared,hash){
 const keys=await Promise.all(prepared.people.map(async id=>(await hash(id)).slice(0,20)));
 return csvTable(['person',...prepared.items],prepared.matrix.map((row,i)=>[keys[i],...row]));
}
