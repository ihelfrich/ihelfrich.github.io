import {validateIfcFile} from '../../lib/city-ifc.mjs';
import {createIfcClient} from '../../lib/city-ifc-client.mjs';
if(typeof window!=='undefined')void import('./city-ifc-panel.css');

export function createCityIfcPanel({document:doc=globalThis.document,target='#property-panel-model',client=createIfcClient(),loadViewer=()=>import('./city-ifc-viewer.mjs'),fetchImpl=globalThis.fetch}={}){
 const root=typeof target==='string'?doc.querySelector(target):target;if(!root)throw Error('Model panel target is missing.');
 const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;},$=name=>root.querySelector(`[data-ifc="${name}"]`);
 let active=false,disposed=false,loading=false,generation=0,selectionSerial=0,model=null,viewer=null,viewerPromise=null,controller=null,selectedId=null;let enabled=new Set();
 root.innerHTML=`<section class="ifc-panel"><div class="ifc-heading"><span class="eyebrow">LOCAL MODEL / OPENBIM</span><h3>Look inside a building model.</h3><p>Open your IFC file to explore its geometry and element records. Your file stays in this browser session.</p></div>
 <div class="ifc-toolbar"><label class="ifc-file-button">Open IFC file<input data-ifc="file" type="file" accept=".ifc" aria-label="Open local IFC file, up to 25 megabytes"></label><button data-ifc="example" type="button">Try example model</button><button data-ifc="close" type="button" disabled>Close model</button></div>
 <p data-ifc="example-label" class="ifc-example-label" hidden>Example model — not a St. Louis building. This pavilion and its records are invented.</p>
 <p data-ifc="source" class="small-note">Uncompressed IFC · up to 25 MB · no upload or automatic parcel placement</p>
 <p data-ifc="status" class="ifc-status" role="status">Choose a file, or try the example to explore walls, columns and a roof.</p>
 <div class="ifc-stage-wrap"><div data-ifc="stage" class="ifc-stage"><div class="ifc-stage-empty"><span>IFC</span><p>A model has more to tell than its outline.</p></div></div><p data-ifc="stage-label" class="ifc-stage-label" hidden></p></div>
 <div class="ifc-toolbar ifc-camera-tools" aria-label="Model camera controls"><button data-ifc="fit" type="button" disabled>Fit model</button><button data-ifc="left" type="button" disabled aria-label="Rotate model left">↶</button><button data-ifc="right" type="button" disabled aria-label="Rotate model right">↷</button><button data-ifc="in" type="button" disabled aria-label="Zoom model in">＋</button><button data-ifc="out" type="button" disabled aria-label="Zoom model out">−</button><button data-ifc="all" type="button" disabled>Show all</button></div>
 <p class="small-note">Drag to orbit · scroll or pinch to zoom · select a visible element. Colors aid inspection. Model coordinates are not a verified map location.</p>
 <div data-ifc="workspace" class="ifc-layout" hidden><div><h4>Element categories</h4><div data-ifc="categories" class="ifc-categories"></div><label class="ifc-search-label">Find an element<input data-ifc="search" type="search" placeholder="Name, type or element ID"></label><p data-ifc="count" class="small-note"></p><div data-ifc="elements" class="ifc-element-list"></div></div><section class="ifc-inspector" aria-label="Selected IFC element"><h4>Element record</h4><div data-ifc="properties"><p>Select an element on the model or in the list.</p></div></section></div>
 <details class="ifc-about"><summary>Model limits & open-source software</summary><p>This inspector shows supported geometry and a bounded selection of element attributes and property sets. It does not validate code compliance, measured quantities, structural performance or as-built accuracy. IFC2x3 and IFC4-family support depends on the parser and the model’s geometry.</p><p>No nationwide interior, MEP or underground utility BIM dataset is connected. The example is original invented geometry. Local model data is discarded when you close the model or leave this page.</p><p>Powered by unmodified web-ifc 0.0.77 (MPL-2.0) and Three.js. <a href="/vendor/web-ifc/LICENSE.md" target="_blank" rel="noopener">Parser license</a> · <a href="/vendor/web-ifc/SOURCE.txt" target="_blank" rel="noopener">Corresponding source & version</a> · <a href="/st-louis/models/example-pavilion.ifc" download>Download invented example IFC</a></p></details></section>`;
 function status(message){$('status').textContent=message;}
 function controls(hasModel){for(const name of ['fit','left','right','in','out','all'])$(name).disabled=!hasModel;$('close').disabled=!hasModel&&!loading;}
 function clearModel(){selectionSerial++;selectedId=null;model=null;enabled.clear();viewer?.clear();$('workspace').hidden=true;$('categories').replaceChildren();$('elements').replaceChildren();$('properties').replaceChildren(el('p','Select an element on the model or in the list.'));$('example-label').hidden=true;$('stage-label').hidden=true;$('stage-label').textContent='';controls(false);}
 function close(){generation++;controller?.abort();controller=null;loading=false;client.cancel();clearModel();status('Model closed. Local geometry and element records were discarded.');$('source').textContent='Uncompressed IFC · up to 25 MB · no upload or automatic parcel placement';}
 async function ensureViewer(){
  if(viewer)return viewer;if(!active||disposed)return null;
  if(!viewerPromise)viewerPromise=loadViewer();
  const module=await viewerPromise;if(!active||disposed)return null;
  if(!viewer)viewer=module.createIfcViewer($('stage'),{onSelect:select,onError:error=>status(error.message)});
  viewer.setActive(active);return viewer;
 }
 async function display({reveal=false}={}){if(!model||!active||disposed)return;const own=generation,data=model;
  try{const canvas=await ensureViewer();if(!canvas||!active||disposed||own!==generation)return;canvas.load(data);canvas.visibility(enabled);if(selectedId!=null)canvas.select(selectedId);
   if(reveal&&active&&!doc.hidden&&root.isConnected&&!root.closest('[hidden]'))$('stage').scrollIntoView?.({block:'start',behavior:doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  catch(error){if(own===generation&&!disposed)status(`Geometry could not be displayed: ${error.message} Element records remain available.`);}
 }
 async function loadSource(getFile,example){
  if(disposed)return;const own=++generation;controller?.abort();controller=new AbortController();client.cancel();loading=true;clearModel();controls(false);$('close').disabled=false;status(example?'Opening the invented example…':'Reading the local IFC file…');
  try{const file=await getFile(controller.signal);if(own!==generation||disposed)return;validateIfcFile(file);const bytes=await file.arrayBuffer();if(own!==generation||disposed)return;
   const data=await client.load(bytes,progress=>{if(own===generation)status(`Reading local geometry · ${progress.current.toLocaleString()} of ${progress.total.toLocaleString()} elements`);});
   if(disposed||own!==generation)return;model=data;enabled=new Set(data.elements.map(e=>e.type));$('search').value='';$('example-label').hidden=!example;$('source').textContent=`${file.name} · ${data.schema} · ${data.elements.length.toLocaleString()} drawable elements · ${data.triangles.toLocaleString()} triangles · local coordinates`;
   $('stage-label').textContent=example?'Example model — not a St. Louis building':`Local model · ${file.name}`;$('stage-label').hidden=false;
   $('workspace').hidden=false;renderCategories();renderElements();controls(true);status('Model ready. Select an element or isolate a category to explore it.');await display({reveal:true});
  }catch(error){if(own===generation&&!disposed&&error.name!=='AbortError')status(error.message||'The local model could not be opened.');}
  finally{if(own===generation&&!disposed){loading=false;controls(Boolean(model));}}
 }
 function loadFile(file){try{validateIfcFile(file);}catch(error){status(error.message);return Promise.resolve();}return loadSource(async()=>file,false);}
 function loadExample(){return loadSource(async signal=>{const response=await fetchImpl('/st-louis/models/example-pavilion.ifc',{signal,credentials:'omit'});if(!response.ok)throw Error('The example IFC could not be downloaded. Try a local model instead.');const blob=await response.blob();return {name:'example-pavilion.ifc',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()};},true);}
 function applyVisibility(){viewer?.visibility(enabled);for(const input of $('categories').querySelectorAll('input'))input.checked=enabled.has(input.dataset.ifcCategory);renderElements();}
 function renderCategories(){const counts=new Map();for(const e of model?.elements||[])counts.set(e.type,(counts.get(e.type)||0)+1);$('categories').replaceChildren();
  for(const[type,count]of [...counts].sort((a,b)=>a[0].localeCompare(b[0]))){const row=el('div',null,'ifc-category'),label=el('label'),input=el('input'),isolate=el('button','Only');input.type='checkbox';input.dataset.ifcCategory=type;input.checked=enabled.has(type);input.addEventListener('change',()=>{input.checked?enabled.add(type):enabled.delete(type);applyVisibility();});label.append(input,doc.createTextNode(`${type.replace(/^Ifc/,'')} · ${count}`));isolate.type='button';isolate.dataset.ifcIsolate=type;isolate.setAttribute('aria-label',`Show only ${type} elements`);isolate.addEventListener('click',()=>{enabled=new Set([type]);applyVisibility();viewer?.fit();});row.append(label,isolate);$('categories').append(row);}
 }
 function renderElements(){const query=$('search').value.trim().toLowerCase(),matches=(model?.elements||[]).filter(e=>enabled.has(e.type)&&(!query||`${e.name} ${e.type} ${e.id} ${e.globalId||''}`.toLowerCase().includes(query)));$('elements').replaceChildren();$('count').textContent=`${matches.length.toLocaleString()} matching elements${matches.length>100?' · showing the first 100; refine your search':''}`;
  for(const e of matches.slice(0,100)){const button=el('button',null,'ifc-element');button.type='button';button.dataset.ifcElement=String(e.id);button.setAttribute('aria-pressed',String(e.id===selectedId));button.append(el('strong',e.name),el('span',`${e.type} · #${e.id}`));button.addEventListener('click',()=>select(e.id));$('elements').append(button);}
 }
 async function select(id){if(!model)return;const element=model.elements.find(e=>e.id===id);if(!element)return;selectedId=id;const own=generation,request=++selectionSerial;viewer?.select(id);for(const button of $('elements').querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.ifcElement)===id));
  const body=$('properties');body.replaceChildren(el('h5',element.name),el('p',`${element.type} · STEP #${id}`),el('p',`GlobalId: ${element.globalId||'Not supplied'}`,'ifc-global-id'),el('p','Reading property sets…','small-note'));
  try{const detail=await client.properties(id);if(disposed||own!==generation||request!==selectionSerial)return;body.lastElementChild.remove();const list=el('dl',null,'ifc-property-list');for(const p of detail.properties){const row=el('div');row.append(el('dt',`${p.group} / ${p.name}`),el('dd',p.value));list.append(row);}body.append(list,el('p',`${detail.limited?'Property display limit reached. ':''}Values are as stored in this IFC. Units and engineering validity have not been independently verified.`,'small-note'));}
  catch(error){if(own===generation&&request===selectionSerial&&!disposed)body.lastElementChild.textContent=`Property sets unavailable: ${error.message}`;}
 }
 function fileChange(){const file=$('file').files?.[0];if(file)void loadFile(file);$('file').value='';}
 $('file').addEventListener('change',fileChange);$('example').addEventListener('click',loadExample);$('close').addEventListener('click',close);$('search').addEventListener('input',renderElements);
 $('fit').addEventListener('click',()=>viewer?.fit());$('left').addEventListener('click',()=>viewer?.rotate(-Math.PI/8));$('right').addEventListener('click',()=>viewer?.rotate(Math.PI/8));$('in').addEventListener('click',()=>viewer?.zoom(.8));$('out').addEventListener('click',()=>viewer?.zoom(1.25));$('all').addEventListener('click',()=>{enabled=new Set(model?.elements.map(e=>e.type)||[]);applyVisibility();viewer?.fit();});
 return {loadFile,setActive(value){if(disposed)return;const wasActive=active;active=Boolean(value);viewer?.setActive(active);if(!active&&loading){close();status('Loading stopped when leaving the model tool. Choose the file again to continue.');}else if(active&&!wasActive&&model&&!viewer)void display();},destroy(){if(disposed)return;close();disposed=true;client.destroy();viewer?.destroy();viewer=null;root.replaceChildren();}};
}
