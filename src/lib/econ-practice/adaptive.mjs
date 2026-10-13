import {gradeResponse} from './scoring.mjs';
import {courses,prerequisitesByCourse} from './curriculum.mjs';
import {prior,itemParameters,posteriorUpdate,summarize,expectedInformation,probability} from './irt.mjs';
export const ENGINE_VERSION='content-constrained-v4';
export function newState(){return {version:1,history:[],topics:{},posteriors:{},courseSessions:{}};}
export function score(item,response){return gradeResponse(item,response).correct;}
export function recordAnswer(state,item,{response,at=Date.now(),mode='practice',hints=0,sessionId='local',eventId,calibration,measurementEligible=true}){
 if(eventId&&state.history.some(h=>h.eventId===eventId))return state;
 const p=itemParameters(item,calibration);
 const grade=gradeResponse(item,response),correct=grade.correct,key=`${item.course}:${item.topic}`;
 const t=state.topics[key]??{attempts:0,correct:0,streak:0,last:0,due:0,families:[]};
 const firstExposure=!state.history.some(h=>h.course===item.course&&h.family===item.family);
 t.credit=(t.credit??t.correct)+grade.score;t.attempts++;t.correct+=Number(correct);t.streak=correct&&hints===0?t.streak+1:0;t.last=at;
 t.due=at+(correct&&hints===0?[1,3,7,14,30][Math.min(4,t.streak-1)]:0.04)*86400000;
 t.families=[...new Set([...t.families,item.family])];state.topics[key]=t;
 const dimension=`${item.course}:${item.unit}`;
 // Repeated family variants and assisted practice do not count as independent IRT evidence.
 const psychometricEligible=measurementEligible&&item.format!=='multipart'&&mode==='assessment'&&firstExposure&&hints===0;
 if(psychometricEligible)state.posteriors[dimension]=posteriorUpdate(state.posteriors[dimension]??prior(),correct,p);
 state.history.push({eventId,itemId:item.id,family:item.family,course:item.course,topic:item.topic,unit:item.unit,correct,score:grade.score,earned:grade.earned,possible:grade.possible,response,at,mode,hints,sessionId,firstExposure,psychometricEligible,modelVersion:p.modelVersion});
 return state;
}
export function selectItem(bank,state,{course='ap-micro',mode='practice',unit=0,topic='',sessionId='local',now=Date.now(),rng=Math.random,calibration}={}){
 const session=state.history.filter(h=>h.sessionId===sessionId&&h.course===course);
 const used=new Set(session.map(h=>h.itemId));const families=new Set(session.map(h=>h.family));
 let pool=bank.filter(q=>q.course===course&&(!unit||q.unit===Number(unit))&&(!topic||q.topic===topic)&&!used.has(q.id));
 if(mode==='assessment')pool=pool.filter(q=>!families.has(q.family));
 if(!pool.length)return null;
 // Fill missing units before optimizing information; this is a hard coverage constraint.
 if(mode==='assessment'&&!unit&&!topic){const seenUnits=new Set(session.map(h=>h.unit));const uncovered=pool.filter(q=>!seenUnits.has(q.unit));if(uncovered.length)pool=uncovered;}
 const unitCounts=Array(6).fill(0);session.forEach(h=>unitCounts[h.unit-1]++);
 const recentFamilies=new Set(session.slice(-4).map(h=>h.family));
 const scored=pool.map(q=>{
  const t=state.topics[`${course}:${q.topic}`];const weights=state.posteriors[`${course}:${q.unit}`]??prior();const params=itemParameters(q,calibration);
  const deficit=courses[course].weights[q.unit-1]*(session.length+1)-unitCounts[q.unit-1];
  let utility=2*deficit;
  if(mode==='assessment')utility+=expectedInformation(weights,params);
  else{
   const accuracy=t?((t.credit??t.correct)+1)/(t.attempts+2):.5;
   const targetDifficulty=accuracy>.8?3:accuracy<.45?1:2;
   utility+=(!t?2:0)+(t&&t.due<=now?1.5:0)-.5*Math.abs(q.difficulty-targetDifficulty);
   if(recentFamilies.has(q.family))utility-=5;
   const needsPrereq=(prerequisitesByCourse[course]?.[q.topic]??[]).some(id=>{const p=state.topics[`${course}:${id}`];return p&&p.attempts>=2&&(p.credit??p.correct)/p.attempts<.4;});
   if(needsPrereq)utility-=1.5;
  }
  return {q,utility};
 });
 // Softmax randomized selection provides a known, nonzero propensity within the eligible pool.
 // Family-level sampling first prevents prolific template families from gaining exposure by count.
 const grouped=new Map();scored.forEach(x=>{if(!grouped.has(x.q.family))grouped.set(x.q.family,[]);grouped.get(x.q.family).push(x);});
 const groups=[...grouped.values()];const max=Math.max(...scored.map(x=>x.utility));
 const within=groups.map(g=>g.map(x=>Math.exp(Math.max(-30,x.utility-max))));
 // Mean mass avoids rewarding family size; conditional mass respects item-specific calibration.
 const sums=within.map(w=>w.reduce((a,b)=>a+b,0));
 const mass=sums.map((sum,i)=>sum/groups[i].length),total=mass.reduce((a,b)=>a+b,0);
 const sample=weights=>{let draw=rng()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){draw-=weights[i];if(draw<0)return i;}return weights.length-1;};
 const gi=sample(mass),ii=sample(within[gi]),picked=groups[gi][ii].q;
 return {item:picked,selection:{engineVersion:ENGINE_VERSION,probability:mass[gi]/total*within[gi][ii]/sums[gi],eligibleItems:pool.length,eligibleFamilies:groups.length,reason:mode==='assessment'?'content-balanced information sampling':'coverage, review, and difficulty',modelVersion:itemParameters(picked,calibration).modelVersion}};
}
export function progress(state,course){return courses[course].units.map((name,i)=>{const attempts=state.history.filter(h=>h.course===course&&h.unit===i+1);return {unit:i+1,name,attempts:attempts.length,correct:attempts.filter(h=>h.correct).length,credit:attempts.reduce((sum,h)=>sum+(h.score??Number(h.correct)),0),uniqueFamilies:new Set(attempts.map(h=>h.family)).size,estimate:summarize(state.posteriors[`${course}:${i+1}`]??prior())};});}
