import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createSitePanel} from '../../src/scripts/city/city-site-panel.mjs';
const parcel={type:'Feature',properties:{recordKey:'synthetic:1',parcelId:'test-1',address:'Synthetic test parcel',areaSqFt:1800},geometry:{type:'Polygon',coordinates:[[[-90.212,38.616],[-90.2116,38.616],[-90.2116,38.6164],[-90.212,38.6164],[-90.212,38.616]]]}};
const evidence={point:{longitude:-90.2118,latitude:38.6162},parcels:{parcel,source:{catalogUrl:'https://www.stlouis-mo.gov/data/'}}};
const settle=()=>new Promise(resolve=>setTimeout(resolve,8));
function fixture(t,load) {
 const window=new Window(),root=window.document.createElement('section');window.document.body.append(root);
 const panel=createSitePanel(root,{getEvidence:()=>evidence,load}),$=id=>root.querySelector('#site-'+id);
 t.after(()=>{panel.dispose();window.happyDOM.abort()});return {root,panel,$};
}
test('site sources run on request and preserve point scope, datum, acquisition date and missing flood elevation',async t=>{
 let calls=0;
 const f=fixture(t,async({points})=>{calls++;return {terrain:{status:'ready',units:'m',fetchedAt:'2026-09-09T00:00:00Z',samples:points.map(p=>({...p,elevationMetres:150})),sources:[{project:'Synthetic DEM',id:'test',verticalDatum:'NAVD 88',resolutionMetres:1,acquisitionDate:'2017-02-27'}],availableCount:points.length,requestedCount:points.length},flood:{status:'ready',effectiveDate:null,zones:[{zone:'X',subtype:'Synthetic test zone',specialFloodHazardArea:false,baseFloodElevation:null}]}}});
 assert.equal(calls,0);assert.equal(f.$('load').disabled,false);assert.match(f.$('geometry').textContent,/not frontage/);
 f.$('load').click();await settle();assert.equal(calls,1);assert.match(f.$('terrain').textContent,/NAVD 88/);assert.match(f.$('terrain').textContent,/2017-02-27/);assert.match(f.$('terrain').textContent,/0%/);
 assert.match(f.$('flood').textContent,/Selected point only/);assert.match(f.$('flood').textContent,/Base flood elevation: Not supplied/);assert.match(f.$('flood').textContent,/Effective map\/revision date: Unknown/);
});
test('a new parcel aborts old source work and cannot inherit the previous environmental results',async t=>{
 let resolve,signal;
 const f=fixture(t,(_,options)=>{signal=options.signal;return new Promise(r=>resolve=r)});
 f.$('load').click();f.panel.setEvidence({...evidence,parcels:{parcel:{...parcel,properties:{...parcel.properties,recordKey:'synthetic:2',address:'Second test parcel'}}}});
 assert.equal(signal.aborted,true);resolve({terrain:{status:'unavailable',reason:'Old failure'},flood:{status:'unavailable'}});await settle();
 assert.equal(f.$('terrain').textContent,'');assert.equal(f.$('flood').textContent,'');assert.match(f.$('selection').textContent,/Second test parcel/);assert.equal(f.$('export').disabled,false);
});
test('source failure remains independent and differing vertical datums withhold the grade',async t=>{
 const f=fixture(t,async({points})=>({terrain:{status:'partial',units:'m',samples:points.map(p=>({...p,elevationMetres:150})),sources:[{id:'a',verticalDatum:'NAVD 88'},{id:'b',verticalDatum:'ELLIPSOID'}],availableCount:points.length,requestedCount:points.length},flood:{status:'unavailable',reason:'FEMA unavailable in this test.'}}));
 f.$('load').click();await settle();assert.match(f.$('terrain').textContent,/Grade withheld/);assert.match(f.$('flood').textContent,/FEMA unavailable/);assert.doesNotMatch(f.$('terrain').textContent,/NaN|Infinity/);
 f.panel.setEvidence(null);assert.equal(f.$('load').disabled,true);assert.equal(f.$('export').disabled,true);assert.equal(f.$('geometry').textContent,'');
});
test('an inadequate interior grid withholds terrain sampling while preserving FEMA point lookup',async t=>{
 let request;
 const f=fixture(t,async input=>{request=input;return {terrain:{status:'unavailable'},flood:{status:'ready',zones:[{zone:'X'}]}}});
 const ring=[[-90.212,38.616],[-90.211,38.617],[-90.211,38.6170001],[-90.212,38.6160001],[-90.212,38.616]];
 f.panel.setEvidence({...evidence,parcels:{parcel:{...parcel,geometry:{type:'Polygon',coordinates:[ring]}}}});
 assert.match(f.$('status').textContent,/Terrain sampling withheld/);
 f.$('load').click();await settle();
 assert.deepEqual(request.points,[]);assert.deepEqual(request.selectedPoint,evidence.point);
 assert.match(f.$('terrain').textContent,/Fewer than six|narrow|collinear/);
 assert.match(f.$('flood').textContent,/Zone X/);
});
