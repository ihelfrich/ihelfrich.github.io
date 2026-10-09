import {alertSummary} from '../lib/handbook-worlds.mjs';
export function initializeAlertWorlds(){
  for(const el of document.querySelectorAll<HTMLElement>('[data-alert-worlds]')){
    if(el.dataset.initialized)continue;el.dataset.initialized='true';
    const controls=el.querySelector<HTMLFieldSetElement>('[data-world-controls]')!;
    const select=el.querySelector<HTMLSelectElement>('[data-alert-effect]')!;
    const reveal=el.querySelector<HTMLButtonElement>('[data-reveal-alert]')!;
    const result=el.querySelector<HTMLElement>('[data-alert-result]')!;
    const feedback=el.querySelector<HTMLElement>('[data-alert-feedback]')!;
    const predictions=[...el.querySelectorAll<HTMLInputElement>('input[name="alert-prediction"]')];
    controls.disabled=false;result.hidden=true;
    const text=(selector:string,value:string)=>{el.querySelector<HTMLElement>(selector)!.textContent=value;};
    select.addEventListener('change',()=>{result.hidden=true;for(const p of predictions)p.checked=false;reveal.disabled=true;});
    for(const p of predictions)p.addEventListener('change',()=>{reveal.disabled=!predictions.some(x=>x.checked);});
    reveal.addEventListener('click',()=>{
      const chosen=predictions.find(p=>p.checked);if(!chosen)return;
      const s=alertSummary(Number(select.value));
      const response=s.effect<0?'down':s.effect>0?'up':'same';
      const direction=response==='down'?'falls':response==='up'?'rises':'stays at the same value';
      feedback.textContent=`Your prediction: ${chosen.parentElement!.textContent!.trim()}. The assigned mean ${direction}: ${s.assigned0} MW without an alert and ${s.assigned1} MW with one. Difference: ${s.effect} MW. The observed means remain 10 and 12 MW.`;
      text('[data-assigned0]',String(s.assigned0));text('[data-assigned1]',String(s.assigned1));text('[data-assigned-effect]',String(s.effect));
      const y=(load:number)=>170-(load-10)*40;
      el.querySelector('[data-assigned-path]')!.setAttribute('d',`M90 ${y(s.assigned0)}L320 ${y(s.assigned1)}`);
      el.querySelector('[data-assigned0-point]')!.setAttribute('cy',String(y(s.assigned0)));
      el.querySelector('[data-assigned1-point]')!.setAttribute('cy',String(y(s.assigned1)));
      text('[data-alert-graph-description]',`Observed means: 10 and 12 MW. Assigned means with b=${s.b}: ${s.assigned0} and ${s.assigned1} MW.`);
      const rows=el.querySelector('[data-alert-state-rows]')!;rows.replaceChildren(...s.states.map(state=>{
        const tr=document.createElement('tr');for(const value of [state.u,state.v,state.observed,state.assigned0,state.assigned1]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}return tr;
      }));
      result.hidden=false;
    });
  }
}
