import {grid} from '../lib/macroeconomics.mjs';
import {matching,openEconomy,twoSector} from '../lib/macroeconomics-extended.mjs';
const nearest=(values,x)=>values.reduce((best,v,i)=>Math.abs(v-x)<Math.abs(values[best]-x)?i:best,0);
export function extendedMetrics({model:id,result:r},f,pct){
 switch(id){
 case 'twoSector':return [['Skill growth / period',pct(r.hGrowth)],['Initial output / worker',f(r.rows[0].y)],['Final output / worker',f(r.rows.at(-1).y)]];
 case 'ramsey':return [['Analytic steady capital',f(r.steady,3)],['Bellman residual',f(r.residual)],['Max relative Euler error',f(r.eulerResidual,4)]];
 case 'rbc':return [['Optimal saving share',pct(r.saving)],['Initial output response',`${f(r.rows[0].yHat)} log %`],['Predetermined capital',f(r.steady,4)]];
 case 'openEconomy':return [['Current consumption',f(r.c0,3)],['Future consumption',f(r.c1,3)],['Current account',f(r.ca,3)]];
 case 'matching':return [['Job-finding probability',pct(r.finding)],['Steady unemployment',pct(r.steady)],['Steady vacancies / workforce',pct(r.vStar)]];
 case 'household':return [['Mean assets',f(r.meanAssets,3)],['Wealth Gini',r.gini===null?'Undefined':f(r.gini,3)],['Mass at asset ceiling',pct(r.topMass)]];
 case 'sequence':return [['Impact multiplier',f(r.impact,3)],['Within-horizon sum',f(r.cumulative,3)],['Infinite-horizon sum',f(r.infinite,3)]];
 }
}
export function extendedInterpretation({model:id,result:r},f,pct){
 if(id==='twoSector')return `Skill growth is ${pct(r.hGrowth)} per period. Production time is held fixed; this experiment does not optimize education.`;
 if(id==='ramsey')return `Bellman residual ${f(r.residual)}; maximum relative Euler discrepancy along this interpolated path ${f(r.eulerResidual,5)}. ${r.boundary} grid-edge choices. Refine the grid before interpreting small policy differences.`;
 if(id==='rbc')return 'Analytical benchmark: fixed labor, log utility and full depreciation. Curves trace one innovation with no subsequent surprises; they are not an estimated business-cycle forecast.';
 if(id==='openEconomy')return `The present-value and terminal-budget residual is ${f(r.residual)}. Net foreign assets after current consumption: ${f(r.b1,4)} goods.`;
 if(id==='matching')return 'The Beveridge curve contains steady states. The transition curve can lie away from it. Vacancies per unemployed worker are a control; wages and vacancy creation are not solved.';
 if(id==='household')return `${r.converged?'Finite-grid iterations converged.':'Iteration limit reached; inspect residuals.'} Bellman residual ${f(r.residual)}; invariant-distribution residual ${f(r.distributionResidual)}; value-error bound ${f(r.errorBound)}. Prices are fixed. ${pct(r.topMass)} of probability mass is at the upper asset bound.`;
 return `Goods-market residual ${f(r.residual)}. The specified consumption kernel illustrates composition and inversion of Jacobians; it is not a solved heterogeneous-agent general equilibrium.`;
}
export function extendedPlots(host,state,{drawChart,select,parameter,format}){
 const {model:id,result:r,params:p}=state,row=r.rows?.[state.step];
 const chart=opts=>drawChart(host,opts),series=(key,mul=1)=>r.rows.map(x=>({x:x.t,y:x[key]*mul}));
 const path=(title,keys,yLabel)=>chart({title,xLabel:'Period',yLabel,selectedX:state.step,onSelect:x=>select(Math.round(x)),selectKey:'period',series:keys.map(([name,key,mul=1])=>({name,values:series(key,mul)}))});
 const capital=(key='k')=>({selectedX:row[key],onSelect:x=>select(nearest(r.rows.map(q=>q[key]),x)),selectKey:'state',selectStep:row[key]/20});
 if(id==='twoSector'){
  path('Goods available per worker',[['Output','y'],['Consumption','c']],'Goods / worker / period');
  path('Skills accumulate through education',[['Skills / worker','H']],'Skills / worker');
  const us=grid(.05,1,61),values=us.map(u=>{const q=twoSector({...p,u}).rows[state.step];return {x:u*100,y:q.y};});
  chart({title:`Production time and output in period ${state.step}`,xLabel:'Time producing goods (%)',yLabel:'Output / worker',selectedX:p.u*100,onSelect:x=>parameter('u',x/100),selectKey:'u',selectStep:5,series:[{name:'Output at selected date',values}]});
 }else if(id==='ramsey'){
  const consumption=r.grid.map((k,i)=>({x:k,y:k**p.alpha+(1-p.delta)*k-r.policy[0][i]}));
  chart({title:'Consumption policy and capital replacement',xLabel:'Capital / worker',yLabel:'Consumption / worker / period',...capital(),series:[{name:'Computed consumption policy',values:consumption},{name:'Δk = 0: output less depreciation',dash:true,values:r.grid.map(k=>({x:k,y:k**p.alpha-p.delta*k}))}],points:[{x:r.steady,y:r.cStar},{x:row.k,y:row.c}]});
  path('The capital transition',[['Capital / worker','k']],'Capital / worker');
  path('Consumption along the computed policy',[['Consumption / worker','c']],'Goods / worker / period');
  path('Numerical Euler discrepancy',[['1 − discounted marginal return','euler']],'Relative residual');
 }else if(id==='rbc'){
  path('The impulse response',[['Output','yHat'],['Consumption','cHat'],['Capital','kHat']],'100 × log deviation');
  chart({title:'Capital propagates the productivity shock',xLabel:'Capital / worker',yLabel:'Next-period capital / worker',...capital(),series:[{name:`Policy at z = ${format(row.z,3)}`,values:grid(Math.min(r.steady*.7,row.k*.8),Math.max(r.steady*1.5,row.k*1.2)).map(k=>({x:k,y:p.alpha*p.beta*row.z*k**p.alpha}))},{name:'Unchanged capital',dash:true,values:grid(Math.min(r.steady*.7,row.k*.8),Math.max(r.steady*1.5,row.k*1.2),2).map(k=>({x:k,y:k}))}],points:[{x:row.k,y:row.k1}]});
 }else if(id==='openEconomy'){
  chart({title:'The intertemporal consumption allocation',xLabel:'Current consumption',yLabel:'Future consumption',series:[{name:'Lifetime budget',values:grid(0,r.wealth).map(c=>({x:c,y:r.R*(r.wealth-c)}))},{name:'Euler condition',values:grid(0,r.wealth).map(c=>({x:c,y:r.ratio*c}))}],points:[{x:r.c0,y:r.c1}]});
  chart({title:'Future income changes current spending',xLabel:'Future endowment',yLabel:'Current goods',selectedX:p.y1,onSelect:x=>parameter('y1',x),selectKey:'y1',selectStep:.05,series:[{name:'Current consumption',values:grid(.5,3,61).map(y1=>({x:y1,y:openEconomy({...p,y1}).c0}))},{name:'Current account',values:grid(.5,3,61).map(y1=>({x:y1,y:openEconomy({...p,y1}).ca}))}]});
 }else if(id==='matching'){
  path('Unemployment and employment flows',[['Unemployment','u',100]],'% of workforce');
  const locus=grid(.05,4).map(theta=>{const q=matching({...p,theta,T:1});return {theta,x:q.steady*100,y:q.vStar*100};}).sort((a,b)=>a.x-b.x);
  chart({title:'The Beveridge locus and current labor market',xLabel:'Unemployment (% workforce)',yLabel:'Vacancies (% workforce)',selectedX:r.steady*100,onSelect:x=>parameter('theta',locus[nearest(locus.map(q=>q.x),x)].theta),selectKey:'theta',selectStep:.1,series:[{name:'Steady-state locus',values:locus}],points:[{x:row.u*100,y:row.v*100}]});
  path('Workers entering and leaving unemployment',[['Job losses','inflow',100],['Job finding','outflow',100]],'% of workforce / period');
 }else if(id==='household'){
  const linkage={selectedX:r.grid[state.step],onSelect:x=>select(nearest(r.grid,x)),selectKey:'capital',selectStep:r.grid[1]-r.grid[0]};
  for(const [key,title,yLabel] of [['policy','Assets carried into the next period','Next-period assets'],['consumption','Consumption by income and wealth','Consumption'],['distribution','The invariant wealth distribution','Probability mass at grid point']])chart({title,xLabel:'Current assets',yLabel,...linkage,selectedSeries:state.productivity,series:r.z.map((z,j)=>({name:`Income state ${format(z)}`,values:r.grid.map((x,i)=>({x,y:r[key][j][i]}))}))});
  chart({title:'How concentrated is wealth?',xLabel:'Cumulative population share',yLabel:'Cumulative wealth share',selectedX:r.lorenz[state.step+1].x,onSelect:x=>select(Math.max(0,nearest(r.lorenz.map(q=>q.x),x)-1)),selectKey:'quantile',selectStep:.05,series:[{name:'Lorenz curve',values:r.lorenz},{name:'Equal shares',dash:true,values:[{x:0,y:0},{x:1,y:1}]}]});
 }else if(id==='sequence'){
  path('Direct impulse and equilibrium propagation',[['Output response','y'],['Consumption response','c'],['Spending impulse','g']],'Goods deviation');
  matrix(host,r.J,'Consumption Jacobian J',state,parameter,format);
  matrix(host,r.M,'Equilibrium multiplier M = (I − J)⁻¹',state,parameter,format);
 }
}
function matrix(host,values,title,state,parameter,format){
 const doc=host.ownerDocument,NS='http://www.w3.org/2000/svg',make=(tag,attrs,text)=>{const e=doc.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;return e;};
 const figure=doc.createElement('figure');figure.className='macro-matrix';const caption=doc.createElement('figcaption');caption.textContent=title;figure.append(caption);
 const n=values.length,w=520,pad=52,size=(w-pad-16)/n,peak=Math.max(...values.flat(),1e-10),svg=make('svg',{viewBox:`0 0 ${w} ${w+4}`,role:'group','aria-label':`${title}. Column is impulse date; row is response date.`});svg.dataset.matrixName=title;figure.append(svg);
 svg.append(make('text',{x:pad+(w-pad)/2,y:17,'text-anchor':'middle',class:'macro-axis'},'Impulse date →'));
 svg.append(make('text',{transform:`translate(13 ${w/2}) rotate(-90)`,'text-anchor':'middle',class:'macro-axis'},'Response date →'));
 for(let i=0;i<n;i++){if(i%5===0||i===n-1){svg.append(make('text',{x:pad+(i+.5)*size,y:40,'text-anchor':'middle',class:'macro-tick'},String(i)));svg.append(make('text',{x:44,y:pad+(i+.65)*size,'text-anchor':'end',class:'macro-tick'},String(i)));}
 for(let j=0;j<n;j++){const selected=i===state.step&&j===state.params.shockAt,cell=make('rect',{x:pad+j*size,y:pad+i*size,width:size-.5,height:size-.5,fill:`color-mix(in srgb, var(--macro-blue) ${values[i][j]/peak*90}%, var(--white))`,stroke:selected?'var(--ink)':'none','stroke-width':2,role:'button',tabindex:selected?'0':'-1','aria-label':`Response ${i}, impulse ${j}: ${format(values[i][j],5)}`,'data-matrix-row':i,'data-matrix-column':j});
 cell.append(make('title',{},`∂ response ${i} / ∂ impulse ${j} = ${format(values[i][j],6)}`));cell.addEventListener('click',()=>parameter('shockAt',j,i));cell.addEventListener('keydown',event=>{let row=i,col=j;if(event.key==='ArrowRight')col++;else if(event.key==='ArrowLeft')col--;else if(event.key==='ArrowDown')row++;else if(event.key==='ArrowUp')row--;else if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();parameter('shockAt',Math.max(0,Math.min(n-1,col)),Math.max(0,Math.min(n-1,row)));});svg.append(cell);}}
 const note=doc.createElement('p');note.className='macro-note';note.textContent=`Darker cells mean larger responses (0 to ${format(peak,3)}). Click a cell or use arrow keys to move through dates. Each matrix uses its own color scale.`;figure.append(note);host.append(figure);
}
