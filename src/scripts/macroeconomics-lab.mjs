import katex from 'katex';
import {research,researchSources} from '../data/macroeconomics-research.mjs';
import {models,byId} from '../data/macroeconomics.mjs';
import * as engine from '../lib/macroeconomics.mjs';
import * as extended from '../lib/macroeconomics-extended.mjs';
import {renderInspection} from './macroeconomics-inspector.mjs';
import {extendedPlots,extendedMetrics,extendedInterpretation} from './macroeconomics-views.mjs';
const NS='http://www.w3.org/2000/svg';
const colors=['var(--macro-blue)','var(--macro-rust)','var(--macro-teal)','var(--ink)'];
const solve={...extended,solow:engine.solow,ak:engine.ak,trap:engine.trap,olg:engine.olg,islm:engine.islm,nk:engine.newKeynesian,debt:engine.debt,optimal:engine.optimalGrowth};
export function format(x,digits=2){if(x==null)return 'None';if(!Number.isFinite(x))return 'Outside range';if(Math.abs(x)>1e6||(Math.abs(x)>0&&Math.abs(x)<.0001))return x.toExponential(2);return new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(x);}
const pct=x=>`${format(100*x)}%`;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function svgEl(doc,tag,attrs={},content){const e=doc.createElementNS(NS,tag);for(const [key,v]of Object.entries(attrs))e.setAttribute(key,v);if(content!==undefined)e.textContent=content;return e;}
function table(rows,selected=0){if(!rows.length)return '';const keys=Object.keys(rows[0]);return `<details class="macro-data"><summary>Inspect the calculated values · ${rows.length} rows</summary><div class="macro-table-wrap" tabindex="0" role="region" aria-label="Calculated model values"><table><caption>Model variables; units follow the equations and parameter labels.</caption><thead><tr><th scope="col">Select</th>${keys.map(k=>`<th scope="col">${escape(k)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,index)=>`<tr data-selected="${index===selected}"><td><button type="button" data-row="${index}" aria-label="Inspect row ${index}">${index===selected?'Selected':'Inspect'}</button></td>${keys.map(k=>`<td>${typeof r[k]==='number'?format(r[k],6):escape(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;}
function drawChart(host,{title,xLabel,yLabel,series,points=[],zero=true,selectedX,onSelect,selectKey,selectStep=1,selectedSeries}){
  const doc=host.ownerDocument,fig=doc.createElement('figure');fig.className='macro-chart';
  const caption=doc.createElement('figcaption');caption.textContent=title;fig.append(caption);host.append(fig);
  const w=fig.getBoundingClientRect().width||640,h=300,margin={l:w<400?54:66,r:22,t:20,b:60},iw=w-margin.l-margin.r,ih=h-margin.t-margin.b;
  const all=series.flatMap(s=>s.values).concat(points).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(!all.length)return;
  let xmin=Math.min(...all.map(p=>p.x)),xmax=Math.max(...all.map(p=>p.x)),ymin=Math.min(...all.map(p=>p.y)),ymax=Math.max(...all.map(p=>p.y));
  if(xmin===xmax)xmax=xmin+1;if(zero){ymin=Math.min(0,ymin);ymax=Math.max(0,ymax);}if(ymin===ymax)ymax=ymin+1;
  const yp=(ymax-ymin)*.08;ymin-=yp;ymax+=yp;
  const X=x=>margin.l+(x-xmin)/(xmax-xmin)*iw,Y=y=>margin.t+(ymax-y)/(ymax-ymin)*ih;
  const svg=svgEl(doc,'svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`${title}. Horizontal axis: ${xLabel}. Vertical axis: ${yLabel}.`});svg.style.height=`${h}px`;fig.append(svg);svg.dataset.chartName=title;
  if(onSelect){svg.dataset.chartSelect=selectKey;svg.setAttribute('tabindex','0');svg.setAttribute('role','slider');svg.setAttribute('aria-valuemin',xmin);svg.setAttribute('aria-valuemax',xmax);svg.setAttribute('aria-valuenow',selectedX??xmin);svg.setAttribute('aria-label',`${title}. Select ${xLabel} with left and right arrows, or click the plot.`);svg.style.cursor='crosshair';}
  svg.append(svgEl(doc,'rect',{x:margin.l,y:margin.t,width:iw,height:ih,fill:'none',stroke:'var(--rule)'}));
  const ticks=w<400?3:4;
  for(let i=0;i<=ticks;i++){
    const xv=xmin+(xmax-xmin)*i/ticks,yv=ymin+(ymax-ymin)*i/ticks;
    svg.append(svgEl(doc,'line',{x1:margin.l,x2:w-margin.r,y1:Y(yv),y2:Y(yv),stroke:'var(--rule)','stroke-opacity':.45}));
    svg.append(svgEl(doc,'text',{x:X(xv),y:h-margin.b+23,'text-anchor':i===0?'start':i===ticks?'end':'middle',class:'macro-tick'},format(xv)));
    svg.append(svgEl(doc,'text',{x:margin.l-9,y:Y(yv)+4,'text-anchor':'end',class:'macro-tick'},format(yv)));
  }
  svg.append(svgEl(doc,'text',{x:margin.l+iw/2,y:h-8,'text-anchor':'middle',class:'macro-axis'},xLabel));
  svg.append(svgEl(doc,'text',{transform:`translate(15 ${margin.t+ih/2}) rotate(-90)`,'text-anchor':'middle',class:'macro-axis'},yLabel));
  series.forEach((s,i)=>{
    const values=s.values.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    svg.append(svgEl(doc,'path',{d:values.map((p,j)=>`${j?'L':'M'}${X(p.x)},${Y(p.y)}`).join(' '),fill:'none',stroke:colors[i%colors.length],'stroke-width':selectedSeries===i?3:2.3,opacity:selectedSeries===undefined||selectedSeries===i?1:.35,'data-series-index':i,'data-series-active':selectedSeries===i,'stroke-dasharray':s.dash?'6 4':'','vector-effect':'non-scaling-stroke'}));
  });
  for(const p of points)svg.append(svgEl(doc,'circle',{cx:X(p.x),cy:Y(p.y),r:4,fill:'var(--ink)',stroke:'var(--paper)','stroke-width':1.5}));
  if(Number.isFinite(selectedX)){const px=X(selectedX);svg.dataset.selectedX=selectedX;svg.append(svgEl(doc,'line',{x1:px,x2:px,y1:margin.t,y2:h-margin.b,stroke:'var(--macro-blue)','stroke-width':1,'stroke-dasharray':'4 3',class:'macro-selected-guide'}));for(const [j,s] of series.entries()){const y=engine.interpolate(s.values.map(p=>p.x),s.values.map(p=>p.y),selectedX);if(Number.isFinite(y))svg.append(svgEl(doc,'circle',{cx:px,cy:Y(y),r:4.5,fill:colors[j%colors.length],stroke:'var(--paper)','stroke-width':2}));}}
  const legend=doc.createElement('div');legend.className='macro-legend';legend.innerHTML=series.map((s,i)=>`<span><i style="--series:${colors[i%colors.length]};${s.dash?'border-top-style:dashed':''}"></i>${escape(s.name)}</span>`).join('');fig.append(legend);
  const probe=doc.createElement('output');probe.className='macro-probe';probe.textContent=onSelect?'Click to select; use arrow keys when focused. All linked views follow the selection.':'Point to inspect values. Change parameters to move the equilibrium.';fig.append(probe);
  const guide=svgEl(doc,'line',{y1:margin.t,y2:h-margin.b,stroke:'var(--ink)','stroke-dasharray':'3 3',visibility:'hidden'});svg.append(guide);
  svg.addEventListener('pointermove',event=>{const bounds=svg.getBoundingClientRect();if(!bounds.width)return;const px=Math.max(margin.l,Math.min(w-margin.r,(event.clientX-bounds.left)*w/bounds.width)),x=xmin+(px-margin.l)/iw*(xmax-xmin);guide.setAttribute('x1',px);guide.setAttribute('x2',px);guide.setAttribute('visibility','visible');probe.textContent=`${xLabel}: ${format(x)} · `+series.map(s=>`${s.name}: ${format(engine.interpolate(s.values.map(p=>p.x),s.values.map(p=>p.y),x))}`).join(' · ');});
  svg.addEventListener('pointerleave',()=>guide.setAttribute('visibility','hidden'));
  if(onSelect){const choose=x=>onSelect(Math.max(xmin,Math.min(xmax,x)));svg.addEventListener('click',event=>{const bounds=svg.getBoundingClientRect();if(bounds.width)choose(xmin+((event.clientX-bounds.left)*w/bounds.width-margin.l)/iw*(xmax-xmin));});svg.addEventListener('keydown',event=>{const values={ArrowLeft:(selectedX??xmin)-selectStep,ArrowRight:(selectedX??xmin)+selectStep,Home:xmin,End:xmax};if(event.key in values){event.preventDefault();choose(values[event.key]);}});}
}
function drawFlow(host,row,step,T,onStep,isAK){
  const doc=host.ownerDocument;
  host.replaceChildren();
  const w=host.getBoundingClientRect().width||640,h=318,bw=Math.min(190,(w-36)/2),cx=w/2,left=6,right=w-6-bw;
  const svg=svgEl(doc,'svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`Period ${step}: equipment ${format(row.K)} and workers ${format(row.L)} produce output ${format(row.Y)}. Consumption is ${format(row.C)} and investment ${format(row.I)}.`});svg.style.height=h+'px';host.append(svg);
  const defs=svgEl(doc,'defs'),marker=svgEl(doc,'marker',{id:'macro-flow-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto'});marker.append(svgEl(doc,'path',{d:'M0 0 L10 5 L0 10 Z',fill:'var(--ink)'}));defs.append(marker);svg.append(defs);
  function node(x,y,label,value,secondary=''){svg.append(svgEl(doc,'rect',{x,y,width:bw,height:70,'data-flow-term':label.startsWith('Equipment')?'K':label.startsWith('Investment')?'I':label.startsWith('Consumption')?'C':label.startsWith('Workers')?'L':'Y',fill:'var(--white)',stroke:'var(--rule)'}));svg.append(svgEl(doc,'text',{x:x+bw/2,y:y+23,'text-anchor':'middle',class:'macro-flow-label'},label));svg.append(svgEl(doc,'text',{x:x+bw/2,y:y+47,'text-anchor':'middle',class:'macro-flow-value'},format(value)));if(secondary)svg.append(svgEl(doc,'text',{x:x+bw/2,y:y+64,'text-anchor':'middle',class:'macro-tick'},secondary));}
  function arrow(d,dashed=false){svg.append(svgEl(doc,'path',{d,fill:'none',stroke:'var(--ink)','stroke-width':1.3,'stroke-dasharray':dashed?'4 4':'','marker-end':'url(#macro-flow-arrow)'}));}
  node(left,6,'Equipment · K',row.K);node(right,6,'Workers · L',row.L,isAK?'':`Efficiency × ${format(row.A)}`);
  node(cx-bw/2,122,'Production → output',row.Y,isAK?'Y = aK':'Capital + labor');
  arrow(`M${left+bw/2} 76 V99 H${cx-bw/4} V122`,true);
  if(!isAK)arrow(`M${right+bw/2} 76 V99 H${cx+bw/4} V122`,true);
  node(left,244,'Consumption · C',row.C);node(right,244,'Investment · I',row.I);
  arrow(`M${cx} 192 V216 H${left+bw/2} V244`);arrow(`M${cx} 216 H${right+bw/2} V244`);
  const ledger=doc.createElement('div');ledger.className='macro-ledgers';ledger.innerHTML=`<div><h4>Equipment carried forward</h4><dl><div><dt>Existing equipment</dt><dd>${format(row.K)}</dd></div><div><dt>+ Investment</dt><dd>${format(row.I)}</dd></div><div data-flow-term="D"><dt>− Depreciation</dt><dd>${format(row.D)}</dd></div><div class="macro-total"><dt>Next period</dt><dd>${format(row.K1)}</dd></div></dl></div><div><h4>Workers next period</h4><dl><div><dt>Existing workers</dt><dd>${format(row.L)}</dd></div><div><dt>+ Workforce growth</dt><dd>${format(row.L1-row.L)}</dd></div><div class="macro-total"><dt>Next period</dt><dd>${format(row.L1)}</dd></div></dl><p>Equipment per worker<br><strong>${format(row.k)} → ${format(row.k1)}</strong></p></div>`;host.append(ledger);
  if(isAK){const note=doc.createElement('p');note.className='macro-note';note.textContent='In AK, workers enter the per-worker denominator. Capital alone produces output in this aggregate technology.';host.append(note);}
}
function metrics(state){const {model:id,result:r,params:p}=state;if(extended[id])return extendedMetrics(state,format,pct);
  switch(id){
    case 'solow':return [['Initial capital / worker',format(r.rows[0].k)],['After one period',format(r.rows[0].k1)],['Steady capital / effective worker',format(r.steady)]];
    case 'ak':return [['Growth / worker',pct(r.growth)],['Marginal product',format(p.a)],['Growth in total output',pct(p.s*p.a-p.delta)]];
    case 'trap':return [['Stable crossing',format(r.roots.find(x=>x.stable)?.k)],['Unstable threshold',format(r.roots.find(x=>!x.stable)?.k)],['High-capital growth limit',pct(r.growth)]];
    case 'olg':return [['Steady capital / young worker',format(r.steady,3)],['Equilibrium gross return',format(r.R,3)],['Steady-state efficiency',r.efficient?'Efficient':'Overaccumulation']];
    case 'islm':return [['Equilibrium output',format(r.Y)],['Interest rate',pct(r.r)],['Fiscal multiplier',format(r.multiplier,3)]];
    case 'nk':return [['Initial output gap',`${format(r.rows[0].x*100)} pp`],['Initial inflation',`${format(r.rows[0].pi*100)} pp`],['Bounded equilibrium',r.determinate?'Unique':'Not unique / boundary']];
    case 'debt':return [['Initial debt / GDP',pct(p.b0)],['Balance holding initial debt',pct(r.stabilizing)],['Debt / GDP at horizon',pct(r.rows.at(-1).b)]];
    default:return [['Bellman residual',format(r.residual)],['Value-error bound on grid',format(r.errorBound)],['Solver',r.converged?'Converged':'Iteration limit']];
  }
}
function interpretation(state){const {model:id,result:r,params:p}=state;if(extended[id])return extendedInterpretation(state,format,pct);
  const change=r.rows?.[0]?.k1-r.rows?.[0]?.k;
  if(id==='solow'||id==='ak')return `In the first period, investment adds ${format(r.rows[0].I)} units and depreciation removes ${format(r.rows[0].D)}. Capital per worker ${Math.abs(change)<1e-8?'stays unchanged':change>0?'rises':'falls'} by ${format(Math.abs(change))}.`;
  if(id==='trap')return r.roots.length===2?`There are two positive crossings. From ${format(p.k0)}, capital per worker initially ${change>0?'rises':'falls'}. The unstable crossing separates the two long-run regions.`:`This setting has ${r.roots.length} positive crossing${r.roots.length===1?'':'s'}. A poverty trap is not guaranteed by the model’s label.`;
  if(id==='olg')return `Young households save ${pct(r.savingShare)} of wages. The steady-state gross return is ${format(r.R,3)}, compared with cohort growth factor ${format(1+p.n,3)}.`;
  if(id==='islm')return `${r.C<0||r.I<0?'The linear extrapolation implies negative consumption or investment. ':''}A one-unit rise in government purchases raises equilibrium output by ${format(r.multiplier,3)} units at these parameters.`;
  if(id==='nk'){const large=Math.max(Math.abs(r.rows[0].x),Math.abs(r.rows[0].pi),Math.abs(r.rows[0].i))>.1;return (large?'The response exceeds 10 percentage points; the local linear approximation may be unreliable. ':'')+(r.determinate?'The rule selects a unique bounded response in this two-jump-variable model. The paths are conditional expectations after the selected shock.':'This policy rule does not establish a unique bounded equilibrium. The displayed fundamental response satisfies the equations but is only a particular solution.');}
  if(id==='debt')return `A surplus of ${pct(r.stabilizing)} of next-period GDP holds the initial debt ratio constant. Under the selected constant balance, the carry factor is ${format(r.factor,4)}.`;
  return `The finite-grid solver ${r.converged?'converged':'reached its iteration limit'} after ${r.iterations} iterations. ${r.boundary} of ${2*p.N} policy choices hit a grid edge. Numerical convergence does not establish accuracy for the continuous model.`;
}
function plots(host,state,select,parameter){host.replaceChildren();const {model:id,result:r,params:p}=state;
  const selected=r.rows?.[state.step];const nearest=(key,x)=>r.rows.reduce((best,row,i)=>Math.abs(row[key]-x)<Math.abs(r.rows[best][key]-x)?i:best,0);
  const phase=(key)=>({selectedX:selected?.[key],onSelect:x=>select(nearest(key,x)),selectKey:"state",selectStep:Math.max(.001,(selected?.[key]||1)/20)});
  if(extended[id]){extendedPlots(host,state,{drawChart,select,parameter,format});return;}
  const series=(rows,key,mul=1)=>rows.map(v=>({x:v.t,y:v[key]*mul}));
  const path=(title,names,yLabel='Units per worker',xLabel='Period')=>drawChart(host,{title,xLabel,yLabel,selectedX:state.step,onSelect:x=>select(Math.round(x)),selectKey:'period',series:names.map(([name,key,mul=1])=>({name,values:series(r.rows,key,mul)}))});
  if(id==='solow'||id==='trap'){
    const steady=id==='solow'?[r.steady]:r.roots.map(q=>q.k),initial=id==='solow'?r.rows[0].q:p.k0,max=Math.max(initial*1.3,(id==='solow'?selected.q:selected.k)*1.3,...steady.filter(x=>x!=null).map(x=>x*1.3),1);
    const qs=engine.grid(0,max),f=q=>id==='solow'?p.B*q**p.alpha:engine.trapOutput(q,p),upkeep=id==='solow'?r.breakEven:p.n+p.delta;
    drawChart(host,{title:'Investment and the cost of keeping up',...phase(id==='solow'?'q':'k'),xLabel:id==='solow'?'Capital / effective worker':'Capital / worker',yLabel:id==='solow'?'Goods / eff. worker / period':'Goods / worker / period',series:[{name:'Investment',values:qs.map(x=>({x,y:p.s*f(x)}))},{name:'Required investment',values:qs.map(x=>({x,y:upkeep*x})),dash:true}],points:steady.filter(x=>x!=null).map(x=>({x,y:upkeep*x}))});
    path('The adjustment path',id==='solow'?[['Capital / effective worker','q']]:[['Capital / worker','k']],id==='solow'?'Capital / effective worker':'Capital / worker');
  }else if(id==='ak'){
    path('Accumulation without diminishing returns',[['Capital / worker','k']],'Capital / worker');
    const ss=engine.grid(0,.6);drawChart(host,{title:'Saving changes the permanent growth rate',selectedX:p.s*100,onSelect:x=>parameter('s',x/100),selectKey:'s',selectStep:1,xLabel:'Saving (% of output)',yLabel:'Growth / worker (%)',series:[{name:'Exact per-worker growth',values:ss.map(s=>({x:s*100,y:100*((1+s*p.a-p.delta)/(1+p.n)-1)}))}],points:[{x:p.s*100,y:r.growth*100}]});
  }else if(id==='olg'){
    const ks=engine.grid(0,Math.max(p.k0,r.steady)*1.6);drawChart(host,{title:'One generation builds the next generation’s capital',...phase('k'),xLabel:'Capital / young worker today',yLabel:'Capital / young worker next',series:[{name:'Capital transition',values:ks.map(x=>({x,y:r.savingShare*(1-p.alpha)*p.B*x**p.alpha/(1+p.n)}))},{name:'Unchanged capital (45°)',values:ks.map(x=>({x,y:x})),dash:true}],points:[{x:r.steady,y:r.steady}]});path('Capital across generations',[['Capital / young worker','k']],'Units / young worker','Generation');
  }else if(id==='islm'){
    const ys=engine.grid(0,r.Y*1.7);drawChart(host,{title:'Goods and money markets',xLabel:'Output',yLabel:'Interest rate (%)',series:[{name:'IS: goods-market equilibrium',values:ys.map(x=>({x,y:100*(r.autonomous-(1-p.c)*x)/p.b}))},{name:'LM: money-market equilibrium',values:ys.map(x=>({x,y:100*(.8*x-p.M)/1000}))}],points:[{x:r.Y,y:r.r*100}]});
    drawChart(host,{title:'Fiscal comparative statics',selectedX:p.G,onSelect:x=>parameter('G',x),selectKey:'G',selectStep:5,xLabel:'Government purchases',yLabel:'Equilibrium output',series:[{name:'Output with money market clearing',values:engine.grid(0,200,61).map(x=>({x,y:engine.islm({...p,G:x}).Y}))}],points:[{x:p.G,y:r.Y}]});
  }else if(id==='nk'){
    path('Expected response to a persistent shock',[['Output gap','x',100],['Inflation','pi',100],['Policy rate','i',100]],'Percentage points','Quarter');
    drawChart(host,{title:'What adds up to inflation?',xLabel:'Quarter',yLabel:'Percentage points',selectedX:state.step,onSelect:x=>select(Math.round(x)),selectKey:'period',series:[{name:'Expected inflation term',values:r.rows.map(v=>({x:v.t,y:100*p.beta*p.rho*v.pi}))},{name:'Output-gap term',values:r.rows.map(v=>({x:v.t,y:100*p.kappa*v.x}))},{name:'Cost-push shock',values:series(r.rows,'u',100)}]});
  }else if(id==='debt'){
    path('Debt relative to the size of the economy',[['Debt / GDP','b',100]],'Percent of GDP');path('The contributions to changing debt',[['Interest-growth contribution','carry',100],['Primary balance contribution','surplus',-100]],'Percentage points of GDP');
  }else{
    for(const [key,title,yLabel]of [['policy','The optimal capital policy','Next-period capital'],['consumption','The optimal consumption policy','Consumption']])drawChart(host,{title,xLabel:'Current capital',yLabel,selectedSeries:state.productivity,selectedX:r.grid[state.step],onSelect:x=>select(r.grid.reduce((best,k,i)=>Math.abs(k-x)<Math.abs(r.grid[best]-x)?i:best,0)),selectKey:'capital',selectStep:r.grid[1]-r.grid[0],series:r.z.map((z,j)=>({name:`Productivity ${format(z)}`,values:r.grid.map((x,i)=>({x,y:r[key][j][i]}))}))});
  }
  if(id==='solow'||id==='ak'){const k=selected.k,mpk=id==='ak'?p.a:p.alpha*p.B*k**(p.alpha-1)*selected.A**(1-p.alpha),f=x=>id==='ak'?p.a*x:p.B*x**p.alpha*selected.A**(1-p.alpha);drawChart(host,{title:'Production and the marginal product of capital',xLabel:'Capital / worker',yLabel:'Output / worker / period',...phase('k'),series:[{name:'Production',values:engine.grid(0,Math.max(1,k*1.6)).map(x=>({x,y:f(x)}))},{name:`Tangent · MPK = ${format(mpk,3)}`,dash:true,values:engine.grid(Math.max(.01,k*.65),k*1.35,2).map(x=>({x,y:f(k)+mpk*(x-k)}))}]});}
}
function diagnostic(state){const {model:id,result:r}=state;if(extended[id])return extendedInterpretation(state,format,pct);
  if(id==='optimal')return `Bellman residual: ${format(r.residual)}. Contraction bound: ${format(r.errorBound)}. Iterations: ${r.iterations}. Grid-edge choices: ${r.boundary}.`;
  if(id==='nk')return `Maximum equation residual: ${format(r.residual)}. Expectational eigenvalue moduli: ${r.eigenModuli.map(x=>format(x,5)).join(', ')}. Both must exceed one for determinacy.`;
  if(id==='islm')return `Maximum market-clearing residual: ${format(r.residual)}.`;
  if(id==='solow'||id==='ak'){const resid=Math.max(...r.rows.map(v=>Math.max(Math.abs(v.Y-v.C-v.I),Math.abs(v.K1-v.K-v.I+v.D))/Math.max(1,v.Y,v.K)));return `Maximum scaled resource-accounting residual: ${format(resid)}.`;}
  if(id==='olg')return `Household saving share: ${format(r.savingShare,6)}. Steady gross return: ${format(r.R,6)}. Golden-rule capital: ${format(r.golden,6)}.`;
  if(id==='trap')return `Positive crossings: ${r.roots.map(x=>`${format(x.k,6)} (${x.stable?'stable':'unstable'})`).join('; ')||'none'}.`;
  return `Debt carry factor: ${format(r.factor,6)}. ${r.stable?'Stable':'Noncontracting'} dynamics under a fixed primary balance.`;
}
function renderReading(host,state){const model=byId[state.model];
  if(state.mode==='explore')host.innerHTML=`<div class="macro-explore"><div><h3>The mechanism</h3><p>${escape(model.intuition)}</p><p class="macro-try"><strong>Try this.</strong> ${escape(model.experiment)}</p></div><div class="macro-question"><h3>Work it through</h3><p>${escape(model.exercise.question)}</p><details><summary>Show the reasoning</summary><p>${escape(model.exercise.answer)}</p></details></div></div>`;
  else if(state.mode==='equations')host.innerHTML=`<div class="macro-equations">${model.equations.map(eq=>`<div class="macro-equation">${katex.renderToString(eq,{displayMode:true,throwOnError:false,output:'htmlAndMathml'})}</div>`).join('')}</div><p>${escape(model.derivation)}</p><h3>Assumptions</h3><ul>${model.assumptions.map(x=>`<li>${escape(x)}</li>`).join('')}</ul>`;
  else if(state.mode==='research'){const q=research[state.model];host.innerHTML=`<div class="macro-research"><p class="macro-eyebrow">Research question</p><h3>${escape(q.question)}</h3><p><strong>Prerequisites.</strong> ${escape(q.prerequisites)}</p><div class="macro-equation">${katex.renderToString(q.equation,{displayMode:true,throwOnError:true})}</div><p>${escape(q.method)}</p><p><strong>Beyond this implementation.</strong> ${escape(q.extension)}</p><div class="macro-related"><span>Connect the models</span>${q.links.map(id=>`<button type="button" data-model="${id}">${escape(byId[id].title)} ↗</button>`).join('')}</div><details><summary>Research references and software</summary><ul>${researchSources.map(x=>`<li><a href="${x.url}" target="_blank" rel="noopener">${x.label}</a> — ${x.use}</li>`).join('')}</ul></details></div>`;}
  else {const r=state.result,rows=['optimal','household'].includes(state.model)?r.grid.map((k,i)=>({k,lowCapital:r.policy[0][i],highCapital:r.policy[1][i],lowConsumption:r.consumption[0][i],highConsumption:r.consumption[1][i]})):r.rows||[Object.fromEntries(Object.entries(r).filter(([,v])=>typeof v==='number'))];host.innerHTML=`<p>${escape(model.computation)}</p><p class="macro-diagnostic">${escape(diagnostic(state))}</p>${table(rows,state.step)}`;}
  const source=host.ownerDocument.createElement('p');source.className='macro-source';source.innerHTML=`Model reference: <a href="${escape(model.source.url)}" target="_blank" rel="noopener">${escape(model.source.label)}</a>. All parameter values here are illustrative.`;host.append(source);
}
export function initializeMacro(doc){
 const root=doc.querySelector('[data-macro]');if(!root)return null;if(root.macroApp)return root.macroApp;
 const win=doc.defaultView,initial=win?.location.hash.slice(1),model=byId[initial]?initial:'solow';
 const state={model,params:{...byId[model].defaults},validParams:null,result:null,mode:'explore',view:'linked',step:0,productivity:0,term:null};
 const $=s=>root.querySelector(s);
 // A single inspector owns the selection for flows, trajectories, equations and tables.
 for(const [key,className]of [['selection','macro-selection'],['live-math','macro-live-math']])if(!$(`[data-${key}]`)){const host=doc.createElement('div');host.setAttribute(`data-${key}`,'');host.className=className;$('[data-flow]').before(host);}
 $('[data-selection]').innerHTML='<label class="macro-period"><span data-inspect-label>Inspect period <strong>0</strong></span><input data-inspect-step type="range" min="0" step="1" value="0" aria-label="Selected period or state"></label><label class="macro-income-picker" hidden>Income / productivity state <select data-productivity><option value="0">Low</option><option value="1">High</option></select></label><p class="macro-note">Select a point, move this slider, or choose a table row. The equations and other views follow.</p>';
 $('[data-model-nav]').innerHTML=[...new Set(models.map(m=>m.group))].map(g=>`<div class="macro-model-group"><p>${g}</p>${models.filter(m=>m.group===g).map(m=>`<button type="button" data-model="${m.id}" aria-pressed="${m.id===model}"><span>${m.number}</span>${m.title}</button>`).join('')}</div>`).join('');
 $('[data-reading-nav]').innerHTML=['explore','equations','computation','research'].map((mode,i)=>`<button type="button" data-mode="${mode}" aria-pressed="${i===0}">${mode[0].toUpperCase()+mode.slice(1)}</button>`).join('');
 function controlHTML(f){const p=state.params,unit=f.unit?.startsWith('%')||f.unit==='percentage points',display=unit?format(p[f.key]*100):format(p[f.key]);
  if(f.options)return `<label class="macro-control">${escape(f.label)}<select data-param="${f.key}">${f.options.map(([value,label])=>`<option value="${value}" ${String(p[f.key])===String(value)?'selected':''}>${escape(label)}</option>`).join('')}</select></label>`;
  return `<label class="macro-control"><span>${escape(f.label)}<output data-value="${f.key}">${display}${unit?(f.unit==='percentage points'?' pp':'%'):''}</output></span><input type="range" data-param="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${p[f.key]}" aria-valuetext="${display} ${escape(f.unit||'')}"><small>${escape(f.unit||'Dimensionless')}</small></label>`;
 }
 function controls(){const m=byId[state.model];if($('[data-model-select]'))$('[data-model-select]').value=state.model;$('[data-model-title]').textContent=m.title;$('[data-model-question]').textContent=m.question;$('[data-level]').textContent=m.level;$('[data-controls]').innerHTML=m.fields.filter(f=>!f.advanced).map(controlHTML).join('')+`<details class="macro-more"><summary>More parameters</summary>${m.fields.filter(f=>f.advanced).map(controlHTML).join('')}</details>`;}
 const snapshot=()=>({...state,params:state.validParams||state.params});
 function render(){
  if(!state.result)return;
  const focused=doc.activeElement,chartName=focused?.dataset?.chartName,matrixName=focused?.closest?.('[data-matrix-name]')?.dataset.matrixName,rowFocus=focused?.dataset?.row,details=$('[data-reading] details')?.open;
  const result=state.result,max=(result.rows?.length||result.grid?.length||1)-1;state.step=Math.max(0,Math.min(max,Math.round(state.step)));
  const s=snapshot(),host=$('[data-plots]'),flow=$('[data-flow]'),slider=$('[data-inspect-step]');
  $('[data-selection]').hidden=max===0;slider.max=max;slider.value=state.step;slider.setAttribute('aria-valuetext',result.rows?`Period ${state.step}`:`${state.model==='household'?'Assets':'Capital'} ${format(result.grid?.[state.step],4)}`);
  $('[data-inspect-label]').innerHTML=result.rows?`Inspect period <strong>${state.step}</strong>`:`Inspect ${state.model==='household'?'assets':'capital'} <strong>${format(result.grid?.[state.step],4)}</strong>`;
  $('[data-productivity]').parentElement.hidden=!['optimal','household'].includes(state.model);$('[data-productivity]').value=state.productivity;
  $('[data-metrics]').innerHTML=metrics(s).map(([label,value])=>`<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
  if(['solow','ak'].includes(state.model)){flow.hidden=false;drawFlow(flow,result.rows[state.step],state.step,state.params.T,select,state.model==='ak');}else flow.hidden=true;
  host.hidden=false;plots(host,s,select,parameter);renderInspection($('[data-live-math]'),s,format);
  const chips=doc.createElement('div');chips.className='macro-equation-controls';chips.innerHTML=byId[state.model].fields.filter(f=>!f.advanced&&!f.options).slice(0,4).map(f=>`<button type="button" data-focus-param="${f.key}">${escape(f.key)} = ${format(s.params[f.key],4)} <span>adjust ↗</span></button>`).join('');$('[data-live-math]').append(chips);
  $('[data-live]').textContent=interpretation(s);renderReading($('[data-reading]'),s);if(details&&$('[data-reading] details'))$('[data-reading] details').open=true;
  const views=$('[data-view-nav]');if(views)views.hidden=true;
  if(chartName)Array.from(root.querySelectorAll('[data-chart-name]')).find(e=>e.dataset.chartName===chartName)?.focus({preventScroll:true});
  if(matrixName)Array.from(root.querySelectorAll('[data-matrix-name]')).find(e=>e.dataset.matrixName===matrixName)?.querySelector(`[data-matrix-row="${state.step}"][data-matrix-column="${state.params.shockAt}"]`)?.focus({preventScroll:true});
  if(rowFocus!==undefined)$(`[data-row="${state.step}"]`)?.focus({preventScroll:true});
  highlightTerm();
 }
 function select(index){state.step=index;render();}
 function highlightTerm(){root.querySelectorAll('[data-flow-term]').forEach(e=>e.classList.toggle('macro-term-active',e.dataset.flowTerm===state.term));}
 function update(){try{const m=byId[state.model];for(const f of m.fields){const x=state.params[f.key];if(f.options){if(!f.options.some(([v])=>String(v)===String(x)))throw Error(`Choose a valid ${f.label}.`);}else if(!Number.isFinite(x)||x<f.min||x>(state.model==='sequence'&&f.key==='shockAt'?state.params.T:f.max))throw Error(`${f.label} is outside its allowed range.`);}
   const result=solve[state.model](state.params);state.result=result;state.validParams={...state.params};$('[data-error]').hidden=true;render();
  }catch(e){$('[data-error]').textContent=e.message;$('[data-error]').hidden=false;}
 }
 function parameter(key,value,step){const field=byId[state.model].fields.find(f=>f.key===key);if(!field)return;
  if(!field.options)value=Number(Math.min(state.model==='sequence'&&key==='shockAt'?state.params.T:field.max,Math.max(field.min,field.min+Math.round((value-field.min)/field.step)*field.step)).toPrecision(12));
  // The Jacobian can inspect impulses anywhere in the displayed horizon.
  if(state.model==='sequence'&&key==='shockAt')value=Math.min(state.params.T,Math.round(value));
  state.params[key]=value;if(step!==undefined)state.step=step;const input=$(`[data-param="${key}"]`);if(input){input.value=value;const output=$(`[data-value="${key}"]`);if(output){const percent=field.unit?.startsWith('%')||field.unit==='percentage points';output.textContent=(percent?format(100*value):format(value))+(percent?(field.unit==='percentage points'?' pp':'%'):'');input.setAttribute('aria-valuetext',output.textContent);}}update();
 }
 root.addEventListener('input',event=>{const input=event.target;if(input.matches('[data-inspect-step]')){select(Number(input.value));return;}if(!input.matches('[data-param]'))return;
  const key=input.dataset.param,value=key==='kind'?input.value:Number(input.value);state.params[key]=value;if(state.model==='sequence'&&key==='T'){state.params.shockAt=Math.min(state.params.shockAt,value);const shock=$('[data-param="shockAt"]');shock.max=value;shock.value=state.params.shockAt;$('[data-value="shockAt"]').textContent=state.params.shockAt;}const field=byId[state.model].fields.find(f=>f.key===key),output=$(`[data-value="${key}"]`);if(output){const percent=field.unit?.startsWith('%')||field.unit==='percentage points';output.textContent=(percent?format(value*100):format(value))+(percent?(field.unit==='percentage points'?' pp':'%'):'');input.setAttribute('aria-valuetext',output.textContent);}update();
 });
 root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;
  if(button.dataset.model){state.model=button.dataset.model;state.params={...byId[state.model].defaults};state.step=0;state.productivity=0;state.term=null;root.querySelectorAll('[data-model]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.model===state.model)));try{win.history.replaceState(null,'',`#${state.model}`);}catch{}controls();update();if(button.closest('.macro-related'))$('[data-model-title]').scrollIntoView?.({block:'start'});}
  if(button.dataset.mode){state.mode=button.dataset.mode;root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderReading($('[data-reading]'),snapshot());}
  if(button.dataset.row!==undefined)select(Number(button.dataset.row));
  if(button.dataset.term){state.term=button.dataset.term;root.querySelectorAll('[data-term]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('[data-term-explanation]').textContent=button.dataset.explanation;highlightTerm();}
  if(button.dataset.focusParam){const input=$(`[data-param="${button.dataset.focusParam}"]`);input?.closest('details')?.setAttribute('open','');input?.focus();input?.scrollIntoView?.({block:'nearest',behavior:'auto'});}
  if(button.hasAttribute('data-reset')){state.params={...byId[state.model].defaults};state.step=0;state.term=null;controls();update();}
 });
 root.addEventListener('change',event=>{if(event.target.matches('[data-model-select]'))root.querySelector(`[data-model="${event.target.value}"]`)?.click();if(event.target.matches('[data-productivity]')){state.productivity=Number(event.target.value);render();}});
 let resizeFrame,lastWidth=0;const resize=()=>{const width=$('[data-plots]').getBoundingClientRect().width;if(!state.result||Math.abs(width-lastWidth)<1)return;lastWidth=width;if(win?.cancelAnimationFrame)win.cancelAnimationFrame(resizeFrame);resizeFrame=win?.requestAnimationFrame(render);};
 if(win?.ResizeObserver){const ro=new win.ResizeObserver(resize);ro.observe($('[data-plots]'));}
 controls();update();root.macroApp={state};return root.macroApp;
}
