import katex from 'katex';
const num=x=>Number.isFinite(x)?Number(x.toPrecision(5)).toString():'\\text{undefined}';
const math=eq=>katex.renderToString(eq.replace(/(-?\d+(?:\.\d+)?)e([+-]?\d+)/g,'($1\\times 10^{$2})'),{displayMode:true,throwOnError:true,output:'htmlAndMathml'});
export function inspection(state){
 const {model:id,params:p,result:r}=state,i=Math.min(state.step,(r.rows?.length||r.grid?.length||1)-1),v=r.rows?.[i]||r,z=state.productivity||0;
 let symbolic='',numeric='',terms=[],note='',label=r.rows?`Period ${i}`:'Current equilibrium';
 const t=(name,value,explanation)=>({name,value,explanation});
 if(['solow','ak','twoSector'].includes(id)){
  symbolic=String.raw`K_{t+1}=\underbrace{K_t}_{\text{inherited}}+\underbrace{I_t}_{\text{new investment}}-\underbrace{\delta K_t}_{\text{wear}},\quad k_{t+1}=\frac{K_{t+1}}{L_{t+1}}`;
  numeric=String.raw`K_{${i+1}}\approx ${num(v.K)}+${num(v.I)}-${num(v.D)}=${num(v.K1)},\quad k_{${i+1}}\approx\frac{${num(v.K1)}}{${num(v.L1)}}=${num(v.k1)}`;
  terms=[t('K',v.K,'Inherited equipment: a stock already available before production.'),t('I',v.I,'Investment: current output retained as new equipment.'),t('D',-v.D,'Depreciation removes equipment. Population growth does not remove aggregate equipment.')];
  note=`The workforce goes from ${num(v.L)} to ${num(v.L1)}. Dividing by the larger workforce can reduce equipment per worker even when aggregate equipment rises.`;
  if(id==='twoSector'){numeric+=String.raw`\qquad H_{${i+1}}\approx ${num(v.H)}[1+${num(p.eta)}(1-${num(p.u)})]=${num(v.H1)}`;note+=' Skills follow their own education-sector law.';}
 }else if(id==='trap'){
  symbolic=String.raw`\Delta k_t=\frac{sf(k_t)-(n+\delta)k_t}{1+n}`;numeric=String.raw`\Delta k_{${i}}\approx\frac{${num(v.I)}-${num((p.n+p.delta)*v.k)}}{${num(1+p.n)}}=${num(v.k1-v.k)}`;
  terms=[t('Investment',v.I,'Saving finances capital per current worker.'),t('Replacement',-v.D,'Depreciation per current worker.'),t('Dilution',-p.n*v.k,'Extra investment required to equip new workers, before dividing by workforce growth.')];note='The bar shows the numerator of the change equation. Divide by 1+n to get the exact per-worker change.';
 }else if(id==='olg'){
  symbolic=String.raw`w_t=c_t^y+s_t,\quad k_{t+1}=\frac{s_t}{1+n},\quad c_{t+1}^o=R_{t+1}s_t`;
  numeric=String.raw`${num(v.wage)}\approx ${num(v.cy)}+${num(v.saving)},\quad k_{${i+1}}\approx\frac{${num(v.saving)}}{${num(1+p.n)}}=${num(v.k1)}`;
  terms=[t('Young consumption',v.cy,'Consumption from current wages.'),t('Saving',v.saving,'Assets purchased by the young for retirement.')];note=`This cohort’s old-age consumption next period is ${num(v.co)}. It is not current-period aggregate consumption.`;
 }else if(id==='islm'){
  symbolic=String.raw`Y=C+I+G,\quad C=40+c(Y-T),\quad I=60-br`;
  numeric=String.raw`${num(r.Y)}\approx ${num(r.C)}+${num(r.I)}+${num(p.G)},\quad r\approx ${num(r.r)}`;
  terms=[t('Consumption',r.C,'Private consumption at equilibrium output.'),t('Investment',r.I,'Investment at the clearing interest rate.'),t('Government',p.G,'Government goods purchases.')];note='Choose a point on the fiscal experiment to set government purchases and solve both markets again.';
 }else if(id==='nk'){
  symbolic=String.raw`x_t=E_tx_{t+1}-\frac{i_t-E_t\pi_{t+1}-r_t^n}{\sigma}`;
  numeric=String.raw`${num(v.x)}\approx ${num(p.rho*v.x)}-\frac{${num(v.i)}-${num(p.rho*v.pi)}-${num(v.rn)}}{${num(p.sigma)}}`;
  terms=[t('Expected output',p.rho*v.x,'Next-period expected output gap.'),t('Real-rate channel',-(v.i-p.rho*v.pi-v.rn)/p.sigma,'Demand effect of the policy rate net of expected inflation and the natural rate.')];note='Equation and contribution values use decimal deviations; the impulse-response chart uses percentage points.';
 }else if(id==='debt'){
  symbolic=String.raw`\Delta b_t=\underbrace{\frac{r-g}{1+g}b_t}_{\text{interest-growth effect}}-p`;
  numeric=String.raw`\Delta b_{${i}}\approx ${num(v.carry)}-${num(p.p)}=${num(v.b1-v.b)}`;
  terms=[t('Interest-growth effect',v.carry,'Interest and GDP growth jointly change the debt ratio.'),t('Primary balance',-p.p,'A positive primary surplus reduces debt.')];note='Balances are fractions of next-period GDP; charts convert them to percentage points.';
 }else if(['ramsey','rbc'].includes(id)){
  const delta=id==='rbc'?1:p.delta;
  symbolic=String.raw`c_t+k_{t+1}=y_t+(1-\delta)k_t`;
  numeric=String.raw`${num(v.c)}+${num(v.k1)}\approx ${num(v.y)}+${num((1-delta)*v.k)}`;
  terms=[t('Output',v.y,'Goods produced this period.'),t('Surviving capital',(1-delta)*v.k,'Undepreciated capital can be carried forward.'),t('Consumption',-v.c,'Resources consumed instead of carried forward.')];
  note=id==='ramsey'?`Relative Euler discrepancy at this date: ${num(v.euler)}. This measures the interpolated policy’s first-order-condition error, separately from its Bellman residual.`:'With full depreciation, all next-period equipment must come from current output. The exact optimal saving share is αβ.';
 }else if(id==='openEconomy'){
  symbolic=String.raw`CA_0=rb_0+y_0-c_0,\quad b_1=b_0+CA_0`;
  numeric=String.raw`CA_0\approx ${num(p.r*p.b0)}+${num(p.y0)}-${num(r.c0)}=${num(r.ca)},\quad b_1\approx ${num(r.b1)}`;
  terms=[t('Asset income',p.r*p.b0,'Interest on the inherited foreign-asset position.'),t('Endowment',p.y0,'Current output available without production decisions.'),t('Consumption',-r.c0,'Current spending on the tradable good.')];note='A negative current account is a reduction in net foreign assets. The terminal foreign-asset position is zero.';
 }else if(id==='matching'){
  symbolic=String.raw`\Delta u_t=s(1-u_t)-f(\theta)u_t`;
  numeric=String.raw`\Delta u_{${i}}\approx ${num(v.inflow)}-${num(v.outflow)}=${num(v.u1-v.u)}`;
  terms=[t('Job losses',v.inflow,'Employed workers entering unemployment.'),t('Job finding',-v.outflow,'Unemployed workers finding jobs.')];note='Contributions are shares of the whole workforce. Job finding and separation are probabilities conditional on beginning-period status.';
 }else if(id==='sequence'){
  const s=p.shockAt;symbolic=String.raw`dY_t=M_{t,s}\,dG_s,\quad dC_t=\sum_j J_{tj}dY_j`;
  numeric=String.raw`dY_{${i}}\approx ${num(r.M[i][s])}\times ${num(p.shock)}=${num(v.y)},\quad dY_{${i}}=dC_{${i}}+dG_{${i}}`;
  terms=[t('Consumption feedback',v.c,'All rounds of induced consumption, after equilibrium feedback.'),t('Spending impulse',v.g,'Exogenous goods demand at this date.')];note=`Inspecting response date ${i} to the impulse at date ${s}. Matrix entries are derivatives; multiplying by the impulse gives the level response.`;
 }else{
  const k=r.grid[i],next=r.policy[z][i],c=r.consumption[z][i],income=id==='household'?p.w*r.z[z]:r.z[z]*k**p.alpha,carry=id==='household'?(1+p.r)*k:(1-p.delta)*k;
  label=`${id==='household'?'Assets':'Capital'} ${num(k)} · productivity ${num(r.z[z])}`;
  symbolic=id==='household'?String.raw`c+a'=wz+(1+r)a`:String.raw`c+k'=zk^\alpha+(1-\delta)k`;
  numeric=String.raw`${num(c)}+${num(next)}\approx ${num(income)}+${num(carry)}`;
  terms=[t('Income / output',income,'Current income or production in the selected state.'),t('Carried resources',carry,'Resources from the inherited asset or capital stock.'),t('Consumption',-c,'Optimal consumption on the selected finite grid.')];
  const ev=r.P[z].reduce((sum,pr,j)=>{const ix=r.grid.indexOf(next);return sum+pr*r.value[j][ix];},0),u=p.gamma===1?Math.log(c):(c**(1-p.gamma)-1)/(1-p.gamma);
  const util=u;
  symbolic+=String.raw`\qquad V=u(c)+\beta E[V']`;
  numeric+=String.raw`\qquad ${num(r.value[z][i])}\approx ${num(util)}+${num(p.beta)}\times ${num(ev)}`;
  note=id==='household'?`Selected state carries probability mass ${num(r.distribution[z][i])}. Choices maximize the finite-grid Bellman objective at fixed prices.`:'Selecting a capital stock changes both policy plots and this Bellman calculation. It does not change the solved policy.';
 }
 return {index:i,label,symbolic,numeric,terms,note};
}
export function renderInspection(host,state,format){
 const q=inspection(state);host.dataset.period=q.index;host.dataset.model=state.model;
 host.innerHTML=`<header><h3>One state, connected views</h3><output>${q.label}</output></header><div class="macro-equation">${math(q.symbolic)}</div><div class="macro-equation macro-substitution">${math(q.numeric)}</div><p class="macro-rounding">Substitutions are rounded; the calculation uses full precision.</p><div class="macro-contributions" aria-label="Contributions to the selected accounting identity"></div><p class="macro-note">${q.note}</p><p class="macro-term-explanation" data-term-explanation></p>`;
 const bars=host.querySelector('.macro-contributions'),max=Math.max(1e-15,...q.terms.map(t=>Math.abs(t.value)));
 q.terms.forEach(term=>{const b=host.ownerDocument.createElement('button');b.type='button';b.className='macro-contribution';b.dataset.term=term.name;b.dataset.explanation=term.explanation;b.setAttribute('aria-pressed',String(state.term===term.name));b.innerHTML=`<span>${term.name}</span><i style="--amount:${Math.abs(term.value)/max*100}%;--bar:${term.value<0?'var(--macro-rust)':'var(--macro-blue)'}"></i><strong>${format(term.value,5)}</strong>`;bars.append(b);});
 const chosen=q.terms.find(t=>t.name===state.term);host.querySelector('[data-term-explanation]').textContent=chosen?.explanation||'Select a contribution to inspect its economic meaning.';
}
