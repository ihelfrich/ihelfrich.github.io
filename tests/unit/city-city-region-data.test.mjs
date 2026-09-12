import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const directory=path.join(root,'public/st-louis/regions/st-louis-city');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
const rows=[];const tiles=[];
for(const entry of manifest.tiles){const raw=fs.readFileSync(path.join(root,'public',entry.url));const tile=JSON.parse(raw);tiles.push({entry,raw,tile});rows.push(...tile.rows);}
const ix=Object.fromEntries(manifest.fields.map((name,index)=>[name,index]));

test('City regional bundle covers the complete independently keyed geometry snapshot',()=>{
 const search=JSON.parse(fs.readFileSync(path.join(root,'public/st-louis/parcels/search.json'))).records;
 assert.equal(manifest.schema,'property-region-v1');assert.equal(manifest.recordCount,134347);assert.equal(rows.length,search.length);
 const byKey=new Map(rows.map(row=>[row[ix.recordKey],row]));assert.equal(byKey.size,search.length);
 for(const source of search){const row=byKey.get(source[6]);assert.ok(row);assert.equal(row[ix.parcelId],source[1]);assert.equal(row[ix.parcelKey],`st-louis-city:${source[0]}`);assert.equal(row[ix.longitude],source[3]);assert.equal(row[ix.latitude],source[4]);}
 assert.equal(new Set(rows.map(row=>row[ix.parcelId])).size,manifest.distinctParcelIds);
 assert.equal(manifest.duplicateParcelIdGroups,11);
});
test('Every City tile is bounded, hashed and declares the same positional schema',()=>{
 for(const {entry,raw,tile} of tiles){assert.equal(raw.length,entry.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),entry.sha256);assert.equal(tile.schema,'property-region-tile-v1');assert.equal(tile.id,entry.id);assert.equal(tile.sourceId,manifest.source.id);assert.deepEqual(tile.fields,manifest.fields);assert.equal(tile.count,entry.count);assert.equal(tile.rows.length,entry.count);
  for(const row of tile.rows){assert.equal(row.length,manifest.fields.length);const lon=row[ix.longitude],lat=row[ix.latitude];assert.ok(lon>=entry.bounds[0]&&lon<=entry.bounds[2]&&lat>=entry.bounds[1]&&lat<=entry.bounds[3]);assert.equal(`${Math.floor(lon/.02)}_${Math.floor(lat/.02)}`,entry.id);}
 }
});
test('Regional amounts and latest-year aggregates exactly reconcile, including known zeros',()=>{
 const aggregate=(subset)=>{const metrics=Object.fromEntries(['assessedValueUSD','assessorAppraisedValueUSD','latestSalePriceUSD'].map(key=>[key,{sum:0,count:0}]));const years={};let unknown=0;
  for(const row of subset){for(const [key,metric] of Object.entries(metrics)){const value=row[ix[key]];if(value!==null){assert.equal(typeof value,'number');assert.ok(Number.isFinite(value)&&value>=0);metric.sum+=value;metric.count++;}}
   const date=row[ix.latestSaleDateISO];if(!date){unknown++;continue;}const year=years[date.slice(0,4)]??={count:0,priceSum:0,priceCount:0};year.count++;if(row[ix.latestSalePriceUSD]!==null){year.priceSum+=row[ix.latestSalePriceUSD];year.priceCount++;}}
  return {metrics,years,unknown};};
 for(const {entry,tile} of tiles){const got=aggregate(tile.rows);assert.deepEqual(entry.metrics,got.metrics);assert.deepEqual(tile.metrics,got.metrics);assert.deepEqual(entry.latestSaleYears,got.years);assert.equal(entry.unknownSaleDateCount,got.unknown);}
 const total=aggregate(rows);assert.deepEqual(manifest.metrics,total.metrics);assert.deepEqual(manifest.latestSaleYears,total.years);assert.equal(manifest.unknownSaleDateCount,total.unknown);
 assert.ok(rows.some(row=>row[ix.assessedValueUSD]===0));assert.ok(rows.some(row=>row[ix.latestSalePriceUSD]===0));
});
test('Unknown assessment year, appraisal, market validation and unpaired sale amounts stay unknown',()=>{
 assert.equal(manifest.source.assessmentYear,null);assert.equal(manifest.source.taxYear,null);
 for(const row of rows){assert.equal(row[ix.assessorAppraisedValueUSD],null);assert.equal(row[ix.taxYear],null);assert.equal(row[ix.latestSaleMarketValidityCode],null);assert.equal(row[ix.latestSaleInstrumentTypeCode],null);
  if(row[ix.latestSaleDateISO]===null){assert.equal(row[ix.latestSalePriceUSD],null);assert.equal(row[ix.latestSaleSourceId],null);}
  if(['conflicting-latest-day-prices','multi-parcel-total-withheld'].includes(row[ix.latestSalePriceStatus]))assert.equal(row[ix.latestSalePriceUSD],null);
 }
 assert.ok(rows.some(row=>row[ix.latestSalePriceStatus]==='conflicting-latest-day-prices'));assert.ok(rows.some(row=>row[ix.latestSalePriceStatus]==='multi-parcel-total-withheld'));
});
test('Each selected sale has exact source provenance and never exceeds observed source coverage',()=>{
 const used=new Set();for(const row of rows){const id=row[ix.latestSaleSourceId];if(!id)continue;const source=manifest.sources[id];assert.ok(source);used.add(id);assert.ok(row[ix.latestSaleDateISO]<=source.maxObservedSaleDateISO);assert.match(source.url,/^https:\/\/(?:maps8|www)\.stlouis-mo\.gov\//);
  if(id==='st-louis-city-gis-residential-sale-fields')assert.equal(row[ix.latestSaleValidityCode],null);
 }
 assert.equal(manifest.maxObservedLatestTransferDateISO,rows.map(row=>row[ix.latestSaleDateISO]).filter(Boolean).sort().at(-1));assert.equal(used.size,2);assert.equal(manifest.sources['st-louis-city-gis-residential-sale-fields'].maxObservedSaleDateISO,'2025-02-28');assert.equal(manifest.sources['st-louis-city-prclsale-2026-09-12'].maxObservedSaleDateISO,'2024-11-28');
 assert.ok(manifest.sources['st-louis-city-prclsale-2026-09-12'].retrievedAt.startsWith('2026-09-12'));assert.equal(manifest.sources.geometry.retrievedAt.startsWith('2026-09-08'),true);
});
test('Ambiguous City parcel accounts do not receive a sales-database join',()=>{
 const counts=new Map();for(const row of rows)counts.set(row[ix.parcelId],(counts.get(row[ix.parcelId])??0)+1);
 for(const row of rows)if(counts.get(row[ix.parcelId])>1)assert.notEqual(row[ix.latestSaleSourceId],'st-louis-city-prclsale-2026-09-12');
 assert.ok(manifest.limitations.some(line=>line.includes('GIS records')));assert.ok(!manifest.fields.some(key=>/owner|mail|contact|phone/i.test(key)));
});
test('City builder preserves Access Currency scale, date pairing and deterministic source precedence',()=>{
 const code=String.raw`import importlib.util,json
spec=importlib.util.spec_from_file_location('city_builder','scripts/st-louis/build_city_region.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assert m.currency(4850000000)==485000
assert m.currency(0)==0
assert m.currency(None) is None
assert m.currency(-10000) is None
assert m.finite(-10) is None
assert m.finite(0)==0
assert m.choose_sale({'ResSaleDate':None,'ResSalePrice':950000},None) is None
mdb={'date':'2024-01-01','price':None,'status':'conflicting-latest-day-prices'}
assert m.choose_sale({'ResSaleDate':1704067200000,'ResSalePrice':950000},mdb) is mdb
new=m.choose_sale({'ResSaleDate':1735689600000,'ResSalePrice':0},mdb)
assert new['price']==0 and new['status']=='recorded-zero' and new['date']=='2025-01-01'
t={'AsrParcelId':['a','a','b','c'],'SaleDate':['2024-01-01 00:00:00']*4,'SalePrice':[1000000000,1200000000,2000000000,0],'NbrOfParcels':[1,1,2,1],'SalePricePerParcel':['$100,000.00','$120,000.00','$100,000.00','$0.00'],'SaleType':[10,10,26,98]}
got,stats=m.latest_mdb(t,{'a','b'},expected_rows=4)
assert got['a']['price'] is None and got['a']['status']=='conflicting-latest-day-prices'
assert got['b']['price'] is None and got['b']['status']=='multi-parcel-total-withheld'
assert 'c' not in got
assert stats['latestDayPriceConflicts']==1 and stats['latestMultiParcelTotalsWithheld']==1
print('ok')`;
 const inGitHubActions=process.env.GITHUB_ACTIONS==='true';
 const executable=inGitHubActions?'python3':'uv';
 const args=inGitHubActions?['-c',code]:['run','--no-project','python','-c',code];
 const output=execFileSync(executable,args,{cwd:root,encoding:'utf8',timeout:30000});assert.equal(output.trim(),'ok');
});
