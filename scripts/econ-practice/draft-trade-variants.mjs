// Standalone draft authoring; no bank registration or activation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'content/econ-drafts');
const bases=JSON.parse(fs.readFileSync(path.join(out,'international-trade.json'),'utf8'));
const rows=[], checks=[];
const round=(n,d=6)=>Number(n.toFixed(d));
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const graph=(xLabel,yLabel,xMax,yMax,lines)=>({kind:'lines',xLabel,yLabel,xMax,yMax,lines});
const line=(label,intercept,slope)=>({label,intercept,slope});
function family(suffix,make){
 const baseId=`international-trade-${suffix}`;
 assert.ok(bases.some(b=>b.id===baseId));
 const variants=Array.from({length:16},(_,i)=>make(i));
 assert.equal(new Set(variants.map(v=>v.answer)).size,16,baseId);
 rows.push({baseId,variants});
}
function item(prompt,answer,explanation,hint,verify,g){
 assert.ok(Number.isFinite(answer)); verify(answer); checks.push(true);
 return {prompt,answer,explanation,hint,...(g?{graph:g}:{})};
}

family('u1-03',i=>{
 const a=2+i%3,b=2+(i+1)%3,w=7+i,other=w-2-i%2,p=a*w,z=b*other;
 return item(`In a one-factor competitive economy, a bicycle requires ${a} labor hours and a basket ${b} hours. Freely traded world prices are $${p} per bicycle and $${z} per basket. Labor moves freely between sectors, and labor is the only cost. What hourly wage is consistent with positive production? Give dollars per hour.`,w,
 `Bicycles support ${p}/${a}=$${w} per hour, while baskets support ${z}/${b}=$${other}. Labor produces bicycles, and competition equates the wage to the higher revenue per labor hour.`,
 'Compare each price divided by its unit labor requirement.',ans=>{near(p-a*ans,0);assert.ok(z-b*ans<0);});
});
family('u1-04',i=>{
 const a=2+i%2,b=4*a,L=a*(80+4*i),prod=L/a,x=12+i,r=2,ans=x/r;
 return item(`An island has ${L} labor hours. A fish requires ${a} hours and a jar of honey ${b} hours. At a world price of ${r} fish per jar of honey, it specializes in fish and exports ${x} fish. With balanced trade and no trade costs, how many jars of honey can it consume?`,ans,
 `The island produces ${prod} fish, keeps ${prod-x}, and uses ${x} exported fish to buy ${x}/${r}=${ans} jars. Honey would cost ${b/a} fish per jar in domestic production, so buying it at ${r} expands consumption possibilities.`,
 'Divide fish exports by the world price of one jar, expressed in fish.',v=>{near(v*r,x);assert.ok(x>0&&x<prod&&r<b/a);assert.ok(a*(prod-x)+b*v>L);},
 graph('Fish','Jars of honey',prod,prod/r,[line('Production frontier',L/b,-a/b),line('Trade budget after fish specialization',prod/r,-1/r)]));
});
family('u1-06',i=>{
 const productivity=4+i%3,survival=[.5,.625,.75,.8][i%4],delivered=5+i,factory=round(delivered*survival),w=round(factory*productivity),foreignProductivity=3,foreignCost=delivered+(i%2?2:-2);
 return item(`A Home worker produces ${productivity} crates per hour and earns $${w} per hour. Only ${survival*100}% of crates shipped from Home reach Foreign usable. A Foreign worker produces ${foreignProductivity} crates per hour at a wage of $${foreignCost*foreignProductivity}. With no other costs, what is the delivered Home cost per usable crate in Foreign, in dollars?`,delivered,
 `Home factory cost is ${w}/${productivity}=$${factory} per crate. Dividing by the usable arrival fraction gives ${factory}/${survival}=$${delivered} per usable crate, compared with $${foreignCost} for local production.`,
 'A usable arrival requires shipping the reciprocal of the survival fraction.',v=>{near(v*survival*productivity,w);assert.ok(survival>0&&survival<1&&foreignCost>0);});
});
family('u2-05',i=>{
 const L=100+2*i,k=1+i%3,m=1+(i+1)%3,allocation=30+2*i,w=40+i,A=w+k*allocation,B=w+m*(L-allocation);
 return item(`Two specific-factors sectors share ${L} workers. Their value marginal products are ${A} − ${k}L_A and ${B} − ${m}L_B dollars per worker, with L_A + L_B = ${L}. Workers move freely and both sectors operate. How many workers are employed in A at equilibrium?`,allocation,
 `Substitute L_B=${L}−L_A and equate wages: ${A}−${k}L_A=${B-m*L}+${m}L_A. Thus L_A=${allocation}, L_B=${L-allocation}, and both value marginal products equal $${w}.`,
 'Express sector B labor as total labor minus sector A labor, then equate value marginal products.',v=>{assert.ok(v>0&&v<L);near(A-k*v,B-m*(L-v));near(A-k*v,w);assert.ok(w>0);},
 graph('Workers in A','Value marginal product ($ per worker)',L,Math.max(A,B),[line('Sector A',A,-k),line('Sector B, evaluated at remaining labor',B-m*L,m)]));
});
family('u2-09',i=>{
 const t=1.05+.01*(i%4),price=round(t*t),wage=round(t*(.92+.01*i)),ans=-8+i;
 return item(`A worker has Cobb-Douglas preferences and spends half of expenditure on each of two goods. The first price becomes ${price} times its initial value, the second price is unchanged, and the wage becomes ${wage} times its initial value. Wage income is the worker's only income. What is the percentage change in real income using the exact cost-of-living index? Enter a signed percentage, not a decimal fraction.`,ans,
 `The exact price-index multiplier is √${price}=${round(t)}. The real-income multiplier is ${wage}/${round(t)}=${round(wage/t)}, giving ${ans}% real-income growth.`,
 'Divide the wage multiplier by the geometric-mean price multiplier before converting to a percentage.',v=>{near((1+v/100)**2*price,wage*wage);assert.ok(price>1&&wage>0);});
});
family('u3-05',i=>{
 const a=2+i%2,b=1,c=1,d=3+i%3,w=3+i,r=4+i%4,p=a*w+b*r,z=c*w+d*r;
 return item(`A competitive diversified economy produces shirts and machines. At the relevant input coefficients a shirt costs ${a}w + ${b}r and a machine costs ${c}w + ${d}r, where w is dollars per labor unit and r dollars per capital unit. Their prices are $${p} and $${z}. Both goods are produced. What is w?`,w,
 `Zero profits imply ${a}w+${b}r=${p} and ${c}w+${d}r=${z}. Eliminating r gives (${a*d-b*c})w=${p*d-b*z}, so w=$${w}; the implied rental is $${r}.`,
 'Use the two zero-profit equations to eliminate the capital rental.',v=>{const rr=(p-a*v)/b;near(c*v+d*rr,z);assert.ok(v>0&&rr>0&&a*d-b*c!==0);});
});
family('u3-08',i=>{
 const x=12+2*i,m=20+i,kx=4,lx=1,km=1,lm=2,ans=kx*x-km*m;
 return item(`A country exports ${x} machines, each embodying ${kx} capital units and ${lx} labor unit, and imports ${m} garments, each embodying ${km} capital unit and ${lm} labor units. Using these stated coefficients, what is its net capital content of trade in capital units? Enter exports minus imports, with a negative answer indicating net imports of capital services.`,ans,
 `Capital embodied in exports is ${kx}×${x}=${kx*x}; capital embodied in imports is ${km}×${m}=${km*m}. Net capital exports are ${ans} units.`,
 'Multiply each traded quantity by its capital coefficient, then subtract imported capital content.',v=>{near(v+km*m,kx*x);assert.ok(x>0&&m>0&&kx/lx>km/lm);});
});
family('u4-03',i=>{
 const revenue=100000+5000*i,variable=60000+2000*i,profit=-15000+2000*i,fixed=revenue-variable-profit;
 return item(`A firm would earn $${revenue} in export revenue this period and incur $${variable} in variable export costs. Entering this market also requires a $${fixed} fixed cost for the period; domestic operations are unaffected, and none of the entry cost has been paid. What is the change in total profit if the firm enters? Give a signed dollar amount.`,profit,
 `Incremental export profit is ${revenue}−${variable}−${fixed}=$${profit}. ${profit>0?'Entering increases total profit.':'Entering reduces total profit, so the firm should not enter.'}`,
 'Subtract both variable export costs and the avoidable fixed entry cost from export revenue.',v=>{near(revenue,variable+fixed+v);assert.ok(fixed>0&&revenue>variable);});
});
family('u4-07',i=>{
 const e=2+i%4,p=30+15*i,c=p*(e-1)/e;
 return item(`A monopolistically competitive firm faces constant absolute demand elasticity ${e} and constant marginal cost $${c}. Assume an interior profit-maximizing price, positive demand, and no other variable costs. What dollar price does the constant-elasticity markup rule imply?`,p,
 `The price is [${e}/(${e}−1)]×${c}=$${p}. The elasticity exceeds one, so the implied markup is positive and finite.`,
 'Multiply marginal cost by elasticity divided by elasticity minus one.',v=>{near((v-c)/v,1/e);assert.ok(e>1&&v>c&&c>0);});
});
family('u5-02',i=>{
 const pw=8+i%3,t=2+i%4,d=2,s=1,b=8+i,p=pw+t,imports=30+3*i,A=imports+b+(d+s)*p;
 return item(`Domestic demand is Q_D=${A}−${d}P and supply is Q_S=${b}+${s}P, with quantities in units and P in dollars per unit. A small country faces a fixed world price of $${pw} and imposes a specific tariff of $${t} per unit. Markets are competitive, trade costs are zero, and there are no other distortions. What are imports after the tariff?`,imports,
 `The domestic price is $${p}. Demand is ${A}−${d}×${p}=${A-d*p}; supply is ${b}+${s}×${p}=${b+s*p}. Imports are demand minus supply, ${imports} units, so the assumed import regime holds.`,
 'Add the tariff to the world price, then subtract domestic supply from demand at that price.',v=>{near(v+b+s*p,A-d*p);assert.ok(v>0&&A-d*p>0&&p<(A-b)/(d+s));},
 graph('Quantity (units)','Price ($ per unit)',A,Math.ceil(A/d),[line('Inverse demand',A/d,-1/d),line('Inverse supply',-b/s,1/s),line('World price',pw,0),line('World price plus tariff',p,0)]));
});
family('u5-03',i=>{
 const t=2+i,ds=2+2*i,dd=4+2*i,ans=t*(ds+dd)/2;
 return item(`A small-country specific tariff of $${t} per unit raises domestic production by ${ds} units and reduces consumption by ${dd} units. Supply and demand are linear, the world price is fixed, imports remain positive, and no other distortions exist. What is the national deadweight loss in dollars?`,ans,
 `Production distortion is ½×${t}×${ds}=$${t*ds/2}; consumption distortion is ½×${t}×${dd}=$${t*dd/2}. Total deadweight loss is $${ans}. Tariff revenue is a domestic transfer.`,
 'Add the areas of the production and consumption distortion triangles.',v=>{near(v,t*ds/2+t*dd/2);assert.ok(t>0&&ds>0&&dd>0);});
});
family('u5-08',i=>{
 const p=100+10*i,input=.6*p,outputTariff=.1,inputTariff=.02+.01*i,postP=round(p*(1+outputTariff)),postInput=round(input*(1+inputTariff)),ans=round((postP-postInput-(p-input))/(p-input)*100);
 return item(`Under free trade a bicycle sells for $${p} and uses one imported component costing $${input}. Tariffs raise the bicycle price to $${postP} and the component price to $${postInput}. Input coefficients stay fixed; there is no other imported content. What is the effective protection rate on domestic value added? Enter a signed percentage, rounded to three decimal places if needed.`,ans,
 `Free-trade value added is ${p}−${input}=$${round(p-input)}; protected value added is ${postP}−${postInput}=$${round(postP-postInput)}. Their proportional change is ${ans}%.`,
 'Compare protected value added with free-trade value added, using free-trade value added as the denominator.',v=>{near((p-input)*(1+v/100)+postInput,postP);assert.ok(p>input&&postP>postInput&&inputTariff>=0);});
});
family('u6-01',i=>{
 const a=5+i,b=4+i%4,ans=round(((1+a/100)*(1+b/100)-1)*100);
 return item(`In a simplified gravity equation, bilateral trade is proportional to exporter GDP times importer GDP divided by distance. Exporter GDP rises ${a}%, importer GDP rises ${b}%, and distance is unchanged. Holding all other terms fixed, what is the predicted percentage increase in trade? Enter a percentage, not a decimal fraction.`,ans,
 `The trade multiplier is ${round(1+a/100)}×${round(1+b/100)}=${round(1+ans/100)}. Subtracting one and multiplying by 100 gives ${ans}%; the two GDP changes compound.`,
 'Multiply the two GDP growth factors rather than adding their percentage changes.',v=>near(v,a+b+a*b/100));
});
family('u6-02',i=>{
 const increase=5+2*i,beta=-1.2,ans=round((1+increase/100)**beta);
 return item(`A hypothetical regression of log trade on log distance has slope ${beta} on log distance. Distance rises ${increase}%. Holding all other regressors fixed, by what factor does the exponentiated fitted value change? Compute the exact multiplicative expression and round to three decimal places.`,ans,
 `The factor is (1+${increase}/100)^(${beta})≈${round(ans,3)} after rounding to three decimal places. This is the exponentiated fitted log value, not the conditional arithmetic mean without additional retransformation assumptions.`,
 'Multiply the coefficient by the log of the distance multiplier, then exponentiate.',v=>{near(v,Math.exp(beta*Math.log1p(increase/100)),.00000051);assert.ok(v>0&&v<1);});
});
family('u6-05',i=>{
 const gross=200+20*i,imported=120+7*i,ans=gross-imported;
 return item(`A firm exports a product for $${gross}, using $${imported} of imported inputs and creating the remaining value domestically. Assume no other foreign content or double counting within the firm. What dollar amount of domestic value added is embodied in the export?`,ans,
 `Subtract imported content from gross exports: ${gross}−${imported}=$${ans} of domestic value added.`,
 'Gross export value includes imported input value.',v=>{near(v+imported,gross);assert.ok(imported>0&&v>0);});
});
family('u6-06',i=>{
 const domestic=8+i%4,foreign=3+i%3,q=2000+250*i,fixed=(domestic-foreign)*q;
 return item(`Performing a task at home costs $${domestic} per unit. Offshoring costs $${foreign} per unit plus an avoidable fixed coordination cost of $${fixed}. Quality is identical, and there are no other costs. At what volume, in units, are total costs equal?`,q,
 `Equate ${domestic}q=${foreign}q+${fixed}. The saving of $${domestic-foreign} per unit covers the fixed cost at q=${fixed}/${domestic-foreign}=${q} units. Above this quantity, offshoring is cheaper.`,
 'Divide the fixed coordination cost by the variable-cost saving per unit.',v=>{near(domestic*v,foreign*v+fixed);assert.ok(domestic>foreign&&fixed>0&&v>0);assert.ok(domestic*(v+1)>foreign*(v+1)+fixed);},
 graph('Volume (units)','Total cost ($)',q*2,domestic*q*2,[line('Home total cost',0,domestic),line('Offshore total cost',fixed,foreign)]));
});

assert.equal(rows.length,16);assert.equal(checks.length,256);
for(const f of rows)for(const v of f.variants){
 assert.ok(v.prompt&&v.hint&&v.explanation);
 if(v.graph){const g=v.graph;assert.ok(g.xMax>0&&g.yMax>0);assert.ok(g.lines.every(l=>Number.isFinite(l.intercept)&&Number.isFinite(l.slope)));}
}
fs.writeFileSync(path.join(out,'international-trade-variants.json'),JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify({families:rows.length,variants:checks.length,diagramFamilies:rows.filter(f=>f.variants.some(v=>v.graph)).length,distinctAnswers:Object.fromEntries(rows.map(f=>[f.baseId,new Set(f.variants.map(v=>v.answer)).size]))},null,2));
