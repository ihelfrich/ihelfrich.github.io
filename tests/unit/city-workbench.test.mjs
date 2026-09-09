import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createWorkbench} from '../../src/scripts/city/city-workbench.mjs';

function fixture(t) {
 const window=new Window(),doc=window.document;
 doc.body.innerHTML=`<header class="city-header"></header><form id="city-search-form" class="workspace-command"><select id="city-search-domain"><option>address</option><option>place</option></select><input id="city-search-query"></form><section id="explorer"></section><nav class="mode-bar"></nav><aside id="conditions-card"><button id="weather-toggle"></button><div id="weather-expanded" hidden></div></aside><div id="lighting-dock"><div id="sun-study-controls"></div><div id="photo-tone-controls"></div><span id="light-mode-label"></span><button id="light-now"></button></div><button id="focus-view"><span>Focus</span></button><button id="sheet-size"></button><input id="place-search"><button data-tone="natural"></button><button data-tone="warm"></button><select id="dock-tone"><option>natural</option><option>warm</option></select><input id="tone-exposure"><output id="tone-exposure-label"></output><p id="tone-basis"></p><input type="checkbox" id="toggle-parcel" checked><div id="provider-credits">Provider attribution</div>`;
 const modes=[],queries=[],tones=[],visibility=[];let city={engine:'three',setTone:v=>tones.push(v),setParcelVisible:v=>visibility.push(v)};
 const workbench=createWorkbench(doc,{getCity:()=>city,setMode:m=>modes.push(m),property:{searchAddress:q=>queries.push(q)}});
 t.after(()=>{workbench.dispose();window.happyDOM.abort()});
 return {window,doc,workbench,modes,queries,tones,visibility,switchEngine(){city={...city,engine:'cesium'}}};
}
test('focus preserves attribution and keyboard typing, with a reachable restore control',t=>{
 const f=fixture(t),input=f.doc.getElementById('city-search-query');
 input.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'f',bubbles:true}));assert.equal(f.doc.body.classList.contains('focus-mode'),false);
 f.doc.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'f',bubbles:true}));
 assert.equal(f.doc.getElementById('explorer').inert,true);assert.equal(f.doc.getElementById('provider-credits').inert,false);
 assert.equal(f.doc.activeElement.id,'focus-view');
 f.doc.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));
 assert.equal(f.doc.getElementById('explorer').inert,false);assert.equal(f.doc.activeElement,input);
 input.value='1306 Dolman';f.doc.getElementById('city-search-form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));
 assert.deepEqual(f.queries,['1306 Dolman']);assert.deepEqual(f.modes,['properties']);
});
test('display treatment and parcel visibility survive engine switches; photo controls stay available',t=>{
 const f=fixture(t);f.doc.querySelector('[data-tone=warm]').click();
 const exposure=f.doc.getElementById('tone-exposure');exposure.value='0.4';exposure.dispatchEvent(new f.window.Event('input'));
 const parcel=f.doc.getElementById('toggle-parcel');parcel.checked=false;parcel.dispatchEvent(new f.window.Event('change'));
 f.switchEngine();f.workbench.refreshRenderer();
 assert.deepEqual(f.tones.at(-1),{preset:'warm',exposure:0.4});assert.equal(f.visibility.at(-1),false);
 assert.equal(f.doc.getElementById('sun-study-controls').hidden,true);assert.equal(f.doc.getElementById('photo-tone-controls').hidden,false);
 assert.equal(f.doc.getElementById('provider-credits').style.filter,'');
});
