import test from 'node:test';
import assert from 'node:assert/strict';
import { getPropertyLayer, propertyLayerStatus, projectPublicInventory, projectImportedListings, projectPermitRecords } from '../../src/lib/property-layer-catalog.mjs';
import { PUBLIC_LRA_SOURCE } from '../../src/lib/city-public-listings.mjs';

const retrievedAt='2026-09-12T14:00:00Z';
const listing=(id='one')=>({id,sourceId:PUBLIC_LRA_SOURCE.id,parcelKey:'st-louis-city:shared',parcelId:id,handle:'shared',status:'available',sourceStatus:'Available',askingPrice:null,priceStatus:'not-published',longitude:-90.2,latitude:38.6,retrievedAt,sourceUrl:'https://www.stlouis-mo.gov/example',parcelJoinStatus:'shared-handle'});
const snapshot=rows=>({schemaVersion:1,source:PUBLIC_LRA_SOURCE,retrievedAt,listings:rows});

test('registry distinguishes configured data, import requirements, and the absent licensed feed',()=>{
 assert.equal(propertyLayerStatus('assessments').state,'not-loaded');
 assert.equal(propertyLayerStatus('imported-listings').state,'import-required');
 assert.equal(propertyLayerStatus('market-listings',{loaded:true,counts:{records:100,mapped:100}}).state,'license-required');
 assert.equal(propertyLayerStatus('market-listings',{loaded:true,counts:{records:100,mapped:100}}).canMap,false);
 assert.equal(getPropertyLayer('ownership-signals').evidenceType,'name-pattern');
 assert.equal(getPropertyLayer('planning-notices').geometry,'documents');
 assert.match(getPropertyLayer('permits').coverage,/issued in 2025/);
 assert.throws(()=>propertyLayerStatus('missing'),RangeError);
});
test('LRA projection keeps source identities and unknown prices without inventing GIS joins',()=>{
 const row={...listing(),ownerName:'must not copy',contact:'must not copy'};const before=structuredClone(row);
 const result=projectPublicInventory(snapshot([row]));const point=result.features[0];
 assert.equal(point.sourceListingId,row.id);assert.equal(point.parcelKey,row.parcelKey);assert.equal(point.recordKey,null);
 assert.equal(point.value,null);assert.equal(point.askingPrice,null);assert.equal(point.parcelJoinStatus,'shared-handle');
 assert.equal(point.ownerName,undefined);assert.equal(point.contact,undefined);assert.deepEqual(row,before);
 assert.equal(result.status.state,'ready');assert.equal(result.status.canMap,true);
});
test('unlocated, out-of-view, invalid, duplicated, and capped rows are counted separately',()=>{
 const result=projectPublicInventory(snapshot([listing('a'),listing('b'),listing('same'),listing('same'),{...listing('no-point'),longitude:null,latitude:null},{...listing('invalid'),longitude:NaN},{...listing('elsewhere'),longitude:-91}]),{bounds:[-90.5,38.5,-90.1,38.8],limit:1});
 assert.deepEqual(result.counts,{records:7,eligible:7,matched:2,mapped:1,unlocated:1,invalid:1,duplicates:2,omitted:1,outsideView:1,filtered:0});
 assert.equal(result.status.state,'partial');assert.equal(result.features[0].sourceListingId,'a');
 assert.equal(projectPublicInventory(snapshot([{...listing(),longitude:null,latitude:null}])).status.state,'unmapped');
 assert.throws(()=>projectPublicInventory(snapshot([listing()]),{bounds:[0,0,1,Infinity]}),RangeError);
});
test('public snapshot failure and staleness are never presented as a successful empty live feed',()=>{
 assert.equal(projectPublicInventory(null).status.state,'unavailable');
 assert.equal(projectPublicInventory(snapshot([])).status.state,'empty');
 assert.equal(projectPublicInventory(snapshot([listing()]),{now:Date.parse('2026-09-15T00:00:00Z')}).status.state,'stale');
 assert.equal(projectPublicInventory(snapshot([listing()]),{now:Date.parse('2020-01-01')}).status.state,'partial');
 assert.equal(projectPublicInventory(snapshot([{...listing(),askingPrice:100}])).features.length,0);
});
test('import projection defaults to active asking prices, preserves source time, and omits arbitrary metadata',()=>{
 const row={id:'feed::123',listingId:'123',source:'User feed',asOf:'2026-09-10',status:'active',askingPrice:125000,longitude:-90.3,latitude:38.7,parcelId:'unverified',metadata:{owner:'private',apiKey:'not copied'}};
 const result=projectImportedListings([row,{...row,id:'feed::sold',status:'sold'}]);const point=result.features[0];
 assert.equal(result.counts.filtered,1);assert.equal(point.value,125000);assert.equal(point.amountKind,'asking-price');
 assert.equal(point.asOf,row.asOf);assert.equal(point.recordKey,null);assert.equal(point.parcelKey,null);assert.equal(point.jurisdiction,null);
 assert.equal(point.metadata,undefined);assert.equal(projectImportedListings(null).status.state,'import-required');
 assert.throws(()=>projectImportedListings([row],{statuses:['available']}),RangeError);
});
test('permit dates and statuses pass through literally; parcel identifiers are not asserted as matches',()=>{
 const sourceId='st-louis-city-building-permits-2025';
 const row={id:'permit-1',sourceId,jurisdiction:'st-louis-city',sourceObjectId:0,longitude:-90.2,latitude:38.6,status:'issue-date-recorded',statusBasis:'source date presence',issuedDate:'2025-01-01',completedDate:null,estimatedCostUSD:0,parcelHandle:'same-handle'};
 const result=projectPermitRecords({source:{id:sourceId,url:'https://example.com/official'},retrievedAt,records:[row]});
 assert.equal(result.features[0].sourceObjectId,0);assert.equal(result.features[0].value,0);
 assert.equal(result.features[0].status,'issue-date-recorded');assert.equal(result.features[0].completedDate,null);
 assert.equal(result.features[0].parcelKey,null);assert.equal(result.features[0].parcelJoinStatus,'not-established');
 assert.equal(result.features[0].amountKind,'estimated-project-cost');
});
