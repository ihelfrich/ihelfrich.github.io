import { fieldSummary } from './coastal-math.mjs';

const DATA = '/hidden-rivers/coastal/';
// Cividis: increasing luminance for increasing similarity, with a fixed scale.
const CIVIDIS = [[0,34,78],[42,63,108],[78,87,108],[111,112,115],[146,139,111],[184,168,103],[223,200,88],[254,232,56]];
const CONTRAST = [[48,114,170],[137,184,211],[235,236,227],[237,172,100],[195,87,36]];
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
function ramp(stops,t) { const q=clamp(t,0,1)*(stops.length-1), i=Math.min(stops.length-2,Math.floor(q)); return stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*(q-i))); }
function formatCoordinate(lon,lat) { return `${Math.abs(lat).toFixed(5)}° ${lat<0?'S':'N'}, ${Math.abs(lon).toFixed(5)}° ${lon<0?'W':'E'}`; }

export function createCoastalExplorer(root, {onLocation = () => {}} = {}) {
  root.innerHTML = `
    <div class="coastal-tools">
      <button type="button" class="coastal-reference" data-reference="A" aria-pressed="true">Set reference A</button>
      <button type="button" class="coastal-reference" data-reference="B" aria-pressed="false">Set comparison B</button>
      <label>Field <select data-control="mode"><option value="similarity">Similarity to A</option><option value="contrast">A versus B</option></select></label>
      <button type="button" data-action="download" disabled>Download scores CSV</button>
    </div>
    <div class="coastal-layout">
      <figure class="coastal-view">
        <canvas class="coastal-canvas" data-canvas="imagery" width="768" height="768" tabindex="0" role="img" aria-label="Cape Peninsula satellite image. Select a reference by clicking, or move the pixel cursor with arrow keys and press Enter."></canvas>
        <figcaption class="coastal-caption">Satellite context · Cape Peninsula<br><span data-output="coordinate">Loading native pixel coordinates…</span><br><small>Imagery: Esri, Maxar, Earthstar Geographics, GIS User Community</small></figcaption>
      </figure>
      <figure class="coastal-view">
        <canvas class="coastal-canvas" data-canvas="similarity" width="768" height="768" tabindex="0" role="img" aria-label="Full 128-dimensional Tessera cosine similarity. Click to select a reference, or use arrow keys and Enter."></canvas>
        <figcaption class="coastal-caption"><span data-output="field-title">Annual representation similarity</span><br>2024 · Tessera v1.1 · 128 components</figcaption>
      </figure>
    </div>
    <div class="coastal-controls">
      <label>Pixel column <input data-control="column" type="number" min="0" max="255" step="1" value="122" /></label>
      <label>Pixel row <input data-control="row" type="number" min="0" max="255" step="1" value="142" /></label>
      <button type="button" data-action="select">Use this pixel</button>
      <label>Cosine to A ≥ <output data-output="threshold">0.80</output><input data-control="threshold" type="range" min="0.5" max="1" step="0.005" value="0.8" /></label>
      <label><input data-control="filter" type="checkbox" /> Mask scores below threshold</label>
      <label>Image underlay <input data-control="underlay" type="range" min="0" max="0.8" step="0.05" value="0" /></label>
    </div>
    <div class="coastal-scale"><canvas class="coastal-legend" width="600" height="18" aria-hidden="true"></canvas><p data-output="legend">Cosine similarity: 0.50 → 1.00. Values below 0.50 use the darkest color.</p></div>
    <p class="coastal-status" role="status" aria-live="polite">Loading published Tessera vectors…</p>
    <div class="coastal-metrics"><div><small>Samples ≥ threshold</small><strong data-output="fraction">…</strong></div><div><small>Mean similarity to A</small><strong data-output="mean">…</strong></div><div><small>Valid sampled pixels</small><strong data-output="valid">…</strong></div></div>
    <canvas class="coastal-histogram" width="640" height="88" role="img" aria-label="Histogram of cosine similarity to reference A over all valid sampled pixels."></canvas>
    <p class="coastal-caption" data-output="histogram-note"></p>
    <div class="coastal-matches-header"><h4>Spatially separated matches to A</h4><p>Exclude the first 400 m around A. Keep candidates at least 300 m apart.</p></div>
    <ol class="coastal-matches"></ol>
    <details class="coastal-methods"><summary>What the comparison measures</summary>
      <p>Each 2024 Tessera vector summarizes a year of Sentinel-1 radar and Sentinel-2 optical observations. Cosine compares the direction of two full 128-component vectors: their dot product divided by their lengths. A value of 1 means identical direction, 0 means orthogonal, and −1 means opposite direction.</p>
      <p>The 5.12 km window retains every second native 10 m pixel, giving 20 m sample spacing. No vectors are averaged. All valid samples enter the comparison; missing samples stay uncolored. The published signed-byte vectors are used directly because their positive per-pixel scales cancel in cosine. <span data-output="validation"></span></p>
      <p>A high score is an annual representation match. It is not a habitat label, current velocity, probability, or independent observation of coastal transport. Nearby pixels share geography and sensor conditions. The spatial exclusion separates examples, but does not remove spatial dependence.</p>
      <p>Comparison B produces cos(x,A) − cos(x,B). Positive values favor A; negative values favor B. Equal scores are neutral. These scores describe this model version, year, and window only.</p>
      <p><a href="https://geotessera.readthedocs.io/en/latest/">GeoTessera data and methods</a> · <a href="https://arxiv.org/abs/2506.20380">Tessera model paper</a> · <a href="${DATA}manifest.json">Download provenance</a>. Satellite context: Esri, Maxar, Earthstar Geographics, and the GIS User Community; mixed acquisition dates.</p>
    </details>`;

  const $ = q=>root.querySelector(q), $$=q=>[...root.querySelectorAll(q)];
  const out = (name,text)=>{ $(`[data-output="${name}"]`).textContent=text; };
  const imagery=$('[data-canvas="imagery"]'), field=$('[data-canvas="similarity"]');
  const contexts=[imagery.getContext('2d'),field.getContext('2d')];
  const raster=document.createElement('canvas'), rasterContext=raster.getContext('2d');
  const abort = new AbortController();
  let meta,coordinates,valid,worker,baseImage,scores,similarityA,similarityB,matches=[],anchorA=null,anchorB=null;
  let slot='A',cursor=[122,142], threshold=.8,mode='similarity',underlay=0,filter=false,loaded=false,disposed=false,queryId=0,promise;
  const colors = getComputedStyle(root);
  const ink=colors.getPropertyValue('--ocean-ink').trim() || 'white';
  const background=colors.getPropertyValue('--ocean-bg').trim() || 'black';
  const coordinateAt=i=>[coordinates[2*i],coordinates[2*i+1]];
  const status=s=>{$('.coastal-status').textContent=s;};
  const activeValues=()=>mode==='contrast'&&similarityB?scores:similarityA;

  function paintLegend() {
    const canvas=$('.coastal-legend'),ctx=canvas.getContext('2d'),stops=mode==='contrast'&&similarityB?CONTRAST:CIVIDIS;
    for(let x=0;x<canvas.width;x++){ctx.fillStyle=`rgb(${ramp(stops,x/(canvas.width-1)).join(',')})`;ctx.fillRect(x,0,1,canvas.height);}
    out('legend',mode==='contrast'&&similarityB?'Cosine difference: −0.25 (B) · 0 (equal) · +0.25 (A). Values beyond this range are clipped.':'Cosine similarity: 0.50 → 1.00. Values below 0.50 use the darkest color.');
  }
  function marker(ctx,index,label,selected=false) {
    if(index==null||!meta)return;
    const x=((index%meta.width)+.25)/meta.width*768,y=(Math.floor(index/meta.width)+.25)/meta.height*768;
    ctx.save();ctx.strokeStyle=background;ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();
    ctx.font=(label==='A'||label==='B')?'bold 18px monospace':'14px monospace';ctx.lineWidth=4;ctx.strokeText(label,x+14,y-10);ctx.fillStyle=ink;ctx.fillText(label,x+14,y-10);
    if(selected){ctx.beginPath();ctx.moveTo(x-18,y);ctx.lineTo(x+18,y);ctx.moveTo(x,y-18);ctx.lineTo(x,y+18);ctx.stroke();}
    ctx.restore();
  }
  function paint() {
    if(!loaded||!baseImage)return;
    for(const ctx of contexts){ctx.clearRect(0,0,768,768);ctx.drawImage(baseImage,0,0,768,768);}
    const values=activeValues();
    if(values){
      const img=rasterContext.createImageData(meta.width,meta.height);
      for(let i=0;i<values.length;i++){
        if(!Number.isFinite(values[i]) || (filter && similarityA[i]<threshold))continue;
        const color=mode==='contrast'&&similarityB?ramp(CONTRAST,(values[i]+.25)/.5):ramp(CIVIDIS,(values[i]-.5)/.5);
        img.data.set([...color,Math.round(255*(1-underlay))],4*i);
      }
      rasterContext.putImageData(img,0,0);contexts[1].imageSmoothingEnabled=false;contexts[1].drawImage(raster,0,0,768,768);
    }
    for(const ctx of contexts){matches.forEach((i,k)=>marker(ctx,i,String(k+1)));marker(ctx,anchorA,'A',slot==='A');marker(ctx,anchorB,'B',slot==='B');}
    if(cursor){const i=cursor[1]*meta.width+cursor[0];for(const ctx of contexts){ctx.save();ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.setLineDash([3,3]);const x=(cursor[0]+.25)*768/meta.width,y=(cursor[1]+.25)*768/meta.height;ctx.strokeRect(x-7,y-7,14,14);ctx.restore();}}
    paintLegend();
  }
  function paintHistogram() {
    if(!similarityA)return;
    const canvas=$('.coastal-histogram'),ctx=canvas.getContext('2d'),bins=new Uint32Array(50);
    let clipped=0;
    for(const v of similarityA){if(!Number.isFinite(v))continue;if(v<.5){clipped++;continue;}bins[Math.min(49,Math.floor((v-.5)*100))]++;}
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const max=Math.max(...bins,1),chartH=60;
    for(let i=0;i<50;i++){ctx.fillStyle=`rgb(${ramp(CIVIDIS,i/49).join(',')})`;const bh=bins[i]/max*chartH;ctx.fillRect(i*canvas.width/50,chartH-bh,canvas.width/50-1,bh);}
    const tx=(threshold-.5)/.5*canvas.width;ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(tx,0);ctx.lineTo(tx,chartH);ctx.stroke();
    ctx.fillStyle=ink;ctx.font='12px monospace';ctx.textAlign='left';ctx.fillText('0.50',0,80);ctx.textAlign='right';ctx.fillText('1.00',canvas.width,80);
    out('histogram-note',`${clipped.toLocaleString()} valid samples below 0.50 are omitted from these bars. The line marks the selected threshold.`);
    canvas.setAttribute('aria-label',`Cosine similarity histogram. ${clipped.toLocaleString()} valid samples below 0.50 are omitted from the bars. The vertical line marks threshold ${threshold.toFixed(3)}.`);
  }
  function updateSummary() {
    if(!similarityA)return;
    const summary=fieldSummary(similarityA,threshold);
    out('fraction',`${(100*summary.fraction).toFixed(summary.fraction<.01?2:1)}%`);out('mean',summary.mean.toFixed(3));out('valid',summary.count.toLocaleString());
    out('threshold',threshold.toFixed(3));paintHistogram();
  }
  function showMatches() {
    const list=$('.coastal-matches');list.replaceChildren();
    matches.forEach((i,k)=>{
      const li=document.createElement('li'),b=document.createElement('button');b.type='button';
      const [lon,lat]=coordinateAt(i);b.textContent=`${formatCoordinate(lon,lat)} · cosine ${similarityA[i].toFixed(3)}`;
      b.addEventListener('click',()=>{cursor=[i%meta.width,Math.floor(i/meta.width)];updateCursor();paint();onLocation({lon,lat,source:'Tessera 2024',score:similarityA[i],height:900});},{signal:abort.signal});li.append(b);list.append(li);
    });
  }
  function query() {
    if(!loaded||anchorA==null)return;
    status('Comparing all 128 components across the valid sampled pixels…');
    worker.postMessage({type:'query',id:++queryId,anchorA,anchorB:mode==='contrast'?anchorB:null,threshold});
  }
  function updateCursor(){
    $('[data-control="column"]').value=String(cursor[0]);$('[data-control="row"]').value=String(cursor[1]);
    const i=cursor[1]*meta.width+cursor[0];out('coordinate',`${formatCoordinate(...coordinateAt(i))} · pixel ${cursor[0]}, ${cursor[1]}${valid[i]?'':' · no valid vector'}`);
  }
  function select(column,row,reference=slot) {
    if(!loaded)return false;
    const c=clamp(Math.round(Number(column)),0,meta.width-1),r=clamp(Math.round(Number(row)),0,meta.height-1);
    if(!Number.isFinite(c)||!Number.isFinite(r))return false;
    cursor=[c,r];updateCursor();const index=r*meta.width+c;
    if(!valid[index]){status('This sampled pixel has no valid Tessera vector. Choose another location.');paint();return false;}
    if(reference==='B'){anchorB=index;mode='contrast';$('[data-control="mode"]').value=mode;}else anchorA=index;
    onLocation({lon:coordinates[2*index],lat:coordinates[2*index+1],source:'Tessera 2024',reference,height:900});query();paint();return true;
  }
  function download() {
    if(!similarityA)return;
    const rows=['# Tessera v1.1 dClimate; year=2024; 128 original components; 10m native pixel; 20m retained sample spacing',`# reference_A=${coordinateAt(anchorA).join(',')}`,`# reference_B=${!similarityB?'none':coordinateAt(anchorB).join(',')}`,'longitude,latitude,cosine_to_A,cosine_to_B,cosine_A_minus_B'];
    for(let i=0;i<valid.length;i++)if(valid[i])rows.push(`${coordinates[2*i].toFixed(6)},${coordinates[2*i+1].toFixed(6)},${similarityA[i].toFixed(6)},${similarityB?similarityB[i].toFixed(6):''},${similarityB?(similarityA[i]-similarityB[i]).toFixed(6):''}`);
    const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='tessera-cape-2024-cosine.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function load() {
    if(promise)return promise;
    promise=(async()=>{
      const fetchJSON=async path=>{const r=await fetch(DATA+path,{signal:abort.signal});if(!r.ok)throw new Error(`Tessera file unavailable (${r.status}).`);return r.json();};
      const fetchBytes=async path=>{const r=await fetch(DATA+path,{signal:abort.signal});if(!r.ok)throw new Error(`Tessera file unavailable (${r.status}).`);return r.arrayBuffer();};
      meta=await fetchJSON('manifest.json');
      const [v,m,c]=await Promise.all([fetchBytes('vectors.i8'),fetchBytes('valid.u8'),fetchBytes('coordinates.f32')]);
      if(disposed)return;
      const vectors=new Int8Array(v);valid=new Uint8Array(m);coordinates=new Float32Array(c);
      if(vectors.length!==meta.width*meta.height*meta.dimensions||valid.length!==meta.width*meta.height||coordinates.length!==valid.length*2)throw new Error('Tessera payload dimensions disagree with provenance.');
      baseImage=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Coastal satellite image failed to load.'));im.src=DATA+'cape-imagery.jpg';});
      if(disposed)return;
      raster.width=meta.width;raster.height=meta.height;
      worker=new Worker(new URL('./coastal.worker.js',import.meta.url),{type:'module'});
      await new Promise((resolve,reject)=>{
        worker.onerror=e=>reject(new Error(e.message||'Coastal comparison worker failed.'));
        worker.onmessage=({data})=>{
          if(data.type==='ready'){resolve();return;}
          if(data.type==='error'){status(data.message);return;}
          if(data.type!=='result'||data.id!==queryId)return;
          ({scores,similarityA,similarityB,matches}=data);updateSummary();showMatches();paint();
          out('field-title',mode==='contrast'&&similarityB?'Representation contrast: A versus B':'Annual representation similarity to A');
          status(`${meta.validCount.toLocaleString()} valid samples compared. ${mode==='contrast'&&similarityB?'Warm colors favor A; blue colors favor B.':'Brighter colors indicate higher cosine similarity to A.'}`);
          $('[data-action="download"]').disabled=false;root.dataset.ready='true';
        };
        worker.postMessage({type:'init',vectors,valid:new Uint8Array(valid),dimensions:meta.dimensions,width:meta.width,spacing:meta.sampleSpacingMetres},[vectors.buffer]);
      });
      loaded=true;
      const err=meta.validation.maxAbsoluteCosineErrorVsFloat32Dequantized;
      out('validation',`Across ${meta.validation.pairs.toLocaleString()} sampled pairs, maximum disagreement with float32-dequantized cosine was ${err.toExponential(2)}.`);
      cursor=meta.initialPixel||[122,142];
      if(!valid[cursor[1]*meta.width+cursor[0]]){const i=valid.findIndex(x=>x);cursor=[i%meta.width,Math.floor(i/meta.width)];}
      select(...cursor,'A');
    })().catch(error=>{if(error.name!=='AbortError')status(`Coastal data could not load: ${error.message}`);throw error;});
    return promise;
  }
  function listen(node,type,fn){node.addEventListener(type,fn,{signal:abort.signal});}
  for(const canvas of [imagery,field]){
    listen(canvas,'click',e=>{if(!loaded)return;const b=canvas.getBoundingClientRect();select(Math.floor((e.clientX-b.left)/b.width*meta.width),Math.floor((e.clientY-b.top)/b.height*meta.height));});
    listen(canvas,'keydown',e=>{if(!loaded)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();const step=e.shiftKey?10:1;cursor=[clamp(cursor[0]+delta[0]*step,0,meta.width-1),clamp(cursor[1]+delta[1]*step,0,meta.height-1)];updateCursor();paint();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();select(...cursor);}});
  }
  for(const button of $$('[data-reference]'))listen(button,'click',()=>{slot=button.dataset.reference;for(const b of $$('[data-reference]'))b.setAttribute('aria-pressed',String(b===button));status(`Select a valid pixel for reference ${slot}.`);paint();});
  listen($('[data-action="select"]'),'click',()=>select($('[data-control="column"]').value,$('[data-control="row"]').value));
  listen($('[data-control="mode"]'),'change',e=>{mode=e.target.value;if(mode==='contrast'&&anchorB==null){slot='B';for(const b of $$('[data-reference]'))b.setAttribute('aria-pressed',String(b.dataset.reference==='B'));status('Choose comparison B on either map to calculate the cosine difference.');paint();}else query();});
  listen($('[data-control="threshold"]'),'input',e=>{threshold=Number(e.target.value);out('threshold',threshold.toFixed(3));updateSummary();if(filter)paint();});
  listen($('[data-control="filter"]'),'change',e=>{filter=e.target.checked;paint();});
  listen($('[data-control="underlay"]'),'input',e=>{underlay=Number(e.target.value);paint();});
  listen($('[data-action="download"]'),'click',download);
  paintLegend();
  return {load,start:load,select,dispose(){disposed=true;abort.abort();worker?.terminate();}};
}
