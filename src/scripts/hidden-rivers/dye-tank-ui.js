import {createTankRenderer} from './tank-renderer.js';
import {createTankMotion,createTankPacer} from './tank-motion.mjs';
export function startDyeTank({onActivate=()=>{}}={}){
  const section=document.getElementById('saltwater-demo');if(!section)return null;
  const get=id=>document.getElementById('tank-'+id),canvas=document.getElementById('dye-tank-canvas'),renderer=createTankRenderer(canvas),motion=createTankMotion(),pacer=createTankPacer();
  const flowCanvas=document.getElementById('tank-flow-canvas'),ctx=flowCanvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const worker=new Worker(new URL('./dye-tank-worker.mjs',import.meta.url),{type:'module'});
  const ramp=get('legend-ramp'),rampCtx=ramp.getContext('2d');
  const salinityColor=t=>{const stops=[[20,25,56],[45,130,132],[244,220,153]],a=Math.min(1,t)*2,i=Math.min(1,Math.floor(a)),f=a-i;return stops[i].map((c,k)=>c+(stops[i+1][k]-c)*f);};
  const rotationColor=w=>{const a=Math.min(1,Math.abs(w)/5),color=w>0?[244,160,120]:[104,197,218];return [8,30,47].map((c,k)=>c+(color[k]-c)*a);};
  let snapshot=null,flowU=null,flowV=null,version=0,busy=true,paused=reduced,visible=false,parentVisible=true,presenting=false,preset='salt',resetTimer,request=0,pending=0,paintCount=0,nextVisibilityCheck=0;
  const api={diagnostics:null,renderStats:{mode:renderer.mode,frames:0},selectPreset,nextPreset,isVisible:()=>visible,setPresent,onParentVisibility:active=>{parentVisible=active;pacer.reset();checkVisibility();}};window.__dyeTank=api;
  function checkVisibility(){const r=canvas.getBoundingClientRect(),wasVisible=visible;visible=parentVisible&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;if(visible&&!wasVisible)onActivate();}
  function dropAt(x=.12,y=Number(get('drop').value)<Number(get('water').value)?.153:.027){
    onActivate();worker.postMessage({type:'drop',version,drop:{x,y,salinity:Number(get('drop').value),radius:Number(get('radius').value)/1000}});
    get('status').textContent=`Released ${get('drop').value} g/kg dye. The simulated clock measures tank time.`;
  }
  function labels(){
    for(const key of ['water','drop'])get(key+'-value').textContent=get(key).value+' g/kg';get('radius-value').textContent=get('radius').value+' mm';
    const contrast=Number(get('drop').value)-Number(get('water').value);get('density-meaning').textContent=preset==='layers'?'The drop moves toward water of similar density.':contrast>0?'The drop is denser than the water.':contrast<0?'The drop is less dense than the water.':'The drop matches the water. Diffusion spreads the dye.';
    get('pause').textContent=paused?'Play':'Pause';get('pause').setAttribute('aria-pressed',String(paused));get('start').hidden=!paused||Boolean(snapshot?.diagnostics.time);
    document.getElementById('folio-pause').textContent=paused?'▷':'Ⅱ';
    get('view-label').textContent=get('view').selectedOptions[0].textContent;get('legend').hidden=get('view').value==='dye';
    get('legend').dataset.view=get('view').value;get('legend-low').textContent=get('view').value==='salinity'?'0 g/kg':'−5 s⁻¹';get('legend-high').textContent=get('view').value==='salinity'?'40 g/kg':'+5 s⁻¹';
    for(let i=0;i<256;i++){const color=get('view').value==='salinity'?salinityColor(i/255):rotationColor(i/255*10-5);rampCtx.fillStyle=`rgb(${color.join(',')})`;rampCtx.fillRect(i,0,1,8);}
  }
  function reset(){
    version++;busy=true;pending=++request;pacer.reset();snapshot=flowU=flowV=null;api.diagnostics=null;motion.reset();if(paused)motion.pause(performance.now());renderer.reset();ctx.clearRect(0,0,flowCanvas.width,flowCanvas.height);labels();
    const water=Number(get('water').value),drop=Number(get('drop').value),layers=preset==='layers';
    worker.postMessage({type:'reset',version,request:pending,options:{nx:256,ny:128,waterSalinity:layers?water-6:water,bottomSalinity:layers?water+6:water},drop:{x:.12,y:layers?.05:drop<water?.153:.027,radius:Number(get('radius').value)/1000,salinity:drop}});
  }
  function selectPreset(value){
    preset=value;const config={salt:[30,36],fresh:[30,24],layers:[28,29]}[value];get('water').value=config[0];get('drop').value=config[1];
    section.querySelectorAll('[data-tank-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tankPreset===value)));onActivate();reset();
  }
  function nextPreset(direction){const keys=['salt','fresh','layers'];selectPreset(keys[(keys.indexOf(preset)+direction+3)%3]);}
  function setPresent(active){presenting=active;pacer.reset();if(active){visible=true;resize();draw();}else resize();}
  function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);flowCanvas.width=canvas.width;flowCanvas.height=canvas.height;draw();}
  function sample(a,w,h,x,y){x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const i=Math.min(w-2,Math.floor(x)),j=Math.min(h-2,Math.floor(y)),fx=x-i,fy=y-j,k=j*w+i;return(1-fy)*((1-fx)*a[k]+fx*a[k+1])+fy*((1-fx)*a[k+w]+fx*a[k+w+1]);}
  function draw(now=performance.now()){
    const state=motion.sample(now);if(!snapshot||!state||!canvas.width||!canvas.height)return;
    const {nx,ny,u,v}=snapshot;
    renderer.draw(state.mix,get('view').value);flowCanvas.hidden=!get('flow').checked;
    api.renderStats.frames=++paintCount;
    if(get('flow').checked){
      ctx.clearRect(0,0,flowCanvas.width,flowCanvas.height);
      ctx.strokeStyle='rgba(218,241,235,.33)';ctx.lineWidth=Math.max(.7,canvas.width/1500);ctx.beginPath();
      for(let j=0;j<8;j++)for(let i=0;i<12;i++){
        let x=(i+.5)*nx/12,y=(j+.5)*ny/8;ctx.moveTo(x/nx*canvas.width,y/ny*canvas.height);
        for(let n=0;n<32;n++){let vx=sample(u,nx+1,ny,x,y-.5),vy=sample(v,nx,ny+1,x-.5,y);if(flowU){vx=sample(flowU,nx+1,ny,x,y-.5)*(1-state.mix)+vx*state.mix;vy=sample(flowV,nx,ny+1,x-.5,y)*(1-state.mix)+vy*state.mix;}const speed=Math.hypot(vx,vy);if(speed<.00015)break;const dx=snapshot.width/nx,dy=snapshot.height/ny,h=.5*Math.min(dx,dy);x+=vx/speed*h/dx;y+=vy/speed*h/dy;if(x<1||x>nx-1||y<1||y>ny-1)break;ctx.lineTo(x/nx*canvas.width,y/ny*canvas.height);}
      }ctx.stroke();
    }
    get('clock').textContent=state.time.toFixed(1)+' s';get('start').hidden=!paused||state.time>0;
  }
  function advance(now){
    const active=!paused&&!document.hidden&&parentVisible&&(visible||presenting);
    const count=pacer.request(now,Number(get('speed').value),active,!busy);
    if(count){busy=true;pending=++request;worker.postMessage({type:'advance',version,request:pending,count});}
  }
  function frame(now){
    requestAnimationFrame(frame);
    // The iframe can become visible after its first observer notification.
    if(parentVisible&&!document.hidden&&now>=nextVisibilityCheck){checkVisibility();nextVisibilityCheck=now+200;}
    if(!paused&&!document.hidden&&parentVisible&&(visible||presenting))draw(now);
    advance(now);
  }
  worker.onmessage=({data})=>{
    if(data.version!==version)return;if(data.request===pending)busy=false;
    if(data.type==='error'){paused=true;labels();get('status').textContent='The calculation stopped: '+data.message+'. Reset to start again.';return;}
    const old=snapshot;snapshot=data.snapshot;const now=performance.now();if(paused&&data.operation==='drop'){motion.reset();motion.pause(now);renderer.reset();}
    const mix=motion.push(snapshot,now);renderer.push(snapshot,mix);api.diagnostics=snapshot.diagnostics;
    if(get('flow').checked&&old&&old.nx===snapshot.nx&&old.ny===snapshot.ny){if(!flowU){flowU=old.u.slice();flowV=old.v.slice();}else{for(let i=0;i<flowU.length;i++)flowU[i]+=mix*(old.u[i]-flowU[i]);for(let i=0;i<flowV.length;i++)flowV[i]+=mix*(old.v[i]-flowV[i]);}}else flowU=flowV=null;
    if(paused)draw(now);advance(now);
  };
  worker.onerror=()=>{paused=true;labels();get('status').textContent='The browser could not run the fluid calculation. Reload to try again.';};
  function togglePause(){paused=!paused;const now=performance.now();if(paused)motion.pause(now);else motion.resume(now);labels();pacer.reset();draw(now);}
  get('drop-button').onclick=()=>dropAt();get('reset').onclick=reset;get('pause').onclick=togglePause;get('start-button').onclick=()=>{if(paused)togglePause();};
  let dragging=false,lastDrop=0,lastPoint=null;
  function pointerDrop(e){const r=canvas.getBoundingClientRect(),x=Math.max(0,Math.min(.24,(e.clientX-r.left)/r.width*.24)),y=Math.max(0,Math.min(.18,(e.clientY-r.top)/r.height*.18));dropAt(x,y);lastDrop=performance.now();lastPoint=[x,y];}
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;canvas.setPointerCapture(e.pointerId);pointerDrop(e);});
  canvas.addEventListener('pointermove',e=>{if(!dragging||performance.now()-lastDrop<70)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*.24,y=(e.clientY-r.top)/r.height*.18;if(Math.hypot(x-lastPoint[0],y-lastPoint[1])>.003)pointerDrop(e);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{dragging=false;});
  canvas.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dropAt();}if(e.code==='Space'){e.preventDefault();e.stopPropagation();togglePause();}});
  for(const key of ['drop','radius'])get(key).addEventListener('input',labels);
  get('water').addEventListener('input',()=>{preset='custom';section.querySelectorAll('[data-tank-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));labels();clearTimeout(resetTimer);resetTimer=setTimeout(reset,120);});
  for(const key of ['view','flow'])get(key).addEventListener('change',()=>{onActivate();labels();draw();});
  section.querySelectorAll('[data-tank-preset]').forEach(b=>b.onclick=()=>selectPreset(b.dataset.tankPreset));
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)onActivate();pacer.reset();},{threshold:0}).observe(canvas);
  window.addEventListener('scroll',checkVisibility,{passive:true});window.addEventListener('resize',checkVisibility);
  document.addEventListener('visibilitychange',()=>{pacer.reset();});window.addEventListener('pagehide',()=>worker.terminate(),{once:true});
  labels();reset();resize();requestAnimationFrame(frame);return api;
}
