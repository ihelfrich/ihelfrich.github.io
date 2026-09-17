import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseListingsCsv} from '../../src/lib/estate-analysis.mjs';

const required=['listing_id','address','latitude','longitude','asking_price','status','source','as_of'];
const optional=['parcel_id','beds','baths','living_area_sqft','property_type'];
const row=(patch={})=>({listing_id:'fixture-1',address:'1 Fixture Way',latitude:'38.6',longitude:'-90.2',asking_price:'200000',status:'active',source:'Fixture Feed',as_of:'2026-09-15',...patch});
const csv=(records,columns=[...required,...optional])=>columns.join(',')+'\n'+records.map(record=>columns.map(key=>record[key]??'').join(',')).join('\n');
const housing=p=>({beds:p.beds,baths:p.baths,livingAreaSqFt:p.livingAreaSqFt,propertyType:p.propertyType});

test('legacy CSV imports preserve source identity and missing optional housing fields are null',()=>{
 const r=parseListingsCsv(csv([row()],required));assert.deepEqual(r.errors,[]);assert.equal(r.listings[0].id,'fixture%20feed::fixture-1');assert.equal(r.listings[0].source,'Fixture Feed');assert.deepEqual(housing(r.listings[0]),{beds:null,baths:null,livingAreaSqFt:null,propertyType:null});
 const blank=parseListingsCsv(csv([row({beds:' ',baths:'',living_area_sqft:' ',property_type:' '})]));assert.deepEqual(blank.errors,[]);assert.deepEqual(housing(blank.listings[0]),housing(r.listings[0]));
});
test('zero bedrooms, fractional baths and housing types normalize without becoming arbitrary metadata',()=>{
 const r=parseListingsCsv(csv([row({beds:'0',baths:'1.5',living_area_sqft:'650.25',property_type:' CONDO ',source_note:'Source assertion only'})],[...required,...optional,'source_note']));assert.deepEqual(r.errors,[]);assert.deepEqual(housing(r.listings[0]),{beds:0,baths:1.5,livingAreaSqFt:650.25,propertyType:'condo'});assert.deepEqual(r.listings[0].metadata,{source_note:'Source assertion only'});
 const max=parseListingsCsv(csv([row({beds:'100',baths:'100',living_area_sqft:'10000000',property_type:'other'})]));assert.equal(max.errors.length,0);
});
test('present invalid housing values reject their row and identify the exact field',()=>{
 const invalid={beds:['-1','1.5','101','NaN','Infinity','three'],baths:['-.5','101','NaN','Infinity'],living_area_sqft:['0','-1','10000001','1e309','NaN'],property_type:['Structure','detached','unknown']};
 for(const[field,values]of Object.entries(invalid))for(const value of values){const r=parseListingsCsv(csv([row({[field]:value})]));assert.equal(r.listings.length,0,`${field}=${value}`);assert.ok(r.errors.some(e=>e.field===field&&e.row===2),`${field}=${value}`);}
});
test('missing trailing optional cells are blank while missing mandatory or unknown metadata columns remain errors',()=>{
 const base=csv([row()],required).split('\n')[1],headers=[...required,...optional].join(',');const r=parseListingsCsv(headers+'\n'+base);assert.equal(r.errors.length,0);assert.equal(r.listings.length,1);assert.deepEqual(housing(r.listings[0]),{beds:null,baths:null,livingAreaSqFt:null,propertyType:null});
 assert.ok(parseListingsCsv(headers+'\n'+base.split(',').slice(0,-1).join(',')).errors.some(e=>e.code==='column-count'));
 assert.ok(parseListingsCsv(headers+',source_note\n'+base).errors.some(e=>e.code==='column-count'));
});
test('housing disagreement participates in latest-identity conflict handling without changing chronology or source isolation',()=>{
 for(const field of ['beds','baths','living_area_sqft','property_type']){const a={beds:'3',baths:'2',living_area_sqft:'1500',property_type:'house'},b={beds:'4',baths:'2.5',living_area_sqft:'1600',property_type:'townhouse'};const r=parseListingsCsv(csv([row(a),row({...a,[field]:b[field]})]));assert.equal(r.listings.length,0);assert.ok(r.errors.some(e=>e.code==='conflicting-latest-records'));}
 const identical=parseListingsCsv(csv([row({beds:'3',property_type:'House'}),row({beds:'3.0',property_type:'house'})]));assert.equal(identical.errors.length,0);assert.equal(identical.listings.length,1);
 const newer=parseListingsCsv(csv([row({beds:'3',as_of:'2026-09-14'}),row({beds:'4'}),row({beds:'2',source:'Other Feed'})]));assert.equal(newer.errors.length,0);assert.equal(newer.listings.length,2);assert.equal(newer.listings.find(p=>p.source==='Fixture Feed').beds,4);
 const sameDay=parseListingsCsv(csv([row({beds:'3'}),row({beds:'4',as_of:'2026-09-15T12:00:00Z'})]));assert.equal(sameDay.listings.length,0);assert.ok(sameDay.errors.some(e=>e.code==='conflicting-latest-records'));
});
test('published template keeps the mandatory contract and advertises all optional fields',async()=>{
 const text=await readFile(new URL('../../public/st-louis/listing-import-template.csv',import.meta.url),'utf8');assert.deepEqual(text.trim().split(','),[...required,...optional]);assert.deepEqual(parseListingsCsv(text),{listings:[],errors:[],warnings:[]});
});
