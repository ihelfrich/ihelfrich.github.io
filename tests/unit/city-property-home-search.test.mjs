import test from 'node:test';
import assert from 'node:assert/strict';
import {filterHomeCandidates} from '../../src/lib/property-home-search.mjs';
import {PROPERTY_REGION_BOUNDS} from '../../src/lib/property-region-catalog.mjs';

const row=(id='one',patch={})=>({id,source:'Explicit test feed',listingId:id,status:'active',longitude:-90.3,latitude:38.6,askingPrice:200000,beds:3,baths:2.5,livingAreaSqFt:1500,propertyType:'house',asOf:'2026-09-15',metadata:{note:'Source-only'},...patch});
test('default search accepts only explicit active or available records in the existing St. Louis bounds',()=>{
 const records=[row(),row('public',{status:'available',askingPrice:null,propertyType:'Structure'}),row('pending',{status:'pending'}),row('sold',{status:'sold'}),row('outside',{longitude:-91}),row('unknown',{status:null})],r=filterHomeCandidates(records);
 assert.deepEqual(r.candidates,[records[0],records[1]]);assert.deepEqual(r.counts,{input:6,matched:2,excluded:4,unknown:1});assert.deepEqual(r.exclusions,{'not-available':2,'outside-supported-area':1,'unknown-status':1});
});
test('price and housing criteria are inclusive and return the original source records in order',()=>{
 const records=[row('a'),row('b',{askingPrice:250000,beds:4,baths:3,livingAreaSqFt:1800}),row('cheap',{askingPrice:199999}),row('small',{livingAreaSqFt:1499}),row('condo',{propertyType:'condo'})];const before=structuredClone(records);
 const r=filterHomeCandidates(records,{minPrice:200000,maxPrice:250000,minBeds:3,minBaths:2.5,minLivingArea:1500,propertyType:'house'});assert.deepEqual(r.candidates.map(p=>p.id),['a','b']);assert.equal(r.candidates[0],records[0]);assert.equal(r.candidates[1].metadata,records[1].metadata);assert.deepEqual(records,before);assert.equal(r.counts.matched+r.counts.excluded,r.counts.input);
});
test('unpublished attributes remain usable without criteria and are excluded explicitly when required',()=>{
 const records=[row('public',{askingPrice:null,beds:null,baths:null,livingAreaSqFt:null,propertyType:'Structure',assessedValueUSD:5000}),row('unknown-type',{propertyType:null})];assert.equal(filterHomeCandidates(records).candidates.length,2);
 for(const[key,value,reason]of [['minPrice',0,'unknown-price'],['maxPrice',300000,'unknown-price'],['minBeds',0,'unknown-beds'],['minBaths',0,'unknown-baths'],['minLivingArea',0,'unknown-living-area']]){const r=filterHomeCandidates(records,{[key]:value});assert.equal(r.counts.unknown,1,key);assert.equal(r.exclusions[reason],1,key);assert.deepEqual(r.candidates,[records[1]]);}
 const typed=filterHomeCandidates(records,{propertyType:'house'});assert.equal(typed.counts.unknown,2);assert.equal(typed.exclusions['unknown-property-type'],2);assert.equal(typed.candidates.length,0);assert.equal(records[0].askingPrice,null);
});
test('all exact duplicate IDs are withheld without merging distinct source identities or parcel IDs',()=>{
 const records=[row('feed::a'),row('feed::a',{askingPrice:210000}),row('other::a',{listingId:'a',parcelId:'shared'}),row('feed::b',{parcelId:'shared'})],r=filterHomeCandidates(records);assert.deepEqual(r.candidates,[records[2],records[3]]);assert.equal(r.exclusions['duplicate-listing-id'],2);assert.equal(r.counts.unknown,0);
});
test('invalid coordinates and malformed requested attributes cannot pass through coercion',()=>{
 const malformed=[null,{},row('nan',{longitude:NaN}),row('string',{latitude:'38.6'}),row('negative-price',{askingPrice:-1}),row('bad-beds',{beds:1.5})];const r=filterHomeCandidates(malformed,{minBeds:1});assert.equal(r.candidates.length,0);assert.equal(r.counts.excluded,6);assert.equal(Object.values(r.exclusions).reduce((a,b)=>a+b,0),6);assert.equal(r.exclusions['invalid-beds'],1);assert.equal(r.exclusions['invalid-price'],1);
 for(const [field,criterion] of [['beds',{minBeds:0}],['baths',{minBaths:0}],['livingAreaSqFt',{minLivingArea:0}]])for(const value of [-1,Infinity,NaN,'3',false])assert.equal(filterHomeCandidates([row('bad',{[field]:value})],criterion).candidates.length,0);
});
test('supported-area edges are inclusive and invalid options or oversized input fail rather than truncate',()=>{
 const[w,s,e,n]=PROPERTY_REGION_BOUNDS;assert.equal(filterHomeCandidates([row('sw',{longitude:w,latitude:s}),row('ne',{longitude:e,latitude:n})]).candidates.length,2);
 for(const criteria of [null,[],{minPrice:-1},{maxPrice:Infinity},{minPrice:2,maxPrice:1},{minBeds:1.5},{minBeds:101},{minBaths:101},{minLivingArea:10000001},{minPrice:''},{propertyType:'Structure'}])assert.throws(()=>filterHomeCandidates([],criteria));
 assert.equal(filterHomeCandidates([row()],{minPrice:null,minBeds:undefined,propertyType:'any'}).candidates.length,1);assert.throws(()=>filterHomeCandidates({}),TypeError);assert.equal(filterHomeCandidates(Array.from({length:5000},(_,i)=>row(String(i)))).candidates.length,5000);assert.throws(()=>filterHomeCandidates(Array.from({length:5001},(_,i)=>row(String(i)))),RangeError);
});
