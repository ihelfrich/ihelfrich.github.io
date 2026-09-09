import {normalizeTone} from '../../lib/city-tone.mjs';

/** Presentation controls stay independent of the selected rendering engine. */
export function createWorkbench(doc,{getCity=()=>null,setMode=()=>{},property,showPlaces=()=>{},onNow=()=>{}}={}) {
  const $=id=>doc.getElementById(id),listeners=[];
  let tone=normalizeTone(),parcelVisible=true,streetLabels=true,focused=false;
  const listen=(node,event,handler)=>{if(node){node.addEventListener(event,handler);listeners.push(()=>node.removeEventListener(event,handler))}};
  function focus(value) {
    focused=Boolean(value);doc.body.classList.toggle('focus-mode',focused);
    for(const selector of ['.city-header','.workspace-command','#explorer','.mode-bar','#conditions-card','#lighting-dock','#map-legend']) {
      const node=doc.querySelector(selector);if(node)node.inert=focused;
    }
    $('focus-view')?.setAttribute('aria-pressed',String(focused));
    const label=$('focus-view')?.querySelector('span');if(label)label.textContent=focused?'Restore UI':'Focus';
    if(focused)$('focus-view')?.focus();
  }
  function applyTone(value) {
    tone=normalizeTone(value,tone);getCity()?.setTone?.(tone);
    doc.querySelectorAll('[data-tone]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tone===tone.preset)));
    if($('dock-tone'))$('dock-tone').value=tone.preset;
    if($('tone-exposure'))$('tone-exposure').value=String(tone.exposure);
    if($('tone-exposure-label'))$('tone-exposure-label').textContent=`${tone.exposure>0?'+':''}${tone.exposure.toFixed(1)} stops`;
  }
  function refreshRenderer() {
    const photo=getCity()?.engine==='cesium';
    const labels=Boolean(getCity()?.capabilities?.streetLabels);
    if($('toggle-street-labels')){$('toggle-street-labels').disabled=!labels;$('toggle-street-labels').checked=streetLabels}
    if($('street-labels-quick')){$('street-labels-quick').hidden=!labels;$('street-labels-quick').setAttribute('aria-pressed',String(streetLabels))}
    getCity()?.setStreetLabels?.(streetLabels);
    setStreetLabelStatus(labels?(getCity()?.getStreetLabelStatus?.()||{status:streetLabels?'loading':'disabled'}):{status:'open-map'});
    if($('sun-study-controls'))$('sun-study-controls').hidden=photo;
    if($('photo-tone-controls'))$('photo-tone-controls').hidden=!photo;
    if($('light-now'))$('light-now').hidden=photo;
    if($('light-mode-label'))$('light-mode-label').textContent=photo?'CAPTURED CITY':'SOLAR TIME';
    if($('tone-basis'))$('tone-basis').textContent=photo
      ?'Scene color and exposure only. Captured shadows and weather remain in the imagery; provider credits are unchanged.'
      :'Color and exposure treatment, combined with the selected sun and observed airport conditions.';
    getCity()?.setParcelVisible?.(parcelVisible);applyTone(tone);
  }
  function setStreetLabelStatus(value={}) {
    const status=$('street-label-status');if(!status)return;
    status.textContent=!streetLabels&&getCity()?.capabilities?.streetLabels?'Street names hidden.':value.status==='open-map'?'Connect photographic view to use the street-name overlay.':value.status==='unavailable'?'Street names could not load. Toggle the overlay to retry.':value.status==='disabled'?'Street names hidden.':value.status==='loading'?'Loading mapped street names…':value.status==='partial'?`${value.visibleCount||0} mapped street labels in view. Some street tiles could not load; coverage is partial.`:Number.isFinite(value.visibleCount)&&value.visibleCount>0?`${value.visibleCount} mapped street labels in view. Labels thin out with distance.`:'Street names are enabled. Zoom toward streets for local detail.';
  }
  function applyStreetLabels(value) {
    streetLabels=Boolean(value);if($('toggle-street-labels'))$('toggle-street-labels').checked=streetLabels;
    $('street-labels-quick')?.setAttribute('aria-pressed',String(streetLabels));getCity()?.setStreetLabels?.(streetLabels);
    setStreetLabelStatus(getCity()?.getStreetLabelStatus?.()||{status:streetLabels?'loading':'disabled'});
  }
  listen($('city-search-form'),'submit',event=>{
    event.preventDefault();const query=$('city-search-query').value.trim();if(!query)return;
    focus(false);
    if($('city-search-domain').value==='address'){setMode('properties');property?.searchAddress(query)}
    else {setMode('explore');if($('place-search'))$('place-search').value=query;showPlaces(query)}
  });
  listen($('focus-view'),'click',()=>focus(!focused));
  listen($('weather-toggle'),'click',()=>{const expanded=$('weather-expanded');expanded.hidden=!expanded.hidden;$('weather-toggle').setAttribute('aria-expanded',String(!expanded.hidden))});
  listen($('sheet-size'),'click',()=>{
    const expanded=$('explorer').classList.toggle('sheet-expanded');
    $('sheet-size').setAttribute('aria-expanded',String(expanded));
    $('sheet-size').setAttribute('aria-label',expanded?'Reduce inspector height':'Expand inspector height');
  });
  doc.querySelectorAll('[data-tone]').forEach(button=>listen(button,'click',()=>applyTone({preset:button.dataset.tone})));
  listen($('dock-tone'),'change',()=>applyTone({preset:$('dock-tone').value}));
  listen($('tone-exposure'),'input',()=>applyTone({exposure:Number($('tone-exposure').value)}));
  listen($('reset-tone'),'click',()=>applyTone({preset:'natural',exposure:0}));
  listen($('toggle-parcel'),'change',()=>{parcelVisible=$('toggle-parcel').checked;getCity()?.setParcelVisible?.(parcelVisible)});
  listen($('toggle-street-labels'),'change',()=>applyStreetLabels($('toggle-street-labels').checked));
  listen($('street-labels-quick'),'click',()=>applyStreetLabels(!streetLabels));
  listen($('studio-inventory'),'click',()=>{setMode('properties');property?.selectTab('inventory')});
  listen($('open-studio'),'click',()=>setMode('layers'));
  listen($('light-now'),'click',onNow);
  listen($('keyboard-help'),'click',()=>$('shortcuts-dialog').showModal());
  listen($('close-shortcuts'),'click',()=>$('shortcuts-dialog').close());
  listen(doc,'keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!doc.querySelector('dialog[open]')) {
      event.preventDefault();focus(false);$('city-search-query')?.focus();return;
    }
    if(event.key==='Escape'&&focused){focus(false);return}
    const editing=event.target?.closest?.('input,textarea,select,[contenteditable="true"]');
    if(!editing&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!doc.querySelector('dialog[open]')&&event.key.toLowerCase()==='f') {
      event.preventDefault();focus(!focused);
    }
  });
  return {
    refreshRenderer,focus,setStreetLabelStatus,
    updateSolar(hour,isNow) {
      // A schematic daily arc, not a survey of the solar azimuth or altitude.
      const angle=(Math.max(6,Math.min(18,hour))-6)/12*Math.PI;
      $('solar-marker')?.setAttribute('cx',String(45-31*Math.cos(angle)));
      $('solar-marker')?.setAttribute('cy',String(35-29*Math.sin(angle)));
      $('solar-marker')?.setAttribute('opacity',hour<6||hour>18?'0.3':'1');
      $('light-now')?.setAttribute('aria-pressed',String(isNow));
    },
    updateLegend({publicCount=0,importCount=0,heightStudy=false}={}) {
      if($('map-legend'))$('map-legend').hidden=publicCount+importCount===0&&!heightStudy;
      if($('legend-public'))$('legend-public').hidden=publicCount===0;
      if($('legend-import'))$('legend-import').hidden=importCount===0;
      if($('legend-height'))$('legend-height').hidden=!heightStudy;
    },
    dispose(){listeners.forEach(remove=>remove());focus(false)},
  };
}
