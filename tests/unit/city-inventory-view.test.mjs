import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryView,distanceMeters} from '../../src/lib/city-inventory-view.mjs';
const p={longitude:-90.2,latitude:38.6};
test('display budget never changes inventory counts or turns unknown prices into zero',()=>{
 const data=Array.from({length:300},(_,i)=>({...p,id:String(i),address:'Fixture '+i,askingPrice:null}));
 const r=inventoryView(data,{point:p,markerLimit:250});assert.equal(r.matchingCount,300);assert.equal(r.markers.length,250);assert.equal(r.hiddenMarkerCount,50);assert.equal(r.unknownPriceCount,300);assert.equal(r.knownAskingVolumeUSD,null);
});
test('query and geodesic radius jointly constrain records; distant records stay outside',()=>{
 const data=[{...p,id:'a',address:'Fixture A',askingPrice:null},{longitude:-90.8,latitude:38.6,id:'b',address:'Fixture B',askingPrice:100}];
 assert.equal(inventoryView(data,{point:p,query:'fixture',radiusMeters:2000}).matchingCount,1);
 const r=inventoryView(data,{point:p,query:'fixture b',radiusMeters:0});assert.equal(r.matchingCount,1);assert.equal(r.knownAskingVolumeUSD,100);assert.ok(distanceMeters(p,data[1])>50000);
});
