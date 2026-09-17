/** Pure, deterministic teaching models. Timing and validation: docs/macroeconomics-models.md. */
function domain(p,key,lo,hi,open=false){const x=p[key];if(!Number.isFinite(x)||x<lo||x>hi||(open&&(x===lo||x===hi)))throw new RangeError(`${key} must be ${open?'strictly ':''}between ${lo} and ${hi}.`);}
function horizon(p){domain(p,'T',1,200);if(!Number.isInteger(p.T))throw new RangeError('T must be an integer.');}
function finite(x){if(!Number.isFinite(x)||Math.abs(x)>1e100)throw new RangeError('The path exceeds the numerical range. Reduce the horizon or growth rate.');return x;}
export function grid(a,b,n=121){return Array.from({length:n},(_,i)=>a+(b-a)*i/(n-1));}
export function interpolate(xs,ys,x){if(x<=xs[0])return ys[0];if(x>=xs.at(-1))return ys.at(-1);let lo=0,hi=xs.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(xs[mid]>x)hi=mid;else lo=mid;}return ys[lo]+(ys[hi]-ys[lo])*(x-xs[lo])/(xs[hi]-xs[lo]);}
function growthDomains(p){domain(p,'s',0,1);domain(p,'delta',0,1);domain(p,'n',-.5,1);domain(p,'K0',0,1e10);domain(p,'L0',0,1e10,true);horizon(p);}
function aggregatePath(p,production,g=0){let K=p.K0,L=p.L0,A=1;const rows=[];for(let t=0;t<=p.T;t++){const Y=finite(production(K,L,A)),I=p.s*Y,C=Y-I,D=p.delta*K,K1=finite(K+I-D),L1=L*(1+p.n);rows.push({t,K,L,A,Y,I,C,D,K1,L1,k:K/L,q:K/(A*L),y:Y/L,c:C/L,k1:K1/L1});K=K1;L=L1;A*=1+g;}return rows;}
export function solow(p){
  growthDomains(p);domain(p,'B',0,10,true);domain(p,'alpha',0,1,true);domain(p,'g',0,.2);
  const m=(1+p.n)*(1+p.g)-1+p.delta;
  const steady=m>0?(p.s*p.B/m)**(1/(1-p.alpha)):null;
  const rows=aggregatePath(p,(K,L,A)=>p.B*K**p.alpha*(A*L)**(1-p.alpha),p.g);
  return {rows,steady,breakEven:m,golden:m>0?(p.alpha*p.B/m)**(1/(1-p.alpha)):null};
}
export function ak(p){growthDomains(p);domain(p,'a',0,2,true);return {rows:aggregatePath(p,K=>p.a*K),growth:(1+p.s*p.a-p.delta)/(1+p.n)-1};}
export function trapOutput(k,p){return Math.max(Math.sqrt(k),p.a*Math.max(k-p.F,0));}
function bisect(f,a,b){let fa=f(a);for(let j=0;j<80;j++){const mid=(a+b)/2,fm=f(mid);if(Math.abs(fm)<1e-12)return mid;if(fa*fm<=0)b=mid;else {a=mid;fa=fm;}}return (a+b)/2;}
export function trap(p){
  domain(p,'s',0,1,true);domain(p,'delta',0,1);domain(p,'n',0,.2);domain(p,'a',0,2,true);domain(p,'F',0,200);domain(p,'k0',0,1000,true);horizon(p);
  const m=p.n+p.delta,drift=k=>p.s*trapOutput(k,p)-m*k;
  const candidates=[];
  if(m>0)candidates.push((p.s/m)**2);
  if(p.s*p.a>m&&p.F>0)candidates.push(p.s*p.a*p.F/(p.s*p.a-m));
  const roots=candidates.filter(k=>k>1e-8&&Math.abs(drift(k))<1e-7*Math.max(1,k)).sort((a,b)=>a-b).filter((k,i,a)=>!i||Math.abs(k-a[i-1])>1e-7).map(k=>{
    const e=1e-5*Math.max(1,k);return {k,stable:(drift(k+e)-drift(k-e))/(2*e)<0};
  });
  let k=p.k0;const rows=[];for(let t=0;t<=p.T;t++){const y=trapOutput(k,p),I=p.s*y,k1=finite((k+I-p.delta*k)/(1+p.n));rows.push({t,k,y,c:(1-p.s)*y,I,D:p.delta*k,k1});k=k1;}
  return {rows,roots,growth:(1+p.s*p.a-p.delta)/(1+p.n)-1};
}
export function olg(p){
  domain(p,'B',0,10,true);domain(p,'alpha',0,1,true);domain(p,'beta',0,2,true);domain(p,'delta',0,1);domain(p,'n',0,1);domain(p,'k0',0,100,true);horizon(p);
  const savingShare=p.beta/(1+p.beta),steady=(savingShare*(1-p.alpha)*p.B/(1+p.n))**(1/(1-p.alpha));
  let k=p.k0;const rows=[];for(let t=0;t<=p.T;t++){const y=p.B*k**p.alpha,wage=(1-p.alpha)*y,saving=savingShare*wage,k1=saving/(1+p.n),R1=p.alpha*p.B*k1**(p.alpha-1)+1-p.delta;rows.push({t,k,y,wage,saving,cy:wage-saving,k1,R1,co:R1*saving});k=k1;}
  const R=p.alpha*p.B*steady**(p.alpha-1)+1-p.delta;
  return {rows,steady,savingShare,R,efficient:R>=1+p.n,golden:p.n+p.delta>0?(p.alpha*p.B/(p.n+p.delta))**(1/(1-p.alpha)):null};
}
export function islm(p){
  domain(p,'G',0,500);domain(p,'T',0,300);domain(p,'M',0,1000);domain(p,'c',0,1,true);domain(p,'b',1,5000);
  const autonomous=40-p.c*p.T+60+p.G,D=1-p.c+p.b*.8/1000;
  const Y=(autonomous+p.b*p.M/1000)/D,r=(.8*Y-p.M)/1000,C=40+p.c*(Y-p.T),I=60-p.b*r;
  return {Y,r,C,I,autonomous,multiplier:1/D,moneyMultiplier:p.b/(1000*D),residual:Math.max(Math.abs(Y-C-I-p.G),Math.abs(p.M-.8*Y+1000*r))};
}
export function newKeynesian(p){
  domain(p,'beta',0,1,true);domain(p,'sigma',.1,10);domain(p,'kappa',.001,2);domain(p,'phiPi',0,5);domain(p,'phiX',0,3);domain(p,'rho',0,.99);domain(p,'shock',-.1,.1);horizon(p);
  if(!['policy','demand','cost'].includes(p.kind))throw new RangeError('Unknown shock kind.');
  const A=p.sigma*(1-p.rho)+p.phiX,B=p.phiPi-p.rho,D=1-p.beta*p.rho,det=A*D+B*p.kappa;
  if(Math.abs(det)<1e-9)throw new RangeError('This parameter combination makes the response system singular. Change the policy rule.');
  const rn=p.kind==='demand'?p.shock:0,v=p.kind==='policy'?p.shock:0,u=p.kind==='cost'?p.shock:0;
  const x=(D*(rn-v)-B*u)/det,pi=(p.kappa*(rn-v)+A*u)/det,i=p.phiPi*pi+p.phiX*x+v;
  const a11=1+(p.phiX+p.kappa/p.beta)/p.sigma,a12=(p.phiPi-1/p.beta)/p.sigma,a21=-p.kappa/p.beta,a22=1/p.beta;
  const trace=a11+a22,detM=a11*a22-a12*a21,disc=trace*trace-4*detM;
  const eigenModuli=disc>=0?[Math.abs((trace+Math.sqrt(disc))/2),Math.abs((trace-Math.sqrt(disc))/2)]:[Math.sqrt(detM),Math.sqrt(detM)];
  const rows=Array.from({length:p.T+1},(_,t)=>{const z=p.rho**t;return {t,x:x*z,pi:pi*z,i:i*z,rn:rn*z,v:v*z,u:u*z};});
  const residual=Math.max(...rows.flatMap(q=>[Math.abs(q.x-p.rho*q.x+(q.i-p.rho*q.pi-q.rn)/p.sigma),Math.abs(q.pi-p.beta*p.rho*q.pi-p.kappa*q.x-q.u)]));
  return {rows,determinate:eigenModuli.every(x=>x>1+1e-8),eigenModuli,residual};
}
export function debt(p){
  domain(p,'r',-.1,1);domain(p,'g',-.2,1);domain(p,'p',-.5,.5);domain(p,'b0',-3,5);horizon(p);
  const factor=(1+p.r)/(1+p.g);let b=p.b0;const rows=[];
  for(let t=0;t<=p.T;t++){const carry=(factor-1)*b,b1=factor*b-p.p;rows.push({t,b,carry,surplus:p.p,b1});b=b1;}
  return {rows,factor,stable:Math.abs(factor)<1,stabilizing:(factor-1)*p.b0,steady:Math.abs(factor-1)>1e-12?p.p/(factor-1):null};
}
export function optimalGrowth(p){
  domain(p,'alpha',.1,.6);domain(p,'beta',.5,.985);domain(p,'delta',.01,1);domain(p,'gamma',.5,5);domain(p,'spread',0,.25);domain(p,'stay',.5,.99);domain(p,'N',21,241);if(!Number.isInteger(p.N))throw new RangeError('N must be an integer.');
  const {N,alpha,beta,delta,gamma}=p;
  const reference=(alpha/(1/beta-1+delta))**(1/(1-alpha));
  const ks=grid(.05*reference,2.5*reference,N),z=[1-p.spread,1+p.spread],P=[[p.stay,1-p.stay],[1-p.stay,p.stay]];
  const utility=c=>Math.abs(gamma-1)<1e-12?Math.log(c):(c**(1-gamma)-1)/(1-gamma);
  const rewards=z.map(zj=>ks.map(k=>Float64Array.from(ks,kp=>{const c=zj*k**alpha+(1-delta)*k-kp;return c>0?utility(c):-Infinity;})));
  let V=[new Float64Array(N),new Float64Array(N)],diff=Infinity,iterations=0;
  function bellman(value){
    const next=[new Float64Array(N),new Float64Array(N)],indices=[new Int32Array(N),new Int32Array(N)];
    for(let j=0;j<2;j++){
      const expected=Float64Array.from(ks,(_,h)=>beta*(P[j][0]*value[0][h]+P[j][1]*value[1][h]));
      for(let q=0;q<N;q++){let best=-Infinity,arg=0;for(let h=0;h<N;h++){const candidate=rewards[j][q][h]+expected[h];if(candidate>best){best=candidate;arg=h;}}next[j][q]=best;indices[j][q]=arg;}
    }return {next,indices};
  }
  while(iterations<1800&&diff>1e-9){const {next}=bellman(V);diff=0;for(let j=0;j<2;j++)for(let i=0;i<N;i++)diff=Math.max(diff,Math.abs(next[j][i]-V[j][i]));V=next;iterations++;}
  const final=bellman(V),policy=final.indices.map(is=>Array.from(is,i=>ks[i]));
  const consumption=z.map((zj,j)=>ks.map((k,i)=>zj*k**alpha+(1-delta)*k-policy[j][i]));
  let residual=0,boundary=0;
  for(let j=0;j<2;j++)for(let i=0;i<N;i++){residual=Math.max(residual,Math.abs(final.next[j][i]-V[j][i]));if(final.indices[j][i]===0||final.indices[j][i]===N-1)boundary++;}
  return {grid:ks,z,P,policy,consumption,value:V.map(x=>Array.from(x)),iterations,residual,errorBound:residual/(1-beta),converged:residual<1e-7,boundary,reference};
}
