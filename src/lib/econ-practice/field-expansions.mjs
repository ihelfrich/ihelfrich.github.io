import {visibleSegment} from './figures.mjs';
const text=value=>typeof value==='string'&&value.trim().length>0;
const normalized=value=>value.trim().replace(/\s+/g,' ').toLowerCase();
const rounded=value=>Number(value.toFixed(3));
// This validates structure and variation, not economic correctness or review approval.
export function auditFieldExpansions(baseItems,expansions){
 const errors=[],families=[],bases=new Map(baseItems.map(q=>[q.id,q])),seen=new Set();
 const prompts=new Set(baseItems.map(q=>normalized(q.prompt)));
 if(!Array.isArray(expansions))return {errors:['Expected an expansion array.'],families,items:0};
 let items=0;
 for(const entry of expansions){
  const id=entry?.baseId??'(missing base ID)';
  if(!entry||!bases.has(entry.baseId)){errors.push(`${id}: unknown base family`);continue;}
  if(seen.has(id))errors.push(`${id}: repeated expansion family`);seen.add(id);
  if(!Array.isArray(entry.variants)||entry.variants.length<2||entry.variants.length>64){errors.push(`${id}: expected 2–64 numeric variants`);continue;}
  const answers=new Set();let graphs=0;
  for(const [i,q] of entry.variants.entries()){
   const at=`${id}/${i+2}`;items++;
   if(!q||typeof q!=='object'||Array.isArray(q)){errors.push(`${at}: invalid variant`);continue;}
   for(const field of ['prompt','explanation','hint'])if(!text(q[field]))errors.push(`${at}: missing ${field}`);
   if(!Number.isFinite(q.answer))errors.push(`${at}: nonfinite numeric answer`);else answers.add(rounded(q.answer));
   if(text(q.prompt)){const stem=normalized(q.prompt);if(prompts.has(stem))errors.push(`${at}: repeated prompt`);prompts.add(stem);}
   if(q.graph){
    graphs++;const g=q.graph;
    if(g.kind!=='lines'||!text(g.xLabel)||!text(g.yLabel)||![g.xMax,g.yMax].every(v=>Number.isFinite(v)&&v>0)||!Array.isArray(g.lines)||!g.lines.length||g.lines.some(l=>!l||!text(l.label)||!visibleSegment(l,g.xMax,g.yMax)))errors.push(`${at}: invalid or invisible graph line`);
   }
  }
  if(answers.size<Math.min(4,entry.variants.length))errors.push(`${id}: insufficient distinct rounded answers`);
  families.push({baseId:id,unit:bases.get(id).unit,variants:entry.variants.length,distinctAnswers:answers.size,graphItems:graphs});
 }
 return {errors,families,items};
}
// Keep hints outside the public item payload. They are served through the practice
// hint endpoint, which records assistance before returning the scaffold.
export function fieldQuestionAt(base,variants,index,metadata={}){
 if(!Number.isInteger(index)||index<0||index>variants.length)throw new RangeError('Unknown field variant');
 if(index===0)return {prompt:base.prompt,correct:base.correct,wrong:base.wrong,explanation:base.explanation,format:'choice',...metadata};
 const q=variants[index-1];
 return {prompt:q.prompt,answer:rounded(q.answer),explanation:q.explanation,format:'numeric',...(q.graph?{graph:q.graph}:{}),...metadata};
}
export function fieldVariantHintAt(variants,index){
 return Number.isInteger(index)&&index>=1&&index<=variants.length?variants[index-1].hint:null;
}
