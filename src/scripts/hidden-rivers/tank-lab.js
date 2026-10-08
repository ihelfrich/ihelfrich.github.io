import { startDyeTank3D } from './dye-tank-3d-ui.js';

export function startTankLab() {
  const root=document.querySelector('.tank-only-page .ocean-folio');if(!root)return;
  const params=new URLSearchParams(location.search),field=params.get('field')||'dye';
  const tank=startDyeTank3D({initialField:field,initialGeometry:params.get('geometry')||(field==='vorticity-z'?'section':'volume'),initialPlane:params.has('section')?Number(params.get('section')):.5,
    onDisplayChange:state=>{const url=new URL(location.href);url.searchParams.set('field',state.field);url.searchParams.set('geometry',state.geometry);url.searchParams.set('section',String(state.plane));history.replaceState(null,'',url);}});
  const trigger=document.getElementById('tank-present'),exit=document.getElementById('folio-exit'),controls=root.querySelector('.folio-present-controls');
  let presenting=false,scrollBefore=0,timer;
  function showControls(){root.classList.add('folio-controls-visible');clearTimeout(timer);timer=setTimeout(()=>root.classList.remove('folio-controls-visible'),1800);}
  async function present(active,fullscreen=false){
    if(active&&!presenting)scrollBefore=scrollY;presenting=active;
    root.classList.toggle('folio-is-presenting',active);root.classList.toggle('folio-present-tank',active);controls.hidden=!active;tank.setPresent(active);
    if(active){root.tabIndex=-1;root.focus({preventScroll:true});showControls();if(fullscreen&&!document.fullscreenElement)try{await root.requestFullscreen();if(!presenting&&document.fullscreenElement===root)await document.exitFullscreen();}catch{/* The viewport presentation remains available. */}}
    else{clearTimeout(timer);root.classList.remove('folio-controls-visible');if(document.fullscreenElement===root)await document.exitFullscreen();trigger.focus({preventScroll:true});window.scrollTo({top:scrollBefore,behavior:'instant'});}
  }
  trigger.onclick=()=>present(true,true);exit.onclick=()=>present(false);
  root.addEventListener('pointermove',()=>{if(presenting)showControls();});
  document.addEventListener('keydown',event=>{if(!presenting)return;if(event.key==='Escape'){event.preventDefault();present(false);}else if(event.code==='Space'&&!event.target.matches('input,select,textarea')){event.preventDefault();document.getElementById('tank-pause').click();}});
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&presenting)present(false);});
  return tank;
}
