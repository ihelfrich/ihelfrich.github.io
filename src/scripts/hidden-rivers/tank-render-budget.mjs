// Display budget only: this never changes the simulation grid or timestep.
export function createTankRenderBudget(){
 let last=null,gaps=[],period=1000/120,scale=1,gpu=null,slow=0,fast=0;
 function adjust(cost){if(cost>period*.9){slow++;fast=0;}else if(cost<period*.6){fast++;slow=Math.max(0,slow-1);}else slow=fast=0;if(slow>=12){scale=Math.max(.45,scale-.08);slow=0;}else if(fast>=120){scale=Math.min(1,scale+.04);fast=0;}}
 return {
  frame(now){if(last!==null){const gap=now-last;if(gap>1&&gap<100){gaps.push(gap);if(gaps.length>90)gaps.shift();if(gaps.length>=8){const sorted=gaps.slice().sort((a,b)=>a-b);period=Math.min(1000/60,sorted[Math.floor(sorted.length*.1)]);if(gpu===null)adjust(Math.max(0,gap-period)*1.5+period*.55);}}}last=now;},
  cost(ms){if(!Number.isFinite(ms)||ms<0)return;gpu=gpu===null?ms:.8*gpu+.2*ms;adjust(gpu);},
  getStats:()=>({scale,targetFps:1000/period,gpuDrawMs:gpu}),
  reset(){last=null;gaps=[];period=1000/120;scale=1;gpu=null;slow=fast=0;}
 };
}
