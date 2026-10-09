type RoomRow={origin:string;target:string;latest:string;actual:number;forecasts:Record<string,number>;history:[string,number][]};
const ink='var(--ink)',blue='var(--blue)',red='var(--orange)';
function plot(svg:SVGElement,values:number[],labels:string[]=[],divider?:number){
  const left=55,right=620,top=25,bottom=250;const min=Math.min(...values,0),max=Math.max(...values,1);const span=Math.max(max-min,1);
  const x=(i:number)=>left+i*(right-left)/Math.max(values.length-1,1);const y=(v:number)=>bottom-(v-min)/span*(bottom-top);
  const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
  svg.innerHTML=`<path d="M${left},${top}V${bottom}H${right}" fill="none" stroke="${ink}" opacity=".4"/><polyline points="${points}" fill="none" stroke="${blue}" stroke-width="2.5"/>${values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${blue}"/>`).join('')}<text x="${left-7}" y="${top+5}" text-anchor="end" fill="${ink}" font-size="12">${max.toFixed(1)}</text><text x="${left-7}" y="${bottom}" text-anchor="end" fill="${ink}" font-size="12">${min.toFixed(1)}</text>${labels.map((l,i)=>`<text x="${x(i)}" y="278" text-anchor="middle" fill="${ink}" font-size="12">${l}</text>`).join('')}${divider===undefined?'':`<path d="M${x(divider+.5)},${top}V${bottom}" fill="none" stroke="${red}" stroke-dasharray="5 4"/>`}`;
}
export function initializeTimeSeriesExperiments(){
  document.querySelectorAll<HTMLElement>('[data-ts-lab]').forEach(lab=>{
    const value=(key:string)=>Number(lab.querySelector<HTMLInputElement>(`[data-ts-${key}]`)!.value);
    const write=(key:string,v:number,digits=3)=>{lab.querySelector<HTMLElement>(`[data-ts-${key}]`)!.textContent=v.toFixed(digits)};
    const chart=lab.querySelector<SVGElement>('[data-ts-chart]')!;
    const update=()=>{
      if(lab.dataset.tsLab==='ar'){
        const phi=value('phi'),h=value('h');write('phi-value',phi,2);write('h-value',h,0);write('response',phi**h);
        write('variance',Array.from({length:h},(_,j)=>phi**(2*j)).reduce((a,b)=>a+b,0));
        const end=Math.max(12,h),labelEvery=Math.ceil(end/12);
        plot(chart,Array.from({length:end+1},(_,j)=>phi**j),Array.from({length:end+1},(_,j)=>j%labelEvery===0||j===end?String(j):''));
      }else if(lab.dataset.tsLab==='filter'){
        const delta=value('delta');const t=Array.from({length:9},(_,i)=>i+16);const series=t.map(i=>Math.sin(i*.3)+.3*Math.cos(i*1.7)+(i>20&&i<=22?delta:0));
        write('delta-value',delta,0);write('trailing',0);write('centered',2*delta/5);plot(chart,series,t.map(String),4);
      }else if(lab.dataset.tsLab==='rotation'){
        const angle=value('angle'),c=Math.cos(angle),s=Math.sin(angle);const b11=2*c,b12=-2*s,b21=c+2*s,b22=-s+2*c;
        write('angle-value',angle,2);write('impact',b21);write('covariance',b11*b21+b12*b22);
        chart.innerHTML=`<path d="M70,150H600M320,35V265" fill="none" stroke="${ink}" opacity=".4"/><path d="M320,150L${320+b11*65},${150-b21*45}" fill="none" stroke="${blue}" stroke-width="3"/><circle cx="${320+b11*65}" cy="${150-b21*45}" r="6" fill="${blue}"/><text x="480" y="280" fill="${ink}" font-size="13">Variable 1 impact</text><text x="75" y="25" fill="${ink}" font-size="13">Variable 2 impact</text>`;
      }else{
        const shock=value('shock'),next=.1+.1*shock**2+.8;write('shock-value',shock,1);write('next-variance',next);write('quantile',-1.6448536269514722*Math.sqrt(next));
        plot(chart,Array.from({length:13},(_,j)=>1+.9**j*(next-1)),Array.from({length:13},(_,j)=>String(j+1)));
      }
    };lab.addEventListener('input',update);update();
  });
  const room=document.querySelector<HTMLElement>('[data-ts-room]');if(!room)return;
  const get=<T extends HTMLElement>(key:string)=>room.querySelector<T>(`[data-room-${key}]`)!;
  const method=get<HTMLSelectElement>('method'),reason=get<HTMLInputElement>('reason');const record=get<HTMLButtonElement>('record'),reveal=get<HTMLButtonElement>('reveal'),next=get<HTMLButtonElement>('next');
  let index=0,stage=0;let data:RoomRow[]=[];let ledger:Record<string,unknown>[]=[];
  const render=()=>{
    if(!data.length)return;
    const row=data[index];get('step').textContent=`Origin ${index+1} of ${data.length}`;get('clock').textContent=`Decision: ${row.origin}. Target: ${row.target}. Latest admitted observation: ${row.latest}.`;
    get('proposal').textContent=`Reference forecast: ${row.forecasts[method.value].toFixed(3)} million MWh.`;
    const labels=row.history.map(([date],i)=>i===0||i===row.history.length-1?date:'');plot(get<SVGElement & HTMLElement>('chart'),row.history.map(([,v])=>v),labels);
    record.disabled=stage!==0;method.disabled=stage!==0;reason.disabled=stage!==0;reveal.disabled=stage!==1;next.disabled=stage!==2||index===data.length-1;
  };
  method.addEventListener('change',()=>{if(stage===0)render()});
  record.addEventListener('click',()=>{if(stage!==0||!data.length)return;const row=data[index];ledger.push({origin:row.origin,target:row.target,latest:row.latest,method:method.value,forecast:row.forecasts[method.value],reason:reason.value});stage=1;get('result').textContent='Forecast recorded. Reveal the outcome when you are ready.';render()});
  reveal.addEventListener('click',()=>{if(stage!==1)return;const row=data[index],entry=ledger[ledger.length-1];const error=row.actual-Number(entry.forecast);entry.actual=row.actual;entry.error=error;entry.squared_error=error**2;stage=2;get('result').textContent=`Observed ${row.actual.toFixed(3)} million MWh. Error ${error.toFixed(3)}; squared error ${(error**2).toFixed(3)}. Which assumption does this result challenge?`;render()});
  next.addEventListener('click',()=>{if(stage!==2||index>=data.length-1)return;index++;stage=0;reason.value='';get('result').textContent='';render()});
  get('reset').addEventListener('click',()=>{index=0;stage=0;ledger=[];reason.value='';get('result').textContent='';render()});
  get('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({case:'Texas fixed-vintage teaching case',release_lag:'two months, assumed',decisions:ledger},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='time-series-decision-ledger.json';a.click();URL.revokeObjectURL(url)});
  fetch('/time-series/forecast-room.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json()}).then(rows=>{data=rows;render()}).catch(()=>{get('step').textContent='The fixed teaching data could not load. Download the code bundle to run the same case.';record.disabled=true});
}
