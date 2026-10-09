import {measurementSummary} from '../lib/handbook-measurement.mjs';
export function initializeMeasurementWorlds(){
  for(const el of document.querySelectorAll<HTMLElement>('[data-measurement-worlds]')){
    if(el.dataset.initialized)continue;el.dataset.initialized='true';
    const controls=el.querySelector<HTMLFieldSetElement>('[data-meter-controls]')!;
    const noise=el.querySelector<HTMLSelectElement>('[data-meter-noise]')!;
    const calibration=el.querySelector<HTMLSelectElement>('[data-meter-calibration]')!;
    const reveal=el.querySelector<HTMLButtonElement>('[data-reveal-meter]')!;
    const result=el.querySelector<HTMLElement>('[data-meter-result]')!;
    const predictions=[...el.querySelectorAll<HTMLInputElement>('input[name="meter-prediction"]')];
    controls.disabled=false;result.hidden=true;
    const reset=()=>{result.hidden=true;for(const p of predictions)p.checked=false;reveal.disabled=true;};
    noise.addEventListener('change',reset);calibration.addEventListener('change',reset);
    for(const p of predictions)p.addEventListener('change',()=>{reveal.disabled=!predictions.some(x=>x.checked);});
    const text=(selector:string,value:string)=>{el.querySelector<HTMLElement>(selector)!.textContent=value;};
    const format=(x:number)=>Number(x.toPrecision(7)).toLocaleString('en-US',{maximumFractionDigits:5});
    reveal.addEventListener('click',()=>{
      const chosen=predictions.find(p=>p.checked);if(!chosen)return;
      const s=measurementSummary(Number(noise.value),Number(calibration.value));
      const relation=Math.abs(s.slope-50)<1e-10?'equal to':s.slope<50?'lower than':'higher than';
      text('[data-meter-feedback]',`Your prediction: ${chosen.parentElement!.textContent!.trim()}. The computed recorded-energy slope is ${format(s.slope)} dollars per MWh, ${relation} 50. Noise amplitude: ${s.h} MWh; calibration κ: ${s.kappa}.`);
      text('[data-meter-slope]',format(s.slope));text('[data-meter-intercept]',format(s.intercept));text('[data-meter-mse]',format(s.linearMSE));text('[data-meter-twin]',format(s.twinRatio));text('[data-meter-kwh]',format(s.slopePerKWh));
      text('[data-meter-assumptions]',s.kappa===0?'The classical covariance restrictions hold in this declared generator. The independent two-reading covariance ratio recovers 50.':'Calibration error is correlated with true use, violating the classical restrictions. Both readings share the wrong scale; their covariance ratio does not recover the declared 50.');
      const gx=(m:number)=>66+(m-2)*22,gy=(y:number)=>252-(y-300)*.4;
      el.querySelector('[data-meter-line]')!.setAttribute('d',`M${gx(s.minimumMeter)} ${gy(s.intercept+s.slope*s.minimumMeter)}L${gx(s.maximumMeter)} ${gy(s.intercept+s.slope*s.maximumMeter)}`);
      const dots=s.points.map((p:{m:number;y:number})=>{const c=document.createElementNS('http://www.w3.org/2000/svg','circle');for(const [k,v] of Object.entries({cx:gx(p.m),cy:gy(p.y),r:4.5,fill:'var(--paper)',stroke:'currentColor','stroke-width':1.5}))c.setAttribute(k,String(v));return c;});
      el.querySelector('[data-meter-points]')!.replaceChildren(...dots);
      text('[data-meter-description]',`At h=${s.h} and κ=${s.kappa}, the recorded-meter line has slope ${format(s.slope)} and intercept ${format(s.intercept)}. The perfect-reading benchmark has slope 50 and intercept 30. The plotted pairs are controlled population possibilities.`);
      el.querySelector('[data-meter-rows]')!.replaceChildren(...s.signalRows.map((r:{x:number;m:number;meanBill:number})=>{const tr=document.createElement('tr');for(const value of [r.x,r.m,r.meanBill]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}return tr;}));
      result.hidden=false;
    });
  }
}
