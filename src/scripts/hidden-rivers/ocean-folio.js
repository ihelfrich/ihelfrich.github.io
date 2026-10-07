import {startDyeTank} from './dye-tank-ui.js';
export function startOceanFolio(){
  const root=document.querySelector('.ocean-folio');if(!root)return;
  const chapters=JSON.parse(root.dataset.folio),image=document.querySelector('#folio-image');
  const get=id=>document.getElementById(id);let chapter=0,view=0,presenting=false,request=0,controlsTimer,scrollBeforePresentation=0;
  const params=new URLSearchParams(location.search);
  let visual=location.hash==='#saltwater-demo'?'tank':'image';
  const tank=startDyeTank({onActivate:()=>{if(!presenting)visual='tank';}});
  const embedded=params.get('embedded')==='1';document.body.classList.toggle('folio-embedded',embedded);
  const selected=chapters.findIndex(c=>c.id===params.get('study'));if(selected>=0)chapter=selected;
  const wanted=chapters[chapter].views.findIndex(v=>v.id===params.get('image'));if(wanted>=0)view=wanted;
  function links(id,items){const node=get(id);node.replaceChildren(...items.map(([label,url])=>{const a=document.createElement('a');a.textContent=label+' ↗';a.href=url;a.target='_blank';a.rel='noopener';return a;}));}
  async function render(){
    const token=++request,c=chapters[chapter],v=c.views[view];
    for(const [id,text] of Object.entries({'folio-title':c.title,'folio-place':c.place,'folio-copy':c.text,'folio-evidence':c.evidence,'folio-limits':c.limits,'folio-question':c.question,'folio-answer':c.answer,'folio-quantity':v.quantity}))get(id).textContent=text;
    root.querySelectorAll('[data-chapter]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.chapter===chapter)));
    const views=get('folio-views');views.replaceChildren(...c.views.map((item,i)=>{const b=document.createElement('button');b.type='button';b.textContent=item.label;b.dataset.view=i;b.setAttribute('aria-pressed',String(i===view));return b;}));
    get('folio-ramp').src=`/hidden-rivers/ocean-folio/${v.scale}-scale.png`;
    get('folio-ticks').replaceChildren(...v.ticks.map(t=>{const span=document.createElement('span');span.textContent=t;return span;}));
    links('folio-sources',c.sources);get('folio-print').href=`/hidden-rivers/ocean-folio/${c.print}.png`;get('folio-visual').href=`/hidden-rivers/ocean-folio/${v.id}.png`;
    get('folio-live').hidden=!c.live;if(c.live)get('folio-live').href=c.live;
    const url=new URL(location.href);url.searchParams.set('study',c.id);url.searchParams.set('image',v.id);if(presenting)url.searchParams.set('present','1');else url.searchParams.delete('present');history.replaceState(null,'',url);
    image.alt=v.alt;get('folio-image-status').hidden=false;
    const incoming=new Image();incoming.src=`/hidden-rivers/ocean-folio/${v.id}${presenting?'':'-preview'}.png`;
    try{await incoming.decode();if(token!==request)return;image.src=incoming.src;get('folio-image-status').hidden=true;}
    catch{if(token===request)get('folio-image-status').textContent='Image could not load. Try another view or reload.';}
  }
  function move(direction){if(presenting&&visual==='tank'){tank?.nextPreset(direction);return;}view+=direction;if(view<0){chapter=(chapter+chapters.length-1)%chapters.length;view=chapters[chapter].views.length-1;}else if(view>=chapters[chapter].views.length){chapter=(chapter+1)%chapters.length;view=0;}render();}
  async function present(active,fullscreen=false){if(active&&!presenting)scrollBeforePresentation=scrollY;presenting=active;root.classList.toggle('folio-is-presenting',active);root.classList.toggle('folio-present-tank',active&&visual==='tank');tank?.setPresent(active&&visual==='tank');root.querySelector('.folio-present-controls').hidden=!active;get('folio-pause').hidden=visual!=='tank';render();
    if(active){root.tabIndex=-1;root.focus({preventScroll:true});showControls();if(fullscreen&&!document.fullscreenElement)try{await root.requestFullscreen();}catch{/* Browser presentation still fills the viewport. */}}
    else{if(document.fullscreenElement===root)await document.exitFullscreen();get('folio-present').focus({preventScroll:true});window.scrollTo({top:scrollBeforePresentation,behavior:'instant'});}
  }
  function showControls(){root.classList.add('folio-controls-visible');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>root.classList.remove('folio-controls-visible'),1800);}
  root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.chapter!==undefined){visual='image';chapter=+b.dataset.chapter;view=0;render();root.querySelector('.folio-study').scrollIntoView({behavior:'smooth',block:'start'});}if(b.dataset.view!==undefined){visual='image';view=+b.dataset.view;render();}});
  get('folio-tank-link').addEventListener('click',()=>{visual='tank';});
  get('tank-present').onclick=()=>{visual='tank';present(true,!embedded);if(embedded)parent.postMessage({type:'hidden-rivers-present-request'},location.origin);};
  get('folio-present').onclick=()=>present(true,true);get('folio-exit').onclick=()=>{present(false);if(embedded)parent.postMessage({type:'hidden-rivers-exit'},location.origin);};get('folio-prev').onclick=()=>move(-1);get('folio-next').onclick=()=>move(1);
  get('folio-pause').onclick=()=>get('tank-pause').click();
  if(embedded){
    window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='hidden-rivers-present')present(Boolean(e.data.active));if(e.data?.type==='hidden-rivers-move')move(e.data.direction===-1?-1:1);if(e.data?.type==='hidden-rivers-visible')tank?.onParentVisibility(Boolean(e.data.active));if(e.data?.type==='hidden-rivers-pause-tank')get('tank-pause').click();});
    get('folio-live').addEventListener('click',e=>{e.preventDefault();parent.postMessage({type:'hidden-rivers-explore',url:get('folio-live').href},location.origin);});
  }
  root.addEventListener('pointermove',()=>{if(presenting)showControls();});
  document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;if(presenting&&e.code==='Space'&&visual==='tank'){e.preventDefault();get('tank-pause').click();return;}if(presenting&&e.key==='Escape'){present(false);if(embedded)parent.postMessage({type:'hidden-rivers-exit'},location.origin);return;}if(presenting&&['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}});
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&presenting)present(false);});
  render();if(params.get('present')==='1')present(true);
  fetch('/hidden-rivers/ocean-folio/density-lab.json').then(r=>{if(!r.ok)throw new Error('density data unavailable');return r.json();}).then(data=>{
    function update(){const t=+get('density-t').value,s=+get('density-s').value;
      const y=(t-data.temperatureStart)/data.temperatureStep,x=(s-data.salinityStart)/data.salinityStep;
      const [h,w]=data.shape,ix=Math.min(w-2,Math.max(0,Math.floor(x))),iy=Math.min(h-2,Math.max(0,Math.floor(y))),a=x-ix,b=y-iy;
      const q=(i,j)=>data.density[i*w+j],value=(1-b)*((1-a)*q(iy,ix)+a*q(iy,ix+1))+b*((1-a)*q(iy+1,ix)+a*q(iy+1,ix+1));
      get('density-temperature').textContent=`${t} °C`;get('density-salinity').textContent=s.toFixed(1);get('density-value').textContent=value.toFixed(2);
    }
    get('density-t').oninput=update;get('density-s').oninput=update;update();
  }).catch(()=>{get('density-value').textContent='Calculation unavailable';});
}
