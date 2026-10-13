import {formatResponse} from './econ-answer-form.mjs';
import {renderGraph} from '../lib/econ-practice/figures.mjs';
export function renderSessionReport(container,report){
 const doc=container.ownerDocument,node=(tag,text)=>{const el=doc.createElement(tag);el.textContent=text;return el;};container.replaceChildren();
 if(report.bankVersion!==report.currentBankVersion)container.append(node('p','This session used its original question bank. Your saved answers retain their original questions.'));
 const counted=report.rows.filter(r=>r.countsTowardResult!==false),correct=counted.filter(r=>r.correct).length,review=counted.filter(r=>!r.correct).length;
 container.append(node('p',`${correct} of ${counted.length} counted answers fully correct. ${counted.reduce((sum,r)=>sum+(r.earned??Number(r.correct)),0)} of ${counted.reduce((sum,r)=>sum+(r.possible??1),0)} available rubric points earned. ${report.rows.length-counted.length} late or post-completion answers retained separately. This is a practice summary, not an AP score prediction.`));
 if(report.coverage){const c=report.coverage;container.append(node('p',`${c.answered} distinct questions answered; ${c.unanswered} shown without a submitted answer; ${c.presented} shown of ${c.planned} planned. The score above covers submitted attempts only, not unanswered or unpresented questions.`));}
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
