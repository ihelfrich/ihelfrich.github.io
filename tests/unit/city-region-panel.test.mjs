import {test} from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
import {createPropertyRegionPanel} from '../../src/scripts/city/city-property-region-panel.mjs';
const settle=()=>new Promise(r=>setTimeout(r,5));
const result=(n=1)=>({count:n,knownCount:n,level:'areas',features:Array.from({length:n},(_,i)=>({id:String(i),kind:'cell',count:1,knownCount:1,value:1,label:'Area '+i,bounds:[-90.4,38.6,-90.3,38.7]})),domain:[0,2],sources:[],unavailable:[],failedTiles:0,partial:false});
function fixture(t,query){const win=new Window(),doc=win.document;doc.body.innerHTML='<main id="city-app"><section id="fixture"></section></main>';const root=doc.querySelector('#fixture'),renders=[],fits=[];const city={setPropertyAtlas:value=>renders.push(value),clearPropertyAtlas:()=>renders.push(null),fitPropertyAtlasBounds:b=>fits.push(b),getViewportBounds:()=>[-90.4,38.6,-90.3,38.7]};const panel=createPropertyRegionPanel(root,{getCity:()=>city,data:{query}});t.after(()=>{panel.dispose();win.happyDOM.abort();});return{panel,doc,root,renders,fits,$:n=>root.querySelector(`[data-atlas="${n}"]`)};}
test('a failed refresh clears paginated results and cannot crash when Show more was previously present',async t=>{
 let fail=false;const f=fixture(t,async()=>{if(fail)throw Error('Fixture outage');return result(45);});f.panel.activate();await settle();assert.equal(f.$('more').hidden,false);fail=true;f.$('search-map').click();await settle();assert.equal(f.$('more').hidden,true);assert.equal(f.$('list').children.length,0);assert.equal(f.$('export').disabled,true);assert.match(f.$('status').textContent,/Fixture outage/);f.$('more').click();assert.equal(f.$('list').children.length,0);
});
test('stale regional requests cannot replace the newer selected jurisdiction',async t=>{
 let resolveOld;const old=new Promise(r=>resolveOld=r);let calls=0;const f=fixture(t,async()=>++calls===1?old:result(2));f.panel.activate();f.root.querySelector('[data-region="st-louis-city"]').click();await settle();assert.equal(f.$('count').textContent,'2 source records');resolveOld(result(99));await settle();assert.equal(f.$('count').textContent,'2 source records');assert.equal(f.renders.at(-1).features.length,2);
});
test('leaving Properties hides the atlas and a late response cannot repaint it',async t=>{
 let resolve;const f=fixture(t,()=>new Promise(r=>resolve=r));f.panel.activate();f.panel.activate(false);resolve(result());await settle();assert.equal(f.renders.at(-1),null);assert.equal(f.doc.querySelector('.atlas-map-key').hidden,true);
});
