import katex from 'katex';
import {buildInsight} from '../lib/macroeconomics-insights.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderInsight(host,state,{drawChart,select,parameter,format}){
 const view=buildInsight(state),doc=host.ownerDocument;host.dataset.insightModel=state.model;host.dataset.insightStep=state.step;
 host.innerHTML=`<p class="macro-eyebrow">A useful question</p><h3>${escape(view.question)}</h3><p class="macro-insight-answer">${escape(view.answer)}</p><div data-insight-visual></div><div class="macro-equation">${katex.renderToString(view.equation,{displayMode:true,throwOnError:true,output:'htmlAndMathml'})}</div><p class="macro-note">${escape(view.note)}</p>`;
 const body=host.querySelector('[data-insight-visual]');
 function buttons(parts,max,grouped=false){
  const wrapper=doc.createElement('div');wrapper.className='macro-insight-bars';
  for(const [i,part]of parts.entries()){
   const positive=part.value>=0,b=doc.createElement('button');b.type='button';b.className=`macro-insight-bar${grouped?' macro-insight-bar-grouped':''}`;b.dataset.insightPart=part.id;b.setAttribute('aria-pressed','false');
   b.style.setProperty('--bar-amount',`${Math.abs(part.value)/max*(grouped?100:50)}%`);b.style.setProperty('--bar-start',grouped?'0%':positive?'50%':`${50-Math.abs(part.value)/max*50}%`);b.style.setProperty('--bar-color',grouped?(i===0?'var(--macro-blue)':'var(--macro-teal)'):positive?'var(--macro-blue)':'var(--macro-rust)');
   b.innerHTML=`<span>${escape(part.label)}</span><i class="macro-insight-track"><i></i></i><strong>${escape(format(part.value,4))}</strong>`;
   b.addEventListener('click',()=>{host.querySelectorAll('[data-insight-part]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));host.querySelector('[data-insight-explanation]').textContent=part.explanation;});wrapper.append(b);
  }return wrapper;
 }
 if(view.parts){
  body.innerHTML=`<p class="macro-insight-unit">${escape(view.unit)} · bars share a zero line</p>`;
  body.append(buttons(view.parts,Math.max(1e-12,...view.parts.map(p=>Math.abs(p.value)))));
  if(view.total!==undefined){const total=doc.createElement('p');total.className='macro-insight-total';total.innerHTML=`<span>Combined effect</span><strong>${escape(format(view.total,4))}</strong>`;body.append(total);}
 }
 if(view.groups){
  const max=Math.max(1e-12,...view.groups.flatMap(g=>g.bars.map(b=>b.value)));body.innerHTML=`<p class="macro-insight-unit">${escape(view.unit)} · common scale across both dates</p>`;
  for(const [i,group]of view.groups.entries()){const title=doc.createElement('h4');title.textContent=group.label;body.append(title);body.append(buttons(group.bars.map((b,j)=>({...b,id:`date-${i}-${j}`,explanation:`${b.label} in the ${group.label.toLowerCase()}: ${format(b.value,4)} goods. Asset income and the foreign-asset position reconcile the difference from the other bar.`})),max,true));}
 }
 if(view.flow){
  const v=view.flow;body.innerHTML=`<div class="macro-workforce-flow" aria-label="Workforce stocks and transitions per 100 workers"><div class="macro-workforce-stock"><span>Employed at start</span><strong>${format(v.employed)}</strong><small>per 100 workers</small></div><div class="macro-workforce-stock"><span>Unemployed at start</span><strong>${format(v.unemployed)}</strong><small>per 100 workers</small></div><button type="button" data-insight-part="losses" aria-pressed="false"><span>Lose jobs →</span><strong>${format(v.lose)}</strong></button><button type="button" data-insight-part="finds" aria-pressed="false"><span>← Find jobs</span><strong>${format(v.find)}</strong></button><div class="macro-workforce-stock macro-workforce-next"><span>Employed next period</span><strong>${format(v.nextEmployed)}</strong></div><div class="macro-workforce-stock macro-workforce-next"><span>Unemployed next period</span><strong>${format(v.nextUnemployed)}</strong></div></div>`;
  body.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{body.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));host.querySelector('[data-insight-explanation]').textContent=b.dataset.insightPart==='losses'?'Job losses move workers from the employed stock to the unemployed stock. The flow is the separation probability times beginning-period employment.':'Job finding moves workers in the opposite direction. The flow is the finding probability times beginning-period unemployment.';}));
 }
 if(view.chart){
  const chart={...view.chart},selection=chart.selection;delete chart.selection;
  if(selection){chart.selectedX=selection.value;chart.selectKey=selection.kind==='parameter'?selection.key:selection.kind;chart.selectStep=selection.step;
   chart.onSelect=x=>{if(selection.kind==='parameter')parameter(selection.key,x);else if(selection.kind==='period')select(Math.round(x));else select(state.result.grid.reduce((best,k,i)=>Math.abs(k-x)<Math.abs(state.result.grid[best]-x)?i:best,0));};
  }
  drawChart(body,chart);
 }
 if(view.parts||view.groups||view.flow){const explanation=doc.createElement('p');explanation.dataset.insightExplanation='';explanation.className='macro-insight-explanation';explanation.setAttribute('aria-live','polite');explanation.textContent='Select a bar or flow to see what it represents.';body.append(explanation);}
}
