export function startDyeTank({onActivate=()=>{}}={}){
  const section=document.getElementById('saltwater-demo');if(!section)return null;
  const get=id=>document.getElementById('tank-'+id),canvas=document.getElementById('dye-tank-canvas'),ctx=canvas.getContext('2d',{alpha:false});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const worker=new Worker(new URL('./dye-tank-worker.mjs',import.meta.url),{type:'module'});
  const bitmap=document.createElement('canvas'),ink=bitmap.getContext('2d',{alpha:false});
  const ramp=get('legend-ramp'),rampCtx=ramp.getContext('2d');
  const salinityColor=t=>{const stops=[[20,25,56],[45,130,132],[244,220,153]],a=Math.min(1,t)*2,i=Math.min(1,Math.floor(a)),f=a-i;return stops[i].map((c,k)=>c+(stops[i+1][k]-c)*f);};
  const rotationColor=w=>{const a=Math.min(1,Math.abs(w)/5),color=w>0?[244,160,120]:[104,197,218];return [8,30,47].map((c,k)=>c+(color[k]-c)*a);};
  let snapshot=null,version=0,busy=true,paused=reduced,visible=false,parentVisible=true,presenting=false,preset='salt',last=0,credit=0,resetTimer;
  const api={diagnostics:null,selectPreset,nextPreset,isVisible:()=>visible,setPresent,onParentVisibility:active=>{parentVisible=active;last=0;}};window.__dyeTank=api;
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
    version++;busy=true;credit=0;last=0;snapshot=null;api.diagnostics=null;labels();
    const water=Number(get('water').value),drop=Number(get('drop').value),layers=preset==='layers';
    worker.postMessage({type:'reset',version,options:{nx:128,ny:96,waterSalinity:layers?water-6:water,bottomSalinity:layers?water+6:water},drop:{x:.12,y:layers?.05:drop<water?.153:.027,radius:Number(get('radius').value)/1000,salinity:drop}});
  }
  function selectPreset(value){
    preset=value;const config={salt:[30,36],fresh:[30,24],layers:[28,29]}[value];get('water').value=config[0];get('drop').value=config[1];
    section.querySelectorAll('[data-tank-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tankPreset===value)));onActivate();reset();
  }
  function nextPreset(direction){const keys=['salt','fresh','layers'];selectPreset(keys[(keys.indexOf(preset)+direction+3)%3]);}
  function setPresent(active){presenting=active;last=0;if(active){visible=true;resize();draw();}else resize();}
  function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);draw();}
  function sample(a,w,h,x,y){x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const i=Math.min(w-2,Math.floor(x)),j=Math.min(h-2,Math.floor(y)),fx=x-i,fy=y-j,k=j*w+i;return(1-fy)*((1-fx)*a[k]+fx*a[k+1])+fy*((1-fx)*a[k+w]+fx*a[k+w+1]);}
  function draw(){
    if(!snapshot||!canvas.width||!canvas.height)return;
    const {nx,ny,dye,coral,salinity,u,v,diagnostics}=snapshot,view=get('view').value;
    if(bitmap.width!==nx||bitmap.height!==ny){bitmap.width=nx;bitmap.height=ny;}
    const pixels=ink.createImageData(nx,ny),rgba=pixels.data;
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const k=j*nx+i,offset=4*k,s=salinity[k]/40;let r=5+5*s,g=24+14*s,b=37+23*s;
      if(view==='salinity'){[r,g,b]=salinityColor(s);}
      else if(view==='vorticity'){
        const il=Math.max(0,i-1),ir=Math.min(nx-1,i+1),jt=Math.max(0,j-1),jb=Math.min(ny-1,j+1),dx=.24/nx,dy=.18/ny;
        const omega=(v[j*nx+ir]+v[(j+1)*nx+ir]-v[j*nx+il]-v[(j+1)*nx+il])/(2*Math.max(1,ir-il)*dx)-(u[jb*(nx+1)+i]+u[jb*(nx+1)+i+1]-u[jt*(nx+1)+i]-u[jt*(nx+1)+i+1])/(2*Math.max(1,jb-jt)*dy);
        [r,g,b]=rotationColor(omega);
      }else{
        const concentration=Math.max(0,dye[k]),fresh=concentration?Math.min(1,Math.max(0,coral[k]/concentration)):0,a=1-Math.exp(-6*Math.pow(concentration,.72));
        const color=[248,206-79*fresh,116+44*fresh];r+=(color[0]-r)*a;g+=(color[1]-g)*a;b+=(color[2]-b)*a;
      }
      rgba[offset]=r;rgba[offset+1]=g;rgba[offset+2]=b;rgba[offset+3]=255;
    }
    ink.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    if(get('flow').checked){
      ctx.strokeStyle='rgba(218,241,235,.33)';ctx.lineWidth=Math.max(.7,canvas.width/1500);ctx.beginPath();
      for(let j=0;j<8;j++)for(let i=0;i<12;i++){
        let x=(i+.5)*nx/12,y=(j+.5)*ny/8;ctx.moveTo(x/nx*canvas.width,y/ny*canvas.height);
        for(let n=0;n<16;n++){const vx=sample(u,nx+1,ny,x,y-.5),vy=sample(v,nx,ny+1,x-.5,y),speed=Math.hypot(vx,vy);if(speed<.00015)break;x+=vx/speed*.5;y+=vy/speed*.5;if(x<1||x>nx-1||y<1||y>ny-1)break;ctx.lineTo(x/nx*canvas.width,y/ny*canvas.height);}
      }ctx.stroke();
    }
    get('clock').textContent=diagnostics.time.toFixed(1)+' s';get('start').hidden=!paused||diagnostics.time>0;api.diagnostics=diagnostics;
  }
  function frame(now){
    requestAnimationFrame(frame);const elapsed=last?Math.min(.08,(now-last)/1000):0;last=now;
    if(paused||document.hidden||!parentVisible||(!visible&&!presenting)){credit=0;return;}
    credit=Math.min(.08,credit+elapsed*Number(get('speed').value));if(!busy&&credit>=.01){const count=Math.min(8,Math.floor(credit/.01));credit-=count*.01;busy=true;worker.postMessage({type:'advance',version,count});}
  }
  worker.onmessage=({data})=>{
    if(data.version!==version)return;busy=false;
    if(data.type==='error'){paused=true;labels();get('status').textContent='The calculation stopped: '+data.message+'. Reset to start again.';return;}
    snapshot=data.snapshot;draw();
  };
  worker.onerror=()=>{paused=true;labels();get('status').textContent='The browser could not run the fluid calculation. Reload to try again.';};
  get('drop-button').onclick=()=>dropAt();get('reset').onclick=reset;get('pause').onclick=()=>{paused=!paused;labels();last=0;};get('start-button').onclick=()=>{paused=false;labels();last=0;};
  canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();dropAt((e.clientX-r.left)/r.width*.24,(e.clientY-r.top)/r.height*.18);});
  canvas.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dropAt();}if(e.code==='Space'){e.preventDefault();e.stopPropagation();paused=!paused;labels();}});
  for(const key of ['drop','radius'])get(key).addEventListener('input',labels);
  get('water').addEventListener('input',()=>{preset='custom';section.querySelectorAll('[data-tank-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));labels();clearTimeout(resetTimer);resetTimer=setTimeout(reset,120);});
  for(const key of ['view','flow'])get(key).addEventListener('change',()=>{onActivate();labels();draw();});
  section.querySelectorAll('[data-tank-preset]').forEach(b=>b.onclick=()=>selectPreset(b.dataset.tankPreset));
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)onActivate();last=0;},{threshold:.15}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{last=0;});window.addEventListener('pagehide',()=>worker.terminate(),{once:true});
  labels();reset();resize();requestAnimationFrame(frame);return api;
}
