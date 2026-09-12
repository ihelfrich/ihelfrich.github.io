import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPropertyRegionData,atlasRows,atlasCell,propertyAtlasCsv} from '../../src/lib/property-region-data.mjs';
const fields=['recordKey','parcelKey','sourceObjectId','longitude','latitude','assessedValueUSD','assessorAppraisedValueUSD','latestSaleDateISO','latestSalePriceUSD'];
const tile={id:'a',url:'/a.json',bounds:[-90.4,38.6,-90.3,38.7],count:2,metrics:{assessedValueUSD:{sum:200,count:2},latestSalePriceUSD:{sum:0,count:1}},latestSaleYears:{2025:{count:1,priceSum:0,priceCount:1}},unknownSaleDateCount:1};
const manifest={schema:'property-region-v1',jurisdiction:'st-louis-county',source:{id:'county'},fields,tiles:[tile]};
const rows=[['st-louis-county-current:A:1','st-louis-county:A',1,-90.35,38.65,100,null,'2025-01-01',0],['st-louis-county-current:objectid:2',null,2,-90.36,38.66,100,null,null,null]];
const region={id:'st-louis-county',name:'County',manifestUrl:'/manifest.json'};
const payload={schema:'property-region-tile-v1',jurisdiction:'st-louis-county',id:'a',sourceId:'county',fields,rows};
const query={bounds:[-90.38,38.62,-90.32,38.68]};
test('regional overview requests manifests only and retains real zero vs missing amounts',async()=>{
 const calls=[],data=createPropertyRegionData({regions:[region],maxPoints:1,fetchImpl:async url=>{calls.push(url);return{ok:true,json:async()=>manifest};}});
 const view=await data.query({...query,metric:'latestSalePriceUSD',fromYear:2025,toYear:2025});
 assert.deepEqual(calls,['/manifest.json']);assert.equal(view.level,'areas');assert.equal(view.count,1);assert.equal(view.knownCount,1);assert.equal(view.features[0].value,0);
});
test('detail is bounded by viewport and accepts exact source records without fabricated parcel IDs',()=>{
 const found=atlasRows(rows,manifest,{...query,metric:'assessedValueUSD'});assert.equal(found.length,2);assert.equal(found[1].parcelKey,null);
 assert.equal(atlasRows(rows,manifest,{bounds:[-90.355,38.64,-90.345,38.655],metric:'assessedValueUSD'}).length,1);
 const sales=atlasRows(rows,manifest,{...query,metric:'latestSalePriceUSD',fromYear:2025,toYear:2025});assert.equal(sales.length,1);assert.equal(sales[0].value,0);
});
test('loader refuses misrouted source tiles and reports partial results instead of inferred zero coverage',async()=>{
 const d=createPropertyRegionData({regions:[region],fetchImpl:async url=>({ok:true,json:async()=>url===region.manifestUrl?manifest:{...payload,jurisdiction:'st-louis-city'}})});
 const view=await d.query(query);assert.equal(view.partial,true);assert.equal(view.failedTiles,1);assert.equal(view.features.length,0);
});
test('tile fields must match the declared order and loaded tiles are reused',async()=>{
 const calls=[],d=createPropertyRegionData({regions:[region],fetchImpl:async url=>{calls.push(url);return{ok:true,json:async()=>url===region.manifestUrl?manifest:payload};}});
 assert.equal((await d.query(query)).count,2);await d.query({...query,metric:'assessorAppraisedValueUSD'});assert.equal(calls.filter(u=>u==='/a.json').length,1);
 const bad=createPropertyRegionData({regions:[region],fetchImpl:async url=>({ok:true,json:async()=>url===region.manifestUrl?manifest:{...payload,fields:[...fields].reverse()}})});assert.equal((await bad.query(query)).partial,true);
});
test('hidden transfer date filters do not disable assessed values; invalid transfer years fail',async()=>{
 const d=createPropertyRegionData({regions:[region],fetchImpl:async url=>({ok:true,json:async()=>url===region.manifestUrl?manifest:payload})});
 assert.equal((await d.query({...query,fromYear:2025,toYear:2020})).count,2);
 await assert.rejects(d.query({...query,metric:'latestSalePriceUSD',fromYear:2025,toYear:2020}),/valid date range/);
});
test('aborted views never resolve into stale map features',async()=>{
 const controller=new AbortController();let release;const pending=new Promise(r=>release=r);
 const d=createPropertyRegionData({regions:[region],fetchImpl:async()=>{await pending;return{ok:true,json:async()=>manifest};}});
 const result=d.query({...query,signal:controller.signal});controller.abort();release();await assert.rejects(result,{name:'AbortError'});
});
test('CSV carries metric and source meaning and escapes spreadsheet formulas',()=>{
 const csv=propertyAtlasCsv({level:'properties',metric:'assessedValueUSD',sources:[],features:[{jurisdiction:'st-louis-city',address:'=CMD()',recordKey:'x'}]});
 assert.match(csv,/displayMetric/);assert.match(csv,/sourceRetrievedAt/);assert.match(csv,/'=CMD\(\)/);assert.match(csv,/individual source record/);
});
test('address-based inspection finds the exact regional record by parcel boundary and all identifiers',async()=>{
 const d=createPropertyRegionData({regions:[region],fetchImpl:async url=>({ok:true,json:async()=>url===region.manifestUrl?manifest:payload})});
 const parcel={bbox:tile.bounds,properties:{recordKey:rows[0][0],parcelKey:rows[0][1],sourceObjectId:1,parcelId:undefined,jurisdiction:'st-louis-county'}};
 assert.equal((await d.findRecord(parcel)).latestSalePriceUSD,0);
 assert.equal(await d.findRecord({...parcel,properties:{...parcel.properties,sourceObjectId:2}}),null);
});
