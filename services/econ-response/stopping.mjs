import {stoppingDecision} from '../../src/lib/econ-practice/irt.mjs';
import {progress} from '../../src/lib/econ-practice/adaptive.mjs';
import {requireValue} from './common.mjs';

// These are operational termination thresholds, not a validated mastery standard.
// Pin the entire policy; future changes must not alter an existing assessment.
export function stoppingPolicy({kind='fixed',maxItems,units}){
 requireValue(['fixed','unit-precision'].includes(kind),'Unknown assessment length policy.');
 requireValue(Number.isInteger(maxItems)&&maxItems>0,'Invalid maximum assessment length.');
 const requiredUnits=[...new Set(units)].sort((a,b)=>a-b);
 requireValue(requiredUnits.length>0&&requiredUnits.every(u=>Number.isInteger(u)&&u>0),'Invalid stopping coverage.');
 return {version:1,kind,maxItems,requiredUnits,minItems:18,minPerUnit:6,targetSD:.35,maxBoundaryMass:.01};
}

export function sessionStoppingPolicy(session){
 if(session.stopping_policy_json){
  const policy=JSON.parse(session.stopping_policy_json);
  requireValue(policy.version===1&&['fixed','unit-precision'].includes(policy.kind)&&Number.isInteger(policy.maxItems)&&policy.maxItems>0&&Array.isArray(policy.requiredUnits)&&policy.requiredUnits.length>0&&policy.requiredUnits.every(u=>Number.isInteger(u)&&u>0)&&policy.minItems===18&&policy.minPerUnit===6&&policy.targetSD===.35&&policy.maxBoundaryMass===.01,'Stored stopping policy is unavailable or incompatible.',503);
  return policy;
 }
 return {version:0,kind:'fixed',maxItems:session.mode==='assessment'?session.target_count:100};
}

export function sessionStoppingDecision(session,state,presented){
 const policy=sessionStoppingPolicy(session);
 if(presented>=policy.maxItems)return {stop:true,reason:policy.kind==='fixed'?'session-length':'maximum-length',precisionMet:false};
 if(policy.kind==='fixed')return {stop:false,reason:'fixed-length',precisionMet:false};
 const dimensions=progress(state,session.course,{sessionId:session.id});
 const required=policy.requiredUnits.map(unit=>dimensions.find(d=>d.unit===unit));
 const evidence=state.history.filter(h=>h.sessionId===session.id&&h.course===session.course&&policy.requiredUnits.includes(h.unit)&&h.psychometricEligible);
 const met=evidence.length>=policy.minItems&&required.every(d=>{
  if(!d||!d.estimate||d.measurementStatus!=='calibrated')return false;
  const families=new Set(evidence.filter(h=>h.unit===d.unit).map(h=>h.family)).size;
  return stoppingDecision({count:d.measurementResponses,uniqueFamilies:families,summary:d.estimate,minItems:policy.minPerUnit,maxItems:Number.MAX_SAFE_INTEGER,targetSD:policy.targetSD,coverageComplete:true,calibrated:true}).precisionMet;
 });
 return {stop:met,reason:met?'precision-and-coverage':'more-evidence-needed',precisionMet:met};
}
