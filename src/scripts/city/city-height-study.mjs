/** A whole-parcel height graphic; no proposed footprint or entitlement is inferred. */
export function createHeightStudy(root,{getCity=()=>null,getEvidence=()=>null,onChange=()=>{}}={}) {
  root.innerHTML=`<span class="eyebrow">SEE THE VERTICAL DIMENSION</span><h3>Parcel height study</h3><p class="small-note">Raise the selected parcel outline into a 3D reference volume. It uses the whole parcel, including its holes. This is not a proposed building footprint, a setback analysis, or an approved height.</p><div class="height-study-inputs"><label>Stories<input id="height-stories" type="number" min="1" max="100" step="1" placeholder="Your assumption" /></label><label>Floor height · metres<input id="height-floor" type="number" min="2" max="6" step="0.1" placeholder="2–6 m" /></label></div><div class="button-row"><button id="height-show" class="secondary-button" type="button">Show height study</button><button id="height-hide" class="text-button" type="button" disabled>Hide</button></div><p id="height-status" class="small-note" role="status">Select an official City parcel, then enter your height assumptions.</p>`;
  const $=id=>root.querySelector('#height-'+id);let study=null;
  function clear(message='Height study hidden.') {study=null;getCity()?.setDevelopmentVolume?.(null);$('hide').disabled=true;$('status').textContent=message;onChange(false)}
  function draw() {
    if(!study)return;
    const city=getCity();
    if(!city?.setDevelopmentVolume){$('status').textContent='The renderer is not ready for a height study.';onChange(false);return}
    const result=city.setDevelopmentVolume(study);
    if(result?.status!=='shown') {clear(result?.message||'This parcel geometry cannot support a height study.');return}
    $('hide').disabled=false;onChange(true);
    const reference=result.reference||(city.engine==='cesium'?'Captured-surface reference may coincide with roofs; not surveyed ground.':'Anchored to the open map’s display plane; not surveyed elevation.');
    $('status').textContent=`${study.stories} stories × ${study.floorHeightMetres} m = ${(study.stories*study.floorHeightMetres).toFixed(1)} m reference height. ${reference}`;
  }
  const show=()=>{
    const parcel=getEvidence()?.parcels?.parcel,stories=Number($('stories').value),floorHeightMetres=Number($('floor').value);
    if(!parcel){clear('Select an exact official parcel in Evidence first.');return}
    if(!Number.isSafeInteger(stories)||stories<1||stories>100||!Number.isFinite(floorHeightMetres)||floorHeightMetres<2||floorHeightMetres>6){clear('Enter 1–100 whole stories and a 2–6 m floor height.');return}
    study={parcel,stories,floorHeightMetres};draw();
  };
  const hide=()=>clear(),invalidate=()=>clear('Height assumptions changed. Show the study again to apply them.');
  $('show').addEventListener('click',show);$('hide').addEventListener('click',hide);
  $('stories').addEventListener('input',invalidate);$('floor').addEventListener('input',invalidate);
  return {setEvidence(){clear('Selection changed. Enter height assumptions and show the selected parcel study.');$('stories').value='';$('floor').value=''},refreshRenderer:draw,dispose(){clear();$('show').removeEventListener('click',show);$('hide').removeEventListener('click',hide);$('stories').removeEventListener('input',invalidate);$('floor').removeEventListener('input',invalidate)}};
}
