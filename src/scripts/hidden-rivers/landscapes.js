import { COAST_PRESETS } from './places.mjs';

export function initLandscapes() {
  const select=document.getElementById('landscape-place');
  if (!select) return null;
  const root=document.getElementById('coastal-globe');
  const button=document.getElementById('ocean-open-coast');
  const status=document.getElementById('coast-globe-status');
  const description=document.getElementById('landscape-description');
  const requested=new URLSearchParams(location.search).get('place');
  let current=COAST_PRESETS[requested] || COAST_PRESETS.fayetteville;
  let globe, opening, selectedPixel;
  select.value=current.id;
  description.textContent=current.note;
  const placeholder=root.querySelector('.globe-placeholder');
  if (placeholder) {
    placeholder.querySelector('span').textContent=`${Math.abs(current.latitude).toFixed(2)}° ${current.latitude<0?'S':'N'} / ${Math.abs(current.longitude).toFixed(2)}° ${current.longitude<0?'W':'E'}`;
    placeholder.querySelector('small').textContent=current.label.toUpperCase();
  }

  function fly() {
    globe?.flyTo(current.longitude,current.latitude,current);
  }
  async function open() {
    if (globe) {
      const state=globe.getStatus().state;
      if (['partial','unavailable','error'].includes(state)) await globe.reconnect();
      fly();return globe;
    }
    if (opening) return opening;
    button.disabled=true;status.textContent='Loading terrain, aerial imagery, and buildings…';
    opening=(async()=>{
      try {
        const {mountCesiumCoast}=await import('./cesium-coast.js');
        placeholder?.remove();
        globe=await mountCesiumCoast(root,{statusElement:status,initialPreset:current.id});
        fly();button.textContent='Return to selected place';
        return globe;
      } catch {
        status.textContent='The 3D landscape could not start. Try opening it again.';
        opening=null;
      } finally {button.disabled=false;}
    })();
    return opening;
  }
  function choose(place) {
    current=place;select.value=place.id;description.textContent=place.note;
    const url=new URL(location.href);url.searchParams.set('place',place.id);history.replaceState(null,'',url);
    open();
  }
  select.addEventListener('change',()=>{if(COAST_PRESETS[select.value])choose(COAST_PRESETS[select.value]);});
  button.addEventListener('click',open);
  document.getElementById('landscape-reset').addEventListener('click',()=>open());
  document.getElementById('landscape-share').addEventListener('click',async()=>{
    const url=new URL(location.href);url.searchParams.set('place',current.id);url.hash='landscapes';
    try {await navigator.clipboard.writeText(url.href);status.textContent=`Link copied for ${current.label}.`;}
    catch {status.textContent='Copy the selected place from the address bar.';history.replaceState(null,'',url);}
  });
  document.getElementById('landscape-tessera').addEventListener('click',()=>{
    const point=selectedPixel || {lon:18.4,lat:-34.2};
    choose({...COAST_PRESETS.peninsula,longitude:point.lon,latitude:point.lat,range:3500,note:'Selected pixel in the 2024 Cape Peninsula Tessera window.'});
    document.getElementById('landscapes').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
  const observer=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();open();}
  },{rootMargin:'200px'});
  observer.observe(root);
  return {open, setTesseraPosition(point){selectedPixel=point;},getStatus:()=>globe?.getStatus()};
}
