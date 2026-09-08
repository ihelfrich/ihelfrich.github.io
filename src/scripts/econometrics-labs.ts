import {observationSample,world,samplingExperiment,designBounds,csv} from '../lib/econometrics.mjs';
const get=(root:Element,s:string)=>root.querySelector(s) as HTMLElement;
const input=(root:Element,s:string)=>root.querySelector(s) as HTMLInputElement;
const set=(root:Element,s:string,v:string)=>{get(root,s).textContent=v;};
function download(name:string,content:string){const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function initializeWorlds(){document.querySelectorAll('[data-worlds]').forEach(root=>{
  const data=observationSample(),b=input(root,'[data-world-b]');
  const update=()=>{const value=Number(b.value);set(root,'[data-b-value]',value.toFixed(2));set(root,'[data-causal-slope]',value.toFixed(2));const line=get(root,'[data-intervention-line]');line.setAttribute('y1',String(150+value*84));line.setAttribute('y2',String(150-value*84));set(root,'[data-world-verdict]',`A one-unit intervention ${value<0?'lowers':value===0?'does not change':'raises'} the mean outcome${value===0?'':` by ${Math.abs(value).toFixed(2)}`}. The observational distribution has not changed.`);};
  b.addEventListener('input',update);update();
  root.querySelector('[data-world-download]')?.addEventListener('click',()=>download('observed-worlds-seed-2026.csv',csv(world(data,Number(b.value)),['id','x','y'])));
});}
export function initializeSampling(){document.querySelectorAll('[data-sampling]').forEach(root=>{
  let seed=2026,result;const n=input(root,'[data-sampling-n]'),bias=input(root,'[data-sampling-bias]');
  const x=(v:number)=>42+(Math.max(-1.1,Math.min(1.5,v))+1.1)/2.6*452;
  const update=()=>{
    result=samplingExperiment({seed,n:Number(n.value),bias:Number(bias.value)});
    set(root,'[data-n-value]',n.value);set(root,'[data-bias-value]',Number(bias.value).toFixed(2));set(root,'[data-coverage]',`${Math.round(result.coverage*100)} / 100`);set(root,'[data-width]',result.halfWidth.toFixed(3));set(root,'[data-seed]',`Seed ${seed}. All results stay in this browser; CSV downloads the current batch.`);
    let svg=`<line x1="${x(0)}" x2="${x(0)}" y1="20" y2="309" stroke="#142b49" stroke-width="1.5"/><text x="${x(0)}" y="12" text-anchor="middle" font-size="10" fill="#142b49">True target = 0</text>`;
    for(const t of [-1,-.5,0,.5,1,1.5]) svg+=`<text x="${x(t)}" y="333" text-anchor="middle" font-size="10" fill="#506379">${t}</text>`;
    result.rows.forEach((r,i)=>{const y=25+i*2.8,c=r.covers?'#126d65':'#ad422e';svg+=`<line x1="${x(r.low)}" x2="${x(r.high)}" y1="${y}" y2="${y}" stroke="${c}" opacity=".65" ${r.covers?'':'stroke-dasharray="3 2"'}/><circle cx="${x(r.mean)}" cy="${y}" r="1.6" fill="${c}"/>`;if(r.low< -1.1)svg+=`<path d="M47 ${y-2}L42 ${y}L47 ${y+2}" fill="none" stroke="${c}"/>`;if(r.high>1.5)svg+=`<path d="M489 ${y-2}L494 ${y}L489 ${y+2}" fill="none" stroke="${c}"/>`;});
    get(root,'[data-sampling-plot]').innerHTML=svg;
    set(root,'[data-sampling-verdict]',Number(bias.value)===0?'The studies are centered on the target. The misses are part of this procedure’s long-run error rate.':'The studies are centered away from the target. Increasing n shrinks the interval around that displaced center; it does not remove the bias.');
  };n.addEventListener('input',update);bias.addEventListener('input',update);get(root,'[data-new-sample]').addEventListener('click',()=>{seed++;update();});get(root,'[data-sampling-download]').addEventListener('click',()=>download(`sampling-seed-${seed}.csv`,csv(result.rows,['replication','n','bias','mean','low','high','covers'])));update();
});}
export function initializeDesign(){document.querySelectorAll('[data-design]').forEach(root=>{
  const m=input(root,'[data-design-m]'),y=(v:number)=>265-(v-30)/40*240;
  const money=(v:number)=>`${v<0?'−':''}$${Math.abs(v).toFixed(0)}`;
  const update=()=>{const M=Number(m.value),d=designBounds(M);set(root,'[data-m-value]',M.toFixed(1));set(root,'[data-effect]',`[${d.effect.map(v=>v.toFixed(1)).join(', ')}]`);set(root,'[data-net]',`[${d.net.map(money).join(', ')}]`);set(root,'[data-design-verdict]',`${d.decision}. ${d.net[0]>0?'Every effect allowed by this bound clears the $300 cost.':'The allowed effects include outcomes that fail to clear the cost; the data and this bound do not settle the investment.'}`);
  let svg='';for(const t of [30,40,50,60,70])svg+=`<line x1="55" x2="485" y1="${y(t)}" y2="${y(t)}" stroke="#e3eaf4"/><text x="42" y="${y(t)+3}" font-size="10" text-anchor="end" fill="#506379">${t}</text>`;
  svg+=`<polygon points="95,${y(50)} 440,${y(56+M)} 440,${y(56-M)}" fill="#ad422e" opacity=".13"/><path d="M95 ${y(50)}L440 ${y(56)}" stroke="#ad422e" stroke-width="2" fill="none" stroke-dasharray="6 4"/><line x1="440" x2="440" y1="${y(56-M)}" y2="${y(56+M)}" stroke="#ad422e" stroke-width="3"/><path d="M95 ${y(40)}L440 ${y(46)}" stroke="#677b92" stroke-width="2" fill="none"/><path d="M95 ${y(50)}L440 ${y(62)}" stroke="#2459d3" stroke-width="3" fill="none"/>`;
  for(const [x,v,c] of [[95,50,'#2459d3'],[440,62,'#2459d3'],[95,40,'#677b92'],[440,46,'#677b92']])svg+=`<circle cx="${x}" cy="${y(Number(v))}" r="5" fill="${c}"/><text x="${Number(x)+12}" y="${y(Number(v))+4}" font-size="11" fill="${c}">${v}</text>`;
  svg+='<text x="95" y="292" text-anchor="middle" font-size="11" fill="#506379">Before</text><text x="440" y="292" text-anchor="middle" font-size="11" fill="#506379">After</text>';
  get(root,'[data-design-plot]').innerHTML=svg;
  };m.addEventListener('input',update);get(root,'[data-design-download]').addEventListener('click',()=>download('did-assumption-sensitivity.csv',csv(Array.from({length:21},(_,i)=>{const M=i/2,d=designBounds(M);return {M,effect_low:d.effect[0],effect_high:d.effect[1],net_low:d.net[0],net_high:d.net[1],decision:d.decision};}),['M','effect_low','effect_high','net_low','net_high','decision'])));update();
});}
