import {clockAudit} from '../lib/handbook-clocks.mjs';
export function initializeClockAudit(){
  for(const el of document.querySelectorAll<HTMLElement>('[data-clock-audit]')){
    if(el.dataset.initialized)continue;el.dataset.initialized='true';
    const origin=el.querySelector<HTMLSelectElement>('[data-clock-origin]')!,delay=el.querySelector<HTMLSelectElement>('[data-clock-delay]')!,mutation=el.querySelector<HTMLSelectElement>('[data-clock-mutation]')!;
    const controls=el.querySelector<HTMLFieldSetElement>('[data-clock-controls]')!,reveal=el.querySelector<HTMLButtonElement>('[data-clock-reveal]')!,result=el.querySelector<HTMLElement>('[data-clock-result]')!;
    const predictions=[...el.querySelectorAll<HTMLInputElement>('input[name="clock-prediction"]')];
    controls.disabled=false;result.hidden=true;
    const reset=()=>{result.hidden=true;for(const p of predictions)p.checked=false;reveal.disabled=true;};
    for(const control of [origin,delay,mutation])control.addEventListener('change',reset);
    for(const p of predictions)p.addEventListener('change',()=>{reveal.disabled=!predictions.some(p=>p.checked);});
    const text=(selector:string,value:string)=>{el.querySelector<HTMLElement>(selector)!.textContent=value;};
    const names=['Advance','Second','Third'];
    const format=(v:number)=>Number(v.toPrecision(8)).toLocaleString('en-US',{maximumFractionDigits:6});
    reveal.addEventListener('click',()=>{
      const chosen=predictions.find(p=>p.checked);if(!chosen)return;
      const s=clockAudit(Number(origin.value),Number(delay.value),mutation.value==='true');
      const selection=s.selected?`${names[s.stage-1]}: ${format(s.growth)}%`:'Not released under this scenario';
      text('[data-clock-feedback]',`Your prediction: ${chosen.parentElement!.textContent!.trim()}. At ${s.origin}, with ${s.delay} seconds collection delay, the eligible selection is ${selection}. Future-only changes preserve this selection.`);
      text('[data-clock-selected]',selection);text('[data-clock-latest]',`${format(s.latestValue)}%`);text('[data-clock-count]',String(s.eligibleRows));
      text('[data-clock-explanation]',s.mutate?(s.rows.some((r:{changed:boolean})=>r.changed)?'Only unavailable values were altered. The eligible selection stays the same; the entire-archive value includes a future publication.':'All three source events are already eligible. The future-only mutation has no event to alter in this extract.'):'The source values are retained. Compare the eligible publication with the entire-archive value, and check which events are available at the origin.');
      text('[data-clock-description]',`At ${s.origin} and delay ${s.delay} seconds, ${s.eligibleRows===1?'one publication is':`${s.eligibleRows} publications are`} eligible. ${selection}. Filled circles are eligible; hollow circles are unavailable. ${s.mutate?'Unavailable values have an authored 10-percentage-point addition.':'All source values are retained.'}`);
      el.querySelector('[data-clock-points]')!.replaceChildren(...s.rows.map((r:{stage:number;value:number;eligible:boolean})=>{const c=document.createElementNS('http://www.w3.org/2000/svg','circle');for(const [k,v] of Object.entries({cx:80+(r.stage-1)*140,cy:252-16*r.value,r:7,fill:r.eligible?'currentColor':'var(--paper)',stroke:'currentColor','stroke-width':2}))c.setAttribute(k,String(v));return c;}));
      el.querySelector('[data-clock-rows]')!.replaceChildren(...s.rows.map((r:{stage:number;release_utc:string;availability:string;value:number;eligible:boolean})=>{const tr=document.createElement('tr');for(const value of [names[r.stage-1],r.release_utc,r.availability,format(r.value),r.eligible?'Yes':'No']){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
      result.hidden=false;
    });
  }
}
