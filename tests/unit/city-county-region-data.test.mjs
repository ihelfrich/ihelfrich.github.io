import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base=process.env.COUNTY_REGION_TEST_DIR ? new URL(`file://${process.env.COUNTY_REGION_TEST_DIR.replace(/\/$/,'')}/`) : new URL('../../public/st-louis/regions/st-louis-county/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
const oldStudy=JSON.parse(await readFile(new URL('../../public/st-louis/county-current/index.json',import.meta.url),'utf8'));
const known=new Map(oldStudy.records.map(r=>[r.sourceObjectId,r]));
const fields=['parcelId','sourceObjectId','longitude','latitude','address','municipality','taxYear','assessedValueUSD','assessorAppraisedValueUSD','propertyClass','latestSaleDateISO','latestSaleDateRaw','latestSalePriceUSD','latestSalePriceStatus','latestSaleValidityCode','latestSaleMarketValidityCode','latestSaleInstrumentTypeCode','latestSaleDateCenturyInferred','recordKey','parcelKey','latestSaleReportedPriceUSD'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const fresh=()=>({metrics:{assessedValueUSD:{sum:0,count:0},assessorAppraisedValueUSD:{sum:0,count:0},latestSalePriceUSD:{sum:0,count:0}},latestSaleYears:{},unknownSaleDateCount:0,maxObservedLatestTransferDateISO:null,latestDatePriceConflictCount:0,multiParcelPriceWithheldCount:0});
function add(s,r){
  if(r[13]==='conflicting-same-date')s.latestDatePriceConflictCount++;
  if(r[13]==='multi-parcel-total-withheld')s.multiParcelPriceWithheldCount++;
  if(r[10]&&(!s.maxObservedLatestTransferDateISO||r[10]>s.maxObservedLatestTransferDateISO))s.maxObservedLatestTransferDateISO=r[10];
  for(const [name,i] of [['assessedValueUSD',7],['assessorAppraisedValueUSD',8],['latestSalePriceUSD',12]]) if(r[i]!==null&&(i!==12||r[i]>=0)){s.metrics[name].sum+=Math.round(r[i]*100);s.metrics[name].count++;}
  if(r[10]){const t=s.latestSaleYears[r[10].slice(0,4)]??={count:0,priceSum:0,priceCount:0};t.count++;if(r[12]!==null&&r[12]>=0){t.priceSum+=Math.round(r[12]*100);t.priceCount++;}}
  else s.unknownSaleDateCount++;
}
function finish(s){for(const t of Object.values(s.metrics))t.sum/=100;for(const t of Object.values(s.latestSaleYears))t.priceSum/=100;return s;}
const audit={seen:new Uint8Array(401486),locators:new Set(),missing:0,points:0,unlocated:0,bytes:0,studyMatched:0,latestMatches:0,totals:fresh(),anchors:new Map(),taxYears:{}};

function checkRow(row,isPoint){
  assert.equal(row.length,21);
  const[id,oid,lon,lat]=row;
  assert.ok(Number.isInteger(oid)&&oid>=1&&oid<=401485);assert.equal(audit.seen[oid],0);audit.seen[oid]=1;
  if(id===null){audit.missing++;assert.equal(row[18],`st-louis-county-current:objectid:${oid}`);assert.equal(row[19],null);assert.equal(row[13],null);}
  else {audit.locators.add(id);assert.equal(row[18],`st-louis-county-current:${id}:${oid}`);assert.equal(row[19],`st-louis-county:${id}`);}
  for(const i of [7,8,12,20])assert.ok(row[i]===null||Number.isFinite(row[i]));
  if(['conflicting-same-date','multi-parcel-total-withheld'].includes(row[13]))assert.equal(row[12],null);
  else assert.equal(row[20],null,'Reported amount is only retained separately when the parcel price is withheld');
  if(['1','U'].includes(row[14])||row[15]==='1')assert.equal(row[12],null,'An explicit multi-parcel source code cannot supply a parcel price');
  const year=row[6]===null?'unknown':String(row[6]);audit.taxYears[year]=(audit.taxYears[year]??0)+1;
  if(row[13]!==null)audit.latestMatches++;
  if(isPoint){assert.ok(Number.isFinite(lon)&&Number.isFinite(lat));audit.points++;add(audit.totals,row);}else{assert.equal(lon,null);assert.equal(lat,null);audit.unlocated++;}
  const prior=known.get(oid);
  if(prior){audit.studyMatched++;assert.equal(id,prior.parcelId);assert.equal(row[7],prior.assessedValueUSD);assert.equal(row[8],prior.assessorAppraisedValueUSD);assert.equal(row[6],prior.taxYear);assert.equal(row[18],prior.recordKey);}
  if(['16L640291','16L640323'].includes(id))audit.anchors.set(id,row);
}

test('every region tile is hashed, bounded, identity-safe and reconciles its filtered aggregates',async()=>{
  assert.equal(manifest.schema,'property-region-v1');assert.equal(manifest.regionId,'st-louis-county');assert.deepEqual(manifest.fields,fields);
  assert.equal(manifest.tiles.length,390);
  for(const tile of manifest.tiles){
    const bytes=await readFile(new URL(`tiles/${tile.id}.json`,base));audit.bytes+=bytes.length;
    assert.equal(bytes.length,tile.bytes);assert.equal(hash(bytes),tile.sha256);
    const data=JSON.parse(bytes);assert.equal(data.schema,'property-region-tile-v1');assert.equal(data.id,tile.id);assert.equal(data.jurisdiction,'st-louis-county');assert.equal(data.regionId,manifest.regionId);assert.equal(data.sourceId,manifest.source.id);assert.deepEqual(data.fields,fields);assert.equal(data.rows.length,tile.count);
    const stats=fresh();
    for(const row of data.rows){checkRow(row,true);add(stats,row);const[, ,x,y]=row;assert.ok(x>=tile.bounds[0]-1e-8&&x<=tile.bounds[2]+1e-8&&y>=tile.bounds[1]-1e-8&&y<=tile.bounds[3]+1e-8);}
    finish(stats);assert.deepEqual(stats.metrics,tile.metrics);assert.deepEqual(stats.latestSaleYears,tile.latestSaleYears);assert.equal(stats.unknownSaleDateCount,tile.unknownSaleDateCount);
    for(const key of ['maxObservedLatestTransferDateISO','latestDatePriceConflictCount','multiParcelPriceWithheldCount'])assert.equal(tile[key],stats[key]);
  }
  const unlocated=JSON.parse(await readFile(new URL('unlocated.json',base),'utf8'));assert.deepEqual(unlocated.fields,fields);for(const row of unlocated.rows)checkRow(row,false);
  assert.equal(audit.points,401480);assert.equal(audit.unlocated,5);assert.equal(audit.seen.slice(1).reduce((a,b)=>a+b,0),401485);
  assert.equal(audit.locators.size,401466);assert.equal(audit.missing,10);assert.equal(audit.studyMatched,11151);assert.equal(audit.latestMatches,370360);
  assert.equal(manifest.sourceFeatureCount,audit.points+audit.unlocated);assert.equal(manifest.recordCount,audit.points);assert.equal(manifest.mappedPointCount,audit.points);assert.equal(manifest.unlocatedCount,audit.unlocated);
  assert.equal(manifest.uniqueParcelCount,audit.locators.size);assert.equal(manifest.missingParcelIdCount,audit.missing);assert.equal(manifest.duplicateLocatorFeatureCount,9);assert.equal(manifest.totalTileBytes,audit.bytes);
  finish(audit.totals);assert.deepEqual(manifest.metrics,audit.totals.metrics);assert.deepEqual(manifest.latestSaleYears,audit.totals.latestSaleYears);assert.equal(manifest.unknownSaleDateCount,audit.totals.unknownSaleDateCount);assert.deepEqual(manifest.source.taxYears,audit.taxYears);
  for(const key of ['maxObservedLatestTransferDateISO','latestDatePriceConflictCount','multiParcelPriceWithheldCount'])assert.equal(manifest[key],audit.totals[key]);
});

test('latest transfer preserves zero, source validity and vintage instead of using an older positive price',()=>{
  const zero=audit.anchors.get('16L640291');assert.ok(zero);assert.equal(zero[10],'2021-05-12');assert.equal(zero[11],'12-MAY-21');assert.equal(zero[12],0);assert.equal(zero[13],'zero-recorded');assert.equal(zero[14],'4');assert.equal(zero[17],true);
  const newer=audit.anchors.get('16L640323');assert.equal(newer[10],'2023-05-02');assert.equal(newer[12],14500);assert.equal(newer[14],'2');
  assert.equal(manifest.saleSource.memberSha256,'1375668e9ff8a3b3a28a1364c29de9188def3ca2adc3d382164b22a15240ab15');
  assert.equal(manifest.saleSource.archiveEntryTimestamp,'2025-11-17T09:16:38');assert.match(manifest.saleSource.selectionRule,/never replaced/);
  assert.equal(manifest.source.sourceDataEditedAt,null);assert.match(manifest.source.queryUrl,/maps\.stlouisco\.com\/hosting\/rest\/services\/Maps\/AGS_Parcels\/MapServer\/0\/query$/);
});

test('conflicting and explicitly multi-parcel latest amounts are withheld, with original retrieval provenance',()=>{
  assert.ok(manifest.latestDatePriceConflictCount>0);assert.ok(manifest.multiParcelPriceWithheldCount>0);
  assert.equal(manifest.maxObservedLatestTransferDateISO,'2025-10-29');
  assert.equal(manifest.saleSource.codeDefinitions['SALEVAL:1'],'ADDITIONAL PARCELS');
  assert.equal(manifest.saleSource.codeDefinitions['SALEVAL:U'],'USEABLE MULTI PARCEL SALE');
  assert.equal(manifest.saleSource.codeDefinitions['MKTVALID:1'],'SALE INVOLVING MULTIPLE PARCELS');
  assert.match(manifest.saleSource.selectionRule,/not a within-day chronology/);
  assert.match(manifest.saleSource.reportedAmountMeaning,/not a usable single-parcel price/);
  assert.match(manifest.summaryRules.transfers,/exclude withheld conflicts and multi-parcel/);
  assert.equal(manifest.source.offlineDerivation,true);
  assert.ok(Date.parse(manifest.source.derivedAt)>Date.parse(manifest.source.retrievedAt));
  assert.match(manifest.source.retrievedAt,/^2026-09-12T17:59:/);
});

test('publication contains a point-only allowlist with honest source limits',()=>{
  assert.deepEqual(manifest.fields,fields);for(const field of fields)assert.doesNotMatch(field,/owner|mailing|phone|email|contact|notes|payment|balance/i);
  assert.equal(manifest.geometry.kind,'approximate-representative-points');assert.equal(manifest.geometry.sourceGeneralizationDegrees,.00001);
  assert.match(manifest.geometry.note,/Exact parcel geometry/);assert.match(manifest.limitations.join(' '),/not houses/);assert.match(manifest.summaryRules.transfers,/not all transactions/);
  assert.ok(manifest.largestTileBytes<1000000,'Largest viewport tile stays below 1MB raw JSON');
});
