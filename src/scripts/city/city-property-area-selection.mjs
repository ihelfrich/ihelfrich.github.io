/** Temporary pointer surface above the unobstructed map. Geographic projection
 * stays in the active renderer. Keyboard users can use the visible map instead. */
export function createPropertyAreaSelection(doc,{getCity,onSelect,onStatus=()=>{}}){
  let overlay=null,start=null,box=null,returnFocus=null;
  const cancel=()=>{overlay?.remove();overlay=null;start=null;doc.removeEventListener('keydown',key);returnFocus?.focus?.();};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();cancel();onStatus('Area selection canceled.');}};
  function begin(){
    cancel();const scene=getCity(),rect=scene?.getPropertySelectionSurface?.();
    if(!rect||rect.width<48||rect.height<48){onStatus('Make the map visible, or use the current map area.');return false;}
    returnFocus=doc.activeElement;overlay=doc.createElement('div');overlay.className='property-area-draw';overlay.setAttribute('role','region');overlay.setAttribute('aria-label','Draw a search rectangle on the map');
    Object.assign(overlay.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    const hint=doc.createElement('span');hint.textContent='Drag an area · Esc to cancel';overlay.append(hint);
    box=doc.createElement('div');box.className='property-area-box';overlay.append(box);
    const point=e=>[Math.max(rect.left,Math.min(rect.left+rect.width,e.clientX)),Math.max(rect.top,Math.min(rect.top+rect.height,e.clientY))];
    const selection=end=>({left:Math.min(start[0],end[0]),top:Math.min(start[1],end[1]),width:Math.abs(end[0]-start[0]),height:Math.abs(end[1]-start[1])});
    overlay.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();start=point(e);overlay.setPointerCapture?.(e.pointerId);});
    overlay.addEventListener('pointermove',e=>{if(!start)return;const r=selection(point(e));Object.assign(box.style,{left:r.left-rect.left+'px',top:r.top-rect.top+'px',width:r.width+'px',height:r.height+'px'});});
    overlay.addEventListener('pointerup',e=>{if(!start)return;const r=selection(point(e)),bounds=r.width>=12&&r.height>=12?scene.propertyBoundsForScreenRectangle?.(r):null;cancel();if(bounds){onSelect(bounds);onStatus('Search area fixed to the drawn geographic rectangle.');}else onStatus('Draw a larger area within the map.');});
    overlay.addEventListener('pointercancel',cancel);doc.body.append(overlay);doc.addEventListener('keydown',key);onStatus('Drag a rectangle on the map. Press Escape to cancel.');return true;
  }
  return {begin,cancel,dispose:cancel};
}
