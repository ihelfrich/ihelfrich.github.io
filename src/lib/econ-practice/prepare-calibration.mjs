import {validCourseUnit} from './curriculum.mjs';
import {itemDiagnostics} from './item-diagnostics.mjs';
export function prepare(rows,{course,unit,bankVersion,minItemResponses=100,minPersons=300,minItemsPerPerson=3}={}){
 if(!validCourseUnit(course,unit)||!bankVersion)throw new Error('Specify a registered course, a unit in that course, and bank version.');
 const exclusions={},exclude=reason=>exclusions[reason]=(exclusions[reason]??0)+1;
 const seenEvents=new Map(),eligible=[];
 for(const r of rows){
  if(typeof r.event_id!=='string'||!r.event_id){exclude('missing_event_id');continue;}
  const encoded=JSON.stringify(r);if(seenEvents.has(r.event_id)){if(seenEvents.get(r.event_id)!==encoded)throw new Error(`Conflicting duplicate event ${r.event_id}`);exclude('duplicate_event');continue;}seenEvents.set(r.event_id,encoded);
  if(r.course!==course||Number(r.unit)!==unit){exclude('other_course_or_unit');continue;}
  if(r.item_version!==bankVersion){exclude('other_bank_version');continue;}
  if(r.mode!=='assessment'){exclude('practice');continue;}
  if(![true,1].includes(r.first_family_exposure)){exclude('prior_family_exposure');continue;}
  if(!Number.isSafeInteger(r.hints_used)||r.hints_used<0||![0,1,false,true].includes(r.feedback_before_answer)){exclude('invalid_assistance_metadata');continue;}
  if(!Number.isSafeInteger(r.attempt_number)||r.attempt_number<1){exclude('invalid_attempt_metadata');continue;}
  if(r.hints_used!==0||![0,false].includes(r.feedback_before_answer)){exclude('assisted');continue;}
  if(r.attempt_number!==1){exclude('repeat_attempt');continue;}
  if(r.validity!=='valid'){exclude('validity_flag');continue;}
  if(![true,1].includes(r.calibration_eligible)){exclude('server_ineligible');continue;}
  if(!Number.isFinite(Date.parse(r.server_received_at))||!r.payload_sha256){exclude('missing_receipt');continue;}
  if(!r.participant_id||!r.session_id||!r.item_id||!r.family_id||![0,1,false,true].includes(r.correct)){exclude('invalid_response_metadata');continue;}
  if(!Number.isFinite(r.selection_probability)||r.selection_probability<=0||r.selection_probability>1){exclude('invalid_selection_probability');continue;}
  eligible.push(r);
 }
 eligible.sort((a,b)=>a.server_received_at.localeCompare(b.server_received_at)||a.event_id.localeCompare(b.event_id));
 // Retain one occasion per person. Never silently combine repeated sessions into one stable trait.
 const occasion=new Map(),familySeen=new Set(),occasionRows=[];
 for(const r of eligible){
  if(!occasion.has(r.participant_id))occasion.set(r.participant_id,r.session_id);
  if(occasion.get(r.participant_id)!==r.session_id){exclude('later_occasion');continue;}
  const key=`${r.participant_id}:${r.family_id}`;if(familySeen.has(key)){exclude('within_occasion_family_repeat');continue;}
  familySeen.add(key);occasionRows.push(r);
 }
 const personStats=new Map();for(const r of occasionRows){if(!personStats.has(r.participant_id))personStats.set(r.participant_id,[]);personStats.get(r.participant_id).push(r);}
 const validPeople=new Set([...personStats].filter(([,x])=>x.length>=minItemsPerPerson).map(([p])=>p));
 const itemStats=Object.create(null);for(const r of occasionRows){if(!validPeople.has(r.participant_id)){exclude('too_few_person_responses');continue;}const q=itemStats[r.item_id]??={n:0,correct:0,family:r.family_id,activeMs:[],propensities:[],distractors:Object.create(null)};q.n++;q.correct+=Number(r.correct);q.activeMs.push(r.active_ms);q.propensities.push(r.selection_probability);q.distractors[r.raw_answer_json]=(q.distractors[r.raw_answer_json]??0)+1;}
 const items=Object.keys(itemStats).filter(id=>itemStats[id].n>=minItemResponses&&itemStats[id].correct>0&&itemStats[id].correct<itemStats[id].n).sort();
 const ids=new Set(items),personRows=new Map();for(const r of occasionRows){if(!validPeople.has(r.participant_id))continue;if(!ids.has(r.item_id)){exclude('sparse_or_constant_item');continue;}if(!personRows.has(r.participant_id))personRows.set(r.participant_id,new Map());personRows.get(r.participant_id).set(r.item_id,Number(r.correct));}
 const people=[...personRows].filter(([,responses])=>responses.size>=minItemsPerPerson).map(([p])=>p).sort();
 const matrix=people.map(p=>items.map(id=>personRows.get(p).get(id)??null));
 const observedCounts=items.map((_,j)=>matrix.reduce((n,row)=>n+Number(row[j]!==null),0));
 const finalItemStats=Object.fromEntries(items.map((id,j)=>{const correct=matrix.reduce((n,row)=>n+Number(row[j]===1),0),n=observedCounts[j];return [id,{n,correct,constantResponse:correct===0||correct===n}];}));
 const constantAfterFilter=items.filter(id=>finalItemStats[id].constantResponse);
 const reasons=[];if(constantAfterFilter.length)reasons.push('constant_items_after_person_filter');if(people.length<minPersons)reasons.push('insufficient_persons');if(items.length<5)reasons.push('fewer_than_five_items');if(observedCounts.some(n=>n<minItemResponses))reasons.push('sparse_items_after_person_filter');
 // Check connectedness of observed item coadministration. Disconnected components cannot be linked without anchors.
 const adjacency=new Map(items.map(id=>[id,new Set()]));for(const row of matrix){const observed=items.filter((_,j)=>row[j]!==null);for(const a of observed)for(const b of observed)adjacency.get(a).add(b);}
 const reached=new Set(),stack=items.length?[items[0]]:[];while(stack.length){const id=stack.pop();if(reached.has(id))continue;reached.add(id);stack.push(...[...adjacency.get(id)].filter(x=>!reached.has(x)));}if(reached.size!==items.length)reasons.push('disconnected_item_design');
 const manifest={schemaVersion:1,course,unit,bankVersion,sourceRows:rows.length,eligibleRows:eligible.length,retainedPersons:people.length,retainedItems:items.length,exclusions,screening:{minItemResponses,minPersons,minItemsPerPerson},readyForCandidateFit:reasons.length===0,blockingReasons:reasons,items,itemStats,finalItemStats,diagnostics:itemDiagnostics(itemStats,Object.fromEntries(items.map((id,i)=>[id,observedCounts[i]]))),warning:'Passing screening does not establish identifiability, item quality, adequate power, or operational validity. No model is automatically approved.'};
 return {manifest,items,people,matrix};
}
