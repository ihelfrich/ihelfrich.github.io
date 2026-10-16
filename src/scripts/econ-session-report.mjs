import {formatResponse} from './econ-answer-form.mjs';
import {renderGraph} from '../lib/econ-practice/figures.mjs';
export function renderSessionReport(container,report){
 const doc=container.ownerDocument,node=(tag,text)=>{const el=doc.createElement(tag);el.textContent=text;return el;};container.replaceChildren();
 if(report.bankVersion!==report.currentBankVersion)container.append(node('p','This session used its original question bank. Your saved answers retain their original questions.'));
 const counted=report.rows.filter(r=>r.countsTowardResult!==false),correct=counted.filter(r=>r.correct).length,review=counted.filter(r=>!r.correct).length;
 container.append(node('p',`${correct} of ${counted.length} counted answers fully correct. ${counted.reduce((sum,r)=>sum+(r.earned??Number(r.correct)),0)} of ${counted.reduce((sum,r)=>sum+(r.possible??1),0)} available rubric points earned. ${report.rows.length-counted.length} late or post-completion answers retained separately. This is a practice summary, not an AP score prediction.`));
 if(report.coverage){const c=report.coverage;container.append(node('p',`${c.answered} distinct questions answered; ${c.unanswered} shown without a submitted answer; ${c.presented} shown of ${c.planned} planned. The score above covers submitted attempts only, not unanswered or unpresented questions.`));}
 const terminalMessages={
  'precision-and-coverage':'This session ended because every required unit met its session-pinned calibrated precision and evidence thresholds. This stopping rule does not establish mastery.',
  'maximum-length':'This session reached its maximum question count. Reaching the limit does not establish that the precision thresholds were met.',
  'session-length':'This session reached its fixed question count.',
  'eligible-bank-exhausted':'This session ended because no additional eligible questions remained. This does not establish that the precision thresholds were met.',
  'participant-ended':'You ended this session. The estimates below use the eligible answers submitted before completion.'
 };
 if(report.terminalReason)container.append(node('p',terminalMessages[report.terminalReason]??'This session has ended. Its saved answers are shown below.'));
 if(report.progress?.length){
  container.append(node('h3','Unit estimates for this session'),node('p','Theta is the estimate on the model’s ability scale. Posterior SD and the 95% posterior interval describe uncertainty conditional on that model. These are formative estimates, not standardized scores or mastery classifications. Provisional estimates use authored difficulty values.'));
  const units=node('ul','');
  const statuses={'calibrated':'Calibrated model','provisional':'Provisional model','no-eligible-evidence':'No eligible evidence','incompatible-model-versions':'Incompatible model versions; no combined estimate'};
  const number=value=>Number.isFinite(value)?value.toFixed(2):'unavailable';
  for(const unit of report.progress.filter(u=>!report.stoppingPolicy?.requiredUnits||report.stoppingPolicy.requiredUnits.includes(u.unit))){
   const estimate=unit.estimate,interval=estimate?.interval;
   const summary=estimate?`Theta ${number(estimate.theta)}; posterior SD ${number(estimate.sd)}; 95% posterior interval ${Array.isArray(interval)&&interval.length===2?`[${number(interval[0])}, ${number(interval[1])}]`:'unavailable'}.`:'No estimate available.';
   units.append(node('li',`Unit ${unit.unit}: ${unit.name}. ${statuses[unit.measurementStatus]??'Measurement status unavailable'}. ${unit.measurementResponses??0} eligible response${unit.measurementResponses===1?'':'s'}. ${summary}`));
  }
  container.append(units);
 }
 const label=node('label','Show'),select=doc.createElement('select');select.setAttribute('aria-label','Filter session answers');
 for(const [value,text] of [['all',`All answers (${report.rows.length})`],['review',`Answers to review (${review})`],['excluded',`Excluded receipts (${report.rows.length-counted.length})`]]){const option=node('option',text);option.value=value;select.append(option);}label.append(select);container.append(label);
 const list=doc.createElement('div'),status=node('p','');status.setAttribute('role','status');container.append(status,list);
 function render(){list.replaceChildren();let visible=0;report.rows.forEach((r,i)=>{
  if(select.value==='review'&&(r.correct||r.countsTowardResult===false))return;
  if(select.value==='excluded'&&r.countsTowardResult!==false)return;
  visible++;const detail=doc.createElement('details');detail.className='session-answer';const outcome=r.countsTowardResult===false?'Excluded receipt':r.correct?'Correct':'Review';
  detail.append(node('summary',`${r.sequence??i+1}. ${outcome}${r.attemptNumber?` · Attempt ${r.attemptNumber}`:''} · ${r.item.title}`),node('p',r.item.prompt));
  if(r.item.graph){const figure=doc.createElement('div');figure.innerHTML=renderGraph(r.item.graph);detail.append(figure);}
  if(r.countsTowardResult===false)detail.append(node('p','Retained in history; excluded from the assessment result.'));
  detail.append(node('p',`Your answer: ${formatResponse(r.item,r.response)}`),node('p',`Answer: ${r.answer}`),node('p',r.explanation));
  if(r.parts)for(const part of r.parts){const prompt=r.item.parts?.find(p=>p.id===part.id)?.prompt??part.id;detail.append(node('p',`${prompt}: ${part.earned}/${part.possible} points. Answer: ${part.answer}. ${part.explanation}`));}
  list.append(detail);
 });status.textContent=visible?`${visible} answer${visible===1?'':'s'} shown. Open an answer to review the explanation.`:'No answers in this view.';}
 select.addEventListener('change',render);render();
}
