/** Model-specific questions. Pure comparisons and identities, not additional equilibria. */
import {grid,solow,islm,trapOutput} from './macroeconomics.mjs';
import {twoSector} from './macroeconomics-extended.mjs';
const f=x=>new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(x);
const percent=x=>`${f(100*x)}%`;
const values=(rows,fn)=>rows.map(v=>({x:v.t,y:fn(v)}));
const part=(id,label,value,explanation)=>({id,label,value,explanation});
const timeChart=(title,yLabel,series,step)=>({title,xLabel:'Period',yLabel,series,selection:{kind:'period',value:step,step:1}});
export function buildInsight(state){
 const {model:id,result:r,params:p,step=0,productivity:z=0}=state,v=r.rows?.[step];
 if(id==='solow'){
  const s=Number((p.s+(p.s<=.5?.1:-.1)).toFixed(4)),alt=solow({...p,s}),current=v.C/(v.A*v.L),other=alt.rows[step].C/(alt.rows[step].A*alt.rows[step].L);
  return {question:'When does extra saving pay back its consumption cost?',answer:`At period ${step}, consumption per effective worker is ${f(current)} with saving of ${percent(p.s)}, versus ${f(other)} with ${percent(s)}.`,experiment:{s},
   equation:String.raw`c_t=(1-s)Bq_t^\alpha,\qquad q_t=K_t/(A_tL_t)`,
   chart:timeChart('The consumption tradeoff', 'Goods / effective worker / period',[{name:`Current saving · ${percent(p.s)}`,values:values(r.rows,x=>x.C/(x.A*x.L))},{name:`Comparison · ${percent(s)}`,dash:true,values:values(alt.rows,x=>x.C/(x.A*x.L))}],step),
   note:'Both paths start with the same equipment, workforce and efficiency. Only saving differs. A later consumption gain does not by itself establish a welfare improvement; discounting and the entire transition matter.'};
 }
 if(id==='ak'){
  const threshold=(p.n+p.delta)/p.a;
  const chart=timeChart('Aggregate growth versus living standards','Initial value = 100',[{name:'Total capital',values:values(r.rows,x=>100*x.K/r.rows[0].K)},{name:'Capital / worker',values:values(r.rows,x=>100*x.k/r.rows[0].k)},{name:'Workforce',dash:true,values:values(r.rows,x=>100*x.L/r.rows[0].L)}],step);chart.zero=false;
  return {question:'Can the economy grow while each worker gets poorer?',threshold,
   answer:`At period ${step}, total capital is ${f(100*v.K/r.rows[0].K)} and capital per worker is ${f(100*v.k/r.rows[0].k)} on a common starting index of 100. Break-even saving per worker is ${percent(threshold)}${threshold>.6?'—outside the available saving control':''}.`,
   equation:String.raw`\frac{k_t}{k_0}=\left(\frac{1+sa-\delta}{1+n}\right)^t,\qquad s_{\rm break\ even}=\frac{n+\delta}{a}`,
   chart,
   note:'These are indexes, not comparable raw levels of machines and people. In this AK technology, output per worker and consumption per worker grow at the same rate as capital per worker when saving is fixed.'};
 }
 if(id==='trap'){
  const threshold=r.roots.find(x=>!x.stable)?.k??null,requiredPush=threshold===null?null:Math.max(0,threshold-p.k0),xs=grid(2,140),drift=k=>(p.s*trapOutput(k,p)-(p.n+p.delta)*k)/(1+p.n);
  return {question:'How large a push changes the direction of development?',threshold,requiredPush,
   answer:threshold===null?'These parameters do not produce a positive unstable threshold.':p.k0>threshold?`Initial capital is already above the unstable threshold of ${f(threshold)}.`:`Initial capital needs a push greater than ${f(requiredPush)} to cross the unstable threshold of ${f(threshold)}.`,
   equation:String.raw`\Delta k=\frac{sf(k)-(n+\delta)k}{1+n}`,
   chart:{title:'Where capital grows and where it shrinks',xLabel:'Initial capital / worker',yLabel:'Next-period change in capital / worker',series:[{name:'Net accumulation',values:xs.map(x=>({x,y:drift(x)}))},{name:'No change',dash:true,values:xs.map(x=>({x,y:0}))}],points:r.roots.filter(x=>x.k<=140).map(x=>({x:x.k,y:0})),selection:{kind:'parameter',key:'k0',value:p.k0,step:1}},
   note:'Select initial capital on this plot to change the experiment. Escape requires moving strictly above an unstable crossing. The fixed adoption cost F is a different threshold; an unstable crossing can lie beyond the displayed 2–140 range.'};
 }
 if(id==='olg'){
  return {question:'What does today’s saving buy for this particular cohort?',
   answer:`A young household earns ${f(v.wage)}, consumes ${f(v.cy)}, and saves ${f(v.saving)}. Those savings buy ${f(v.co)} of consumption when old.`,
   equation:String.raw`w_t=c_t^y+s_t,\qquad c_{t+1}^o=R_{t+1}s_t`,
   parts:[part('young','Consume when young',v.cy,'Current consumption by this cohort, at the selected date.'),part('saving','Save when young',v.saving,'Together with current young consumption, this equals the current wage.'),part('old','Consume when old',v.co,'Next-generation retirement consumption by the same people. Do not add it to today’s output.')],unit:'Goods per member of this cohort',
   note:`The last bar belongs to the next date; the three bars are not an aggregate resource sum. Steady-state gross return ${f(r.R)} versus cohort growth ${f(1+p.n)} implies ${r.efficient?'no steady-state overaccumulation':'steady-state overaccumulation'} in this model. This is not a transition welfare ranking.`};
 }
 if(id==='islm'){
  const change=p.G<=190?10:-10,other=islm({...p,G:p.G+change}),dC=other.C-r.C,dI=other.I-r.I,total=other.Y-r.Y;
  return {question:'Where does the extra government spending actually go?',total,
   answer:`Changing government purchases by ${f(change)} changes equilibrium output by ${f(total)}: consumption changes by ${f(dC)}, and investment by ${f(dI)}.`,
   equation:String.raw`\Delta Y=\Delta G+\Delta C+\Delta I`,unit:'Change in goods / period',
   parts:[part('government','Government purchases',change,'The imposed change in government demand.'),part('consumption','Induced consumption',dC,'Households change consumption as equilibrium income changes, at fixed taxes.'),part('investment','Interest-rate crowding out',dI,'The clearing interest rate changes investment. This channel is absent from the fixed-interest-rate Keynesian cross.')],
   note:`Comparison: G = ${f(p.G)} versus ${f(p.G+change)}, with taxes and real balances unchanged. Negative investment feedback offsets part of an expansion. At the upper control limit the comparison is a spending reduction.`};
 }
 if(id==='nk'){
  // Homogeneous expectational matrix; unlike the forced response, it never divides by a shock-dependent coefficient determinant.
  const roots=phi=>{const a=1+(p.phiX+p.kappa/p.beta)/p.sigma,b=(phi-1/p.beta)/p.sigma,c=-p.kappa/p.beta,d=1/p.beta,tr=a+d,det=a*d-b*c,disc=tr*tr-4*det;return (disc>=0?[Math.abs((tr+Math.sqrt(disc))/2),Math.abs((tr-Math.sqrt(disc))/2)]:[Math.sqrt(det),Math.sqrt(det)]).sort((x,y)=>x-y);},xs=grid(0,3,121);
  return {question:'Does the policy rule select a unique bounded response?',
   answer:`At the current rule, the two expectational root moduli are ${r.eigenModuli.map(f).join(' and ')}. ${r.determinate?'Both exceed one.':'At least one does not exceed one.'}`,
   equation:String.raw`|\lambda_1(A)|>1,\quad |\lambda_2(A)|>1\quad\text{(two jump variables)}`,
   chart:{title:'Policy strength and the uniqueness boundary',xLabel:'Response to inflation, φπ',yLabel:'Expectational eigenvalue modulus',zero:false,series:[{name:'Smaller modulus',values:xs.map(x=>({x,y:roots(x)[0]}))},{name:'Larger modulus',values:xs.map(x=>({x,y:roots(x)[1]}))},{name:'Unit circle',dash:true,values:xs.map(x=>({x,y:1}))}],selection:{kind:'parameter',key:'phiPi',value:p.phiPi,step:.05}},
   note:'Select policy strength to update the response paths. This is a determinacy test for the two-jump-variable system, not a claim that economic responses explode. Under indeterminacy, the displayed shock response is only a particular solution.'};
 }
 if(id==='debt'){
  const interest=100*p.r*v.b/(1+p.g),growth=-100*p.g*v.b/(1+p.g),primary=-100*p.p;
  return {question:'Is debt rising because of interest, growth, or the budget?',answer:`At period ${step}, the debt ratio changes by ${f(100*(v.b1-v.b))} percentage points.`,total:100*(v.b1-v.b),unit:'Percentage points of GDP',
   equation:String.raw`\Delta b_t=\frac{r b_t}{1+g}-\frac{g b_t}{1+g}-p`,
   parts:[part('interest','Interest on inherited debt',interest,'Interest adds to debt, normalized by next-period GDP.'),part('growth','Growth of the economy',growth,'GDP growth changes the denominator. It does not repay the nominal debt stock.'),part('balance','Primary budget balance',primary,'A primary surplus reduces the ratio; a primary deficit increases it.')],
   note:'All contributions use next-period GDP. Negative debt denotes net public assets, which reverses some signs. The interest and growth contributions cancel when r = g.'};
 }
 if(id==='optimal'){
  const k=r.grid[step],resources=r.z[z]*k**p.alpha+(1-p.delta)*k,u=c=>p.gamma===1?Math.log(c):(c**(1-p.gamma)-1)/(1-p.gamma),objective=r.grid.flatMap((next,i)=>{const c=resources-next;return c>0?[{x:next,y:u(c)+p.beta*r.P[z].reduce((sum,pr,j)=>sum+pr*r.value[j][i],0)-r.value[z][step]}]:[];});
  return {question:'Why does the optimizer pick this amount of saving?',answer:`At capital ${f(k)} and productivity ${f(r.z[z])}, the selected policy carries ${f(r.policy[z][step])} into the next period.`,
   equation:String.raw`Q(k')-V(k,z)=u(c)+\beta\sum_{z'}P_{zz'}V(k',z')-V(k,z)`,
   chart:{title:'The feasible choice landscape',xLabel:'Candidate next-period capital',yLabel:'Bellman objective minus current value',series:[{name:'Value of each feasible choice',values:objective}],selectedX:r.policy[z][step]},
   note:'The highest point identifies the finite-grid policy; candidates with nonpositive consumption are omitted. Move the shared capital slider or switch productivity to change the decision problem. A near-zero peak reflects the Bellman residual, not continuous-state accuracy.'};
 }
 if(id==='ramsey'){
  const fixedShare=p.delta*r.steady/r.steady**p.alpha;let k=r.rows[0].k;const fixed=r.rows.map(x=>{const y=k**p.alpha,c=(1-fixedShare)*y;k=(1-p.delta)*k+fixedShare*y;return {t:x.t,c};});
  return {question:'What changes when saving is a decision instead of a fixed rule?',answer:`At period ${step}, optimized consumption is ${f(v.c)} versus ${f(fixed[step].c)} under a fixed saving share of ${percent(fixedShare)}.`,
   equation:String.raw`s_{\rm fixed}=\frac{\delta k^*}{(k^*)^\alpha},\qquad c_t^{\rm fixed}=(1-s_{\rm fixed})k_t^\alpha`,
   chart:timeChart('Two paths to the same analytical steady capital','Goods / worker / period',[{name:'Computed optimal policy',values:values(r.rows,x=>x.c)},{name:'Fixed saving benchmark',dash:true,values:values(fixed,x=>x.c)}],step),
   note:'Both economies start with the same capital. The fixed saving share targets the same analytical steady capital, but need not satisfy the transition Euler equation. Consumption at one date and a truncated plot do not establish a welfare ranking.'};
 }
 if(id==='twoSector'){
  const other=twoSector({...p,u:1}),cross=r.rows.find(x=>x.c>other.rows[x.t].c+1e-10)?.t;
  return {question:'When does time spent learning overtake time spent producing?',answer:p.u===1?'Both paths allocate all time to goods production.':cross===undefined?'Consumption has not overtaken the all-production comparison within this horizon.':`Consumption first overtakes the all-production comparison at period ${cross}.`,
   equation:String.raw`Y_t=K_t^\alpha(uH_tL_t)^{1-\alpha},\qquad \Delta H_t=\eta(1-u)H_t`,
   chart:timeChart('The education investment payback','Consumption / worker / period',[{name:`Learning share · ${percent(1-p.u)}`,values:values(r.rows,x=>x.c)},{name:'All time producing · no learning',dash:true,values:values(other.rows,x=>x.c)}],step),
   note:'Same initial equipment, skills and workforce; same saving and growth rates. Only the time allocation differs. The first crossing is a comparison within the displayed horizon, not an optimal schooling choice or a discounted welfare payback.'};
 }
 if(id==='rbc'){
  const direct=100*Math.log(v.z),capital=100*p.alpha*Math.log(v.k/r.steady);
  return {question:'How much of the response is the shock, and how much is inherited capital?',answer:`At period ${step}, output is ${f(v.yHat)} log percentage points from steady state.`,total:v.yHat,unit:'100 × log deviation',
   equation:String.raw`100\log(y_t/y^*)=100\log z_t+100\alpha\log(k_t/k^*)`,
   parts:[part('productivity','Current productivity',direct,'The direct contribution of the current productivity deviation.'),part('capital','Capital built in earlier periods',capital,'Propagation through inherited capital. At period zero, this contribution is zero because capital is predetermined.')],
   note:'This decomposition is exact in logs for Cobb–Douglas production. Set shock persistence to zero, then select period 1: output can still respond through capital even after productivity returns to normal.'};
 }
 if(id==='openEconomy'){
  return {question:'How much does international borrowing smooth consumption?',answer:`Endowment income moves from ${f(p.y0)} to ${f(p.y1)} while consumption moves from ${f(r.c0)} to ${f(r.c1)}. The current account is ${f(r.ca)}.`,
   equation:String.raw`c_0=y_0+(1+r)b_0-b_1,\qquad c_1=y_1+(1+r)b_1`,unit:'Goods at each date',
   groups:[{label:'Current period',bars:[{label:'Endowment',value:p.y0},{label:'Consumption',value:r.c0}]},{label:'Future period',bars:[{label:'Endowment',value:p.y1},{label:'Consumption',value:r.c1}]}],
   note:'Compare within each date. Consumption can differ from endowment because of asset income and borrowing or lending; the bars are not a resource sum. Greater patience or a higher interest rate can tilt consumption toward the future rather than making it flat.'};
 }
 if(id==='matching'){
  return {question:'How can unemployment look stable while many people change jobs?',answer:`Per 100 workers in period ${step}, ${f(100*v.inflow)} lose jobs and ${f(100*v.outflow)} find them. Net unemployment changes by ${f(100*(v.u1-v.u))}.`,
   equation:String.raw`u_{t+1}=u_t+s(1-u_t)-f(\theta)u_t`,
   flow:{employed:100*(1-v.u),unemployed:100*v.u,lose:100*v.inflow,find:100*v.outflow,nextEmployed:100*(1-v.u1),nextUnemployed:100*v.u1},
   note:'The boxes represent beginning-period stocks and the arrows represent workers changing status. No person both loses and finds a job within this period. At steady state the opposing flows balance; both can remain large.'};
 }
 if(id==='household'){
  let constraintMass=0;for(let j=0;j<2;j++)for(let i=0;i<r.grid.length;i++)if(r.policy[j][i]===r.grid[0])constraintMass+=r.distribution[j][i];
  return {question:'Who is building a buffer, and who ends the period with no assets?',constraintMass,
   answer:`${percent(constraintMass)} of the joint distribution chooses zero next-period assets. At the selected state, assets change by ${f(r.policy[z][step]-r.grid[step])}.`,
   equation:String.raw`\Delta a=g(a,z)-a,\qquad \Pr(a'=0)=\sum_{a,z}\mu(a,z)\mathbf1\{g(a,z)=0\}`,
   chart:{title:'Saving and drawing down the buffer',xLabel:'Current assets',yLabel:'Change in assets',selectedSeries:z,series:r.z.map((income,j)=>({name:`Income state ${f(income)}`,values:r.grid.map((a,i)=>({x:a,y:r.policy[j][i]-a}))})).concat([{name:'No asset change',dash:true,values:r.grid.map(a=>({x:a,y:0}))}]),selection:{kind:'capital',value:r.grid[step],step:r.grid[1]-r.grid[0]}},
   note:'Positive drift builds assets; negative drift spends them down. Choosing the borrowing bound on a finite grid does not establish a positive continuous-model constraint multiplier. Distribution mass and policies are both recomputed when parameters change.'};
 }
 if(id==='sequence'){
  const g=r.rows.map(x=>x.g),apply=x=>r.J.map(row=>row.reduce((sum,j,i)=>sum+j*x[i],0)),first=apply(g),second=apply(first),rest=v.y-g[step]-first[step]-second[step];
  return {question:'How much of the multiplier comes from repeated feedback?',answer:`At response date ${step}, an impulse at date ${p.shockAt} produces ${f(v.y)} units of total output response.`,total:v.y,unit:'Goods deviation at the selected response date',
   equation:String.raw`dY=dG+JdG+J^2dG+\underbrace{(J^3+J^4+\cdots)dG}_{\text{remaining feedback}}`,
   parts:[part('direct','Direct government impulse',g[step],'Spending that arrives directly at this response date.'),part('first','First round of consumption',first[step],'J applied once to the entire government-spending sequence.'),part('second','Second round',second[step],'Consumption induced by the first round of income feedback.'),part('remaining','All remaining rounds',rest,'The exact total response minus the direct, first and second rounds; no finite truncation is used for the total.')],
   note:'Changing delay reallocates these rounds across dates. Before the impulse, every contribution is zero because this illustrative kernel has no anticipation. The decomposition also works for a negative impulse.'};
 }
 throw new Error(`No companion view for ${id}.`);
}
