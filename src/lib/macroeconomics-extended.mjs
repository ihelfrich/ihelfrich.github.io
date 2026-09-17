/** Research-informed, explicitly restricted models. See docs/macroeconomics-models.md. */
import {grid,interpolate,optimalGrowth} from './macroeconomics.mjs';
function check(p,key,lo,hi,integer=false){if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi||(integer&&!Number.isInteger(p[key])))throw new RangeError(`${key} must be ${integer?'an integer ':''}between ${lo} and ${hi}.`);}
const time=p=>check(p,'T',1,150,true);
export function twoSector(p){
 for(const [k,lo,hi] of [['alpha',.15,.6],['s',0,.6],['delta',0,.2],['n',0,.1],['eta',0,.2],['u',.05,1],['K0',1,5000],['L0',1,500],['H0',.1,5]])check(p,k,lo,hi);time(p);
 let K=p.K0,L=p.L0,H=p.H0;const rows=[];
 for(let t=0;t<=p.T;t++){const productionWorkers=p.u*L,educationWorkers=(1-p.u)*L,Y=K**p.alpha*(H*productionWorkers)**(1-p.alpha),I=p.s*Y,C=Y-I,D=p.delta*K,K1=K+I-D,L1=L*(1+p.n),H1=H*(1+p.eta*(1-p.u));rows.push({t,K,L,H,Y,I,C,D,K1,L1,H1,productionWorkers,educationWorkers,k:K/L,y:Y/L,c:C/L,k1:K1/L1});K=K1;L=L1;H=H1;}
 return {rows,hGrowth:p.eta*(1-p.u)};
}
export function ramsey(p){
 check(p,'kRatio',.1,2);time(p);
 const r=optimalGrowth({...p,spread:0,stay:.9}),steady=r.reference;let k=steady*p.kRatio;const rows=[];
 for(let t=0;t<=p.T;t++){const y=k**p.alpha,k1=interpolate(r.grid,r.policy[0],k),c=y+(1-p.delta)*k-k1;
 if(!(c>0))throw Error('The interpolated policy is infeasible; refine the grid.');
 const c1=k1**p.alpha+(1-p.delta)*k1-interpolate(r.grid,r.policy[0],k1),grossReturn=p.alpha*k1**(p.alpha-1)+1-p.delta,euler=1-p.beta*grossReturn*(c/c1)**p.gamma;
 rows.push({t,k,y,c,I:y-c,k1,grossReturn,euler});k=k1;}
 return {...r,rows,steady,cStar:steady**p.alpha-p.delta*steady,eulerResidual:Math.max(...rows.map(x=>Math.abs(x.euler)))};
}
export function rbc(p){
 check(p,'alpha',.15,.6);check(p,'beta',.85,.99);check(p,'rho',0,.95);check(p,'shock',-.2,.2);time(p);
 const steady=(p.alpha*p.beta)**(1/(1-p.alpha)),yStar=steady**p.alpha,cStar=(1-p.alpha*p.beta)*yStar;let k=steady;const rows=[];
 for(let t=0;t<=p.T;t++){const z=Math.exp(p.shock*p.rho**t),y=z*k**p.alpha,k1=p.alpha*p.beta*y,c=y-k1;rows.push({t,k,z,y,c,I:k1,k1,yHat:100*Math.log(y/yStar),cHat:100*Math.log(c/cStar),kHat:100*Math.log(k/steady)});k=k1;}
 return {rows,steady,yStar,cStar,saving:p.alpha*p.beta};
}
export function openEconomy(p){
 for(const [k,lo,hi]of [['y0',.1,3],['y1',.1,3],['b0',-.5,1],['r',-.05,.2],['beta',.5,.99],['gamma',.5,5]])check(p,k,lo,hi);
 const R=1+p.r,wealth=R*p.b0+p.y0+p.y1/R;if(wealth<=0)throw Error('Lifetime resources must be positive.');
 const ratio=(p.beta*R)**(1/p.gamma),c0=wealth/(1+ratio/R),c1=ratio*c0,b1=R*p.b0+p.y0-c0,ca=b1-p.b0;
 return {R,wealth,ratio,c0,c1,b1,ca,residual:Math.max(Math.abs(c0+c1/R-wealth),Math.abs(R*b1+p.y1-c1))};
}
export function matching(p){
 for(const [k,lo,hi]of [['eff',.01,1],['theta',.05,4],['eta',.1,.9],['separation',0,.2],['u0',0,1]])check(p,k,lo,hi);time(p);
 const finding=1-Math.exp(-p.eff*p.theta**(1-p.eta)),steady=p.separation/(p.separation+finding);let u=p.u0;const rows=[];
 for(let t=0;t<=p.T;t++){const inflow=p.separation*(1-u),outflow=finding*u,u1=u+inflow-outflow;rows.push({t,u,v:p.theta*u,employment:1-u,inflow,outflow,u1});u=u1;}
 return {rows,finding,steady,vStar:p.theta*steady};
}
export function household(p){
 for(const [k,lo,hi]of [['beta',.85,.98],['r',0,.04],['w',.5,2],['gamma',.5,5],['spread',0,.8],['stay',.5,.97],['amax',5,40]])check(p,k,lo,hi);check(p,'N',21,121,true);
 const {N,beta,gamma}=p,ks=grid(0,p.amax,N),z=[1-p.spread,1+p.spread],P=[[p.stay,1-p.stay],[1-p.stay,p.stay]],u=c=>gamma===1?Math.log(c):(c**(1-gamma)-1)/(1-gamma);
 const reward=z.map(zj=>ks.map(a=>ks.map(ap=>{const c=p.w*zj+(1+p.r)*a-ap;return c>0?u(c):-Infinity;})));
 let V=z.map(()=>Array(N).fill(0)),iterations=0,diff=Infinity;
 function bellman(value){const EV=z.map((_,j)=>ks.map((_,i)=>P[j][0]*value[0][i]+P[j][1]*value[1][i])),next=z.map(()=>Array(N).fill(0)),indices=z.map(()=>Array(N).fill(0));
 for(let j=0;j<2;j++)for(let i=0;i<N;i++){let best=-Infinity,index=0;for(let l=0;l<N;l++){if(!Number.isFinite(reward[j][i][l]))break;const v=reward[j][i][l]+beta*EV[j][l];if(v>best){best=v;index=l;}}next[j][i]=best;indices[j][i]=index;}return {next,indices};}
 while(diff>1e-9&&iterations<2000){const q=bellman(V);diff=Math.max(...q.next.flatMap((v,j)=>v.map((x,i)=>Math.abs(x-V[j][i]))));V=q.next;iterations++;}
 const final=bellman(V),residual=Math.max(...V.flatMap((v,j)=>v.map((x,i)=>Math.abs(x-final.next[j][i]))));
 const policy=final.indices.map(is=>is.map(i=>ks[i])),consumption=z.map((zj,j)=>ks.map((a,i)=>p.w*zj+(1+p.r)*a-policy[j][i]));
 const advance=d=>{const next=z.map(()=>Array(N).fill(0));for(let j=0;j<2;j++)for(let i=0;i<N;i++)for(let l=0;l<2;l++)next[l][final.indices[j][i]]+=d[j][i]*P[j][l];return next;};
 // Lazification preserves stationary measures and eliminates finite-chain periodicity.
 let distribution=z.map(()=>Array(N).fill(1/(2*N))),distributionIterations=0,diffD=Infinity;
 while(diffD>1e-12&&distributionIterations<10000){const next=advance(distribution);diffD=0;for(let j=0;j<2;j++)for(let i=0;i<N;i++){next[j][i]=(next[j][i]+distribution[j][i])/2;diffD=Math.max(diffD,Math.abs(next[j][i]-distribution[j][i]));}distribution=next;distributionIterations++;}
 const next=advance(distribution),distributionResidual=Math.max(...next.flatMap((d,j)=>d.map((x,i)=>Math.abs(x-distribution[j][i]))));
 let meanAssets=0,meanConsumption=0;for(let j=0;j<2;j++)for(let i=0;i<N;i++){meanAssets+=distribution[j][i]*ks[i];meanConsumption+=distribution[j][i]*consumption[j][i];}
 const mass=ks.map((_,i)=>distribution[0][i]+distribution[1][i]);let population=0,wealth=0;const lorenz=[{x:0,y:0}];for(let i=0;i<N;i++){population+=mass[i];wealth+=mass[i]*ks[i];lorenz.push({x:population,y:meanAssets>1e-12?wealth/meanAssets:population});}
 const gini=meanAssets>1e-12?1-lorenz.slice(1).reduce((s,q,i)=>s+(q.x-lorenz[i].x)*(q.y+lorenz[i].y),0):null;
 return {grid:ks,z,P,policy,consumption,value:V,distribution,mass,lorenz,gini,meanAssets,meanConsumption,iterations,residual,errorBound:residual/(1-beta),distributionResidual,distributionIterations,converged:residual<1e-7&&distributionResidual<1e-8,topMass:mass.at(-1),boundary:final.indices.flat().filter(i=>i===N-1).length};
}
export function sequence(p){
 check(p,'mpc',0,.95);check(p,'lag',0,.95);check(p,'shock',-5,5);time(p);check(p,'shockAt',0,p.T,true);
 const n=p.T+1,J=Array.from({length:n},(_,t)=>Array.from({length:n},(_,s)=>t>=s?p.mpc*(1-p.lag)*p.lag**(t-s):0)),M=Array.from({length:n},()=>Array(n).fill(0));
 for(let s=0;s<n;s++)for(let t=s;t<n;t++){let value=t===s?1:0;for(let j=0;j<t;j++)value+=J[t][j]*M[j][s];M[t][s]=value/(1-J[t][t]);}
 const rows=Array.from({length:n},(_,t)=>{const y=M[t][p.shockAt]*p.shock,g=t===p.shockAt?p.shock:0;return {t,y,c:y-g,g,direct:J[t][p.shockAt]*p.shock,multiplier:M[t][p.shockAt]};});
 const residual=Math.max(...rows.map(x=>Math.abs(x.c-J[x.t].reduce((s,j,i)=>s+j*rows[i].y,0))));
 return {rows,J,M,residual,impact:M[p.shockAt][p.shockAt],cumulative:rows.reduce((s,x)=>s+x.multiplier,0),infinite:1/(1-p.mpc)};
}
