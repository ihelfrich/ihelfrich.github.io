"""Build a compact County-wide point region from official allowlisted GIS records.

uv run --no-project --with shapely python scripts/st-louis/fetch_county_region.py \
 --cache ../research/county-records-2026/countywide-region-cache \
 --metadata ../research/county-records-2026/countywide-layer-metadata.json \
 --frozen-ids ../research/county-records-2026/countywide-start-ids.json \
 --sales-cache ../research/county-records-2026/transfers-2025-range \
 --output public/st-louis/regions/st-louis-county

No owner/contact fields are requested. Source polygons stay in the research cache;
public tiles contain approximate map points only. Existing study assets are untouched.
Use a new cache for a fresh retrieval. --resume explicitly reuses verified cached
pages after an interrupted run; their original retrieval timestamps are retained.
Add --offline to rebuild exclusively from an already complete, verified cache.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import subprocess
import time
import urllib.parse
import zlib

from shapely.geometry import shape
from shapely import make_valid
from extract_county_history import source_date, number, text

REGION = 'st-louis-county'
SOURCE_ID = 'st-louis-county-current'
BASE = 'https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0'
GRID = .02
FIELDS = ['parcelId','sourceObjectId','longitude','latitude','address','municipality','taxYear',
          'assessedValueUSD','assessorAppraisedValueUSD','propertyClass','latestSaleDateISO','latestSaleDateRaw',
          'latestSalePriceUSD','latestSalePriceStatus','latestSaleValidityCode','latestSaleMarketValidityCode',
          'latestSaleInstrumentTypeCode','latestSaleDateCenturyInferred','recordKey','parcelKey','latestSaleReportedPriceUSD']
GIS_FIELDS = ['OBJECTID','LOCATOR','TAXYR','PROP_ADD','MUNICIPALITY','TOTASSMT','TOTAPVAL','PROPCLASS']
OFFLINE = False


def encode(data): return json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
def sha(raw): return hashlib.sha256(raw).hexdigest()
def now(): return datetime.now(timezone.utc).isoformat()
def write(path, data): path.parent.mkdir(parents=True, exist_ok=True);path.write_bytes(encode(data))


def fetch(cache, name, parameters):
    url = BASE + '/query?' + urllib.parse.urlencode({'f':'json', **parameters})
    path = cache / f'{name}.json'
    if path.exists():
        raw = path.read_bytes()
        receipt_path=cache/f'{name}-receipt.json'
        if not receipt_path.exists(): raise ValueError('Cached page has no acquisition receipt.')
        receipt=json.loads(receipt_path.read_text())
        if receipt['bytes'] != len(raw) or receipt['sha256'] != sha(raw): raise ValueError('Cached page differs from its recorded digest.')
        return json.loads(raw), {**receipt,'cacheReused':True}
    if OFFLINE: raise ValueError(f'Offline rebuild requires cached source page {name}.')
    start = time.monotonic()
    command = ['curl','--max-time','45','--max-filesize','12000000','--compressed','-sS','--fail-with-body',url]
    result = subprocess.run(command, capture_output=True, timeout=50)
    if result.returncode:
        # One ordinary retry for transient transport/server errors, never auth/challenge handling.
        if result.returncode not in (7,18,28,52,56): raise RuntimeError(f'Official source request failed ({result.returncode}); no access workaround attempted.')
        result = subprocess.run(command, capture_output=True, timeout=50, check=True)
    raw = result.stdout
    if len(raw) > 12000000: raise ValueError('Source page exceeds bounded response budget.')
    data = json.loads(raw)
    if data.get('error'): raise ValueError(f'Official source error: {data["error"].get("message")}')
    path.write_bytes(raw)
    receipt = {'file':path.name,'bytes':len(raw),'sha256':sha(raw),'elapsedSeconds':round(time.monotonic()-start,3),'retrievedAt':now(),'url':url}
    write(cache / f'{name}-receipt.json', receipt)
    return data, receipt


def select_latest_sales(reader):
    """Group by latest interpreted date, without treating file order as chronology."""
    groups, unparsed, count = {}, 0, 0
    for record in reader:
        count += 1
        locator = text(record.get('PARID'))
        if not locator: continue
        date_raw, date_iso, inferred = source_date(record.get('SALEDT'), 2025)
        if date_raw and not date_iso: unparsed += 1
        previous = groups.get(locator)
        date_rank = date_iso or ''
        if previous is not None and date_rank < previous['date']: continue
        price = number(record.get('PRICE'))
        validity, market = text(record.get('SALEVAL')), text(record.get('MKTVALID'))
        multiple = validity in ('1', 'U') or market == '1'
        status = 'missing' if price is None else 'negative-recorded' if price < 0 else 'zero-recorded' if price == 0 else 'low-recorded-amount' if price <= 100 else 'recorded'
        selected = [date_iso,date_raw,price,status,validity,market,text(record.get('INSTRTYP')),inferred]
        if previous is None or date_rank > previous['date']:
            groups[locator] = {'date':date_rank,'selected':selected,'prices':{price},'multiple':multiple,'rows':1}
        else:
            previous['selected'] = selected  # Deterministic representative only; no within-day chronological claim.
            previous['prices'].add(price)
            previous['multiple'] |= multiple
            previous['rows'] += 1
    latest, ties, conflicts, multi, overlap = {}, 0, 0, 0, 0
    for locator, group in groups.items():
        selected = group['selected']
        conflict = len(group['prices']) > 1
        ties += group['rows'] > 1
        conflicts += conflict
        multi += group['multiple']
        overlap += conflict and group['multiple']
        reported = selected[2] if conflict or group['multiple'] else None
        if conflict: selected[2:4] = [None, 'conflicting-same-date']
        elif group['multiple']: selected[2:4] = [None, 'multi-parcel-total-withheld']
        latest[locator] = selected + [reported]
    return latest, {'sourceRowsScanned':count,'sourceLocators':len(latest),'unparsedNonemptyDateRows':unparsed,
                    'locatorsWithLatestDateTies':ties,'latestDatePriceConflictLocators':conflicts,
                    'latestDateMultiParcelLocators':multi,'latestDateConflictAndMultiParcelLocators':overlap}


def latest_sales(cache):
    metadata = json.loads((cache / 'acquisition.json').read_text())
    if metadata['url'] != 'https://revenue.stlouisco.com/pdfs/2025/STLCOMO_ASMTROLL_REAL_BILLING_2025.zip' or metadata['member'] != 'STLCOMO_ASMTROLL_BILLING_2025/sales.txt':
        raise ValueError('Unexpected sales source identity.')
    compressed = (cache / 'sales-compressed.bin').read_bytes()
    if sha(compressed) != metadata['memberCompressedSha256']: raise ValueError('Sales compressed hash differs.')
    raw = zlib.decompress(compressed, -15)
    if sha(raw) != metadata['memberSha256'] or len(raw) != metadata['memberBytes'] or f'{zlib.crc32(raw):08x}' != metadata['memberCrc32']:
        raise ValueError('Sales member hash/length/CRC differs.')
    reader = csv.DictReader(io.TextIOWrapper(io.BytesIO(raw), encoding='latin-1', newline=''), delimiter='|')
    if reader.fieldnames != ['PARID','SALEDT','PRICE','TRANSNO','TRANSDT','BOOK','PAGE','SOURCE','SALETYPE','SALEVAL','INSTRUNO','INSTRTYP','NOTES','MKTVALID']:
        raise ValueError('Sales header changed.')
    latest, counts = select_latest_sales(reader)
    metadata = {key: metadata[key] for key in ['url','member','archiveEntryTimestamp','timestampTimezone','memberSha256','memberBytes','retrievedAt']}
    metadata.update(id='stlco-real-billing-2025-sales',name='St. Louis County 2025 billing extract — sales history',**counts,
                    selectionRule='Records are grouped by latest interpreted sale date. Different prices within that date group, including a missing versus numeric price, withhold the parcel price. Any explicit multi-parcel code in that group also withholds it. The last logical source row supplies a deterministic representative raw date, codes and reported amount, not a within-day chronology. Zero, missing, invalid and source-flagged amounts are never replaced with older positive sales. When no date parses, all undated rows form the group.',
                    codeDefinitions={'SALEVAL:1':'ADDITIONAL PARCELS','SALEVAL:U':'USEABLE MULTI PARCEL SALE','MKTVALID:1':'SALE INVOLVING MULTIPLE PARCELS'},
                    codeDictionaryMember='STLCOMO_ASMTROLL_BILLING_2025/STLCO_Real_Data_Dictionary.pdf',
                    reportedAmountMeaning='Optional latestSaleReportedPriceUSD preserves only the deterministic representative source amount when the parcel price is withheld. It is not a usable single-parcel price or an enumeration of all conflicting prices.',
                    dateRule='Raw dates retained. Two-digit years interpreted in the 1926–2025 archive window and flagged. These are administrative transfer records, not independently verified market sales.')
    return latest, metadata


def fresh_summary(): return {'metrics':{'assessedValueUSD':{'sum':0,'count':0},'assessorAppraisedValueUSD':{'sum':0,'count':0},'latestSalePriceUSD':{'sum':0,'count':0}},'latestSaleYears':{},'unknownSaleDateCount':0,'maxObservedLatestTransferDateISO':None,'latestDatePriceConflictCount':0,'multiParcelPriceWithheldCount':0,'municipalities':{},'unknownMunicipalityCount':0}
def add_summary(summary, row):
    if row[5]: summary['municipalities'][row[5]] = summary['municipalities'].get(row[5],0) + 1
    else: summary['unknownMunicipalityCount'] += 1
    summary['latestDatePriceConflictCount'] += row[13] == 'conflicting-same-date'
    summary['multiParcelPriceWithheldCount'] += row[13] == 'multi-parcel-total-withheld'
    for name, index in [('assessedValueUSD',7),('assessorAppraisedValueUSD',8),('latestSalePriceUSD',12)]:
        value = row[index]
        if value is not None and (index != 12 or value >= 0):
            summary['metrics'][name]['sum'] += round(value * 100)
            summary['metrics'][name]['count'] += 1
    if row[10]:
        summary['maxObservedLatestTransferDateISO'] = max(summary['maxObservedLatestTransferDateISO'] or '', row[10])
        year = row[10][:4]
        stats=summary['latestSaleYears'].setdefault(year,{'count':0,'priceSum':0,'priceCount':0})
        stats['count']+=1
        if row[12] is not None and row[12] >= 0: stats['priceSum']+=round(row[12]*100);stats['priceCount']+=1
    else: summary['unknownSaleDateCount']+=1
def finish_summary(summary):
    for name in ['assessedValueUSD','assessorAppraisedValueUSD','latestSalePriceUSD']: summary['metrics'][name]['sum'] /= 100
    for stats in summary['latestSaleYears'].values(): stats['priceSum']/=100
    summary['latestSaleYears'] = dict(sorted(summary['latestSaleYears'].items()))
    return summary


def main():
    global OFFLINE
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['cache','metadata','frozen-ids','sales-cache','output']: parser.add_argument('--'+key,type=Path,required=True)
    parser.add_argument('--resume',action='store_true',help='Explicitly reuse hashed source pages from an interrupted acquisition, retaining their source retrieval timestamps.')
    parser.add_argument('--offline',action='store_true',help='Require --resume and a complete verified cache; issue no network requests.')
    args = parser.parse_args()
    if args.offline and not args.resume: raise ValueError('--offline requires --resume.')
    OFFLINE = args.offline
    if args.output.exists(): raise ValueError('Use a new output region directory; existing assets are not overwritten.')
    if args.cache.exists() and any(args.cache.iterdir()) and not args.resume: raise ValueError('Use a new cache for fresh source retrieval, or explicitly pass --resume for an interrupted run.')
    args.cache.mkdir(parents=True,exist_ok=True)
    started = now()
    metadata_bytes = args.metadata.read_bytes(); metadata = json.loads(metadata_bytes)
    if not set(GIS_FIELDS).issubset({f['name'] for f in metadata['fields']}): raise ValueError('GIS allowlist field missing.')
    frozen = json.loads(args.frozen_ids.read_text())['objectIds']
    expected = sorted(frozen)
    if len(set(expected)) != len(expected): raise ValueError('Duplicate frozen IDs.')
    check, _ = fetch(args.cache,'start-ids',{'where':'1=1','returnIdsOnly':'true'})
    count, _ = fetch(args.cache,'start-count',{'where':'1=1','returnCountOnly':'true'})
    if sorted(check['objectIds']) != expected or count['count'] != len(expected): raise ValueError('Frozen source identities changed before extraction.')
    sales, sale_source = latest_sales(args.sales_cache)
    print(json.dumps({'frozenFeatures':len(expected),'sourceSaleLocators':len(sales),'sourceSaleRows':sale_source['sourceRowsScanned']}),flush=True)
    batches = [expected[i:i+6000] for i in range(0,len(expected),6000)]
    def page(pair):
        n,batch = pair
        parameters = {'f':'geojson','where':f'OBJECTID>={batch[0]} AND OBJECTID<={batch[-1]}','outFields':','.join(GIS_FIELDS),
                      'returnGeometry':'true','outSR':4326,'geometryPrecision':6,'maxAllowableOffset':.00001,'orderByFields':'OBJECTID','resultRecordCount':6000}
        data,receipt = fetch(args.cache,f'features-{n:03d}',parameters)
        features = data.get('features',[])
        if len(features) != len(batch) or {f['properties']['OBJECTID'] for f in features} != set(batch): raise ValueError(f'Incomplete exact source page {n}.')
        if data.get('exceededTransferLimit'): raise ValueError(f'Source page {n} reports exceeded transfer limit.')
        return features,receipt
    tiles,unlocated,receipts = {},[],[]
    seen,locators,tax_years,classes = set(),Counter(),Counter(),Counter()
    invalid_geometry = 0
    missing_locator = 0
    joined_sales = 0
    total_summary = fresh_summary()
    with ThreadPoolExecutor(max_workers=3) as pool:
        for features,receipt in pool.map(page,enumerate(batches),buffersize=3):
            receipts.append(receipt)
            for feature in features:
                a = feature['properties']; oid,locator = a['OBJECTID'],text(a['LOCATOR'])
                if oid in seen: raise ValueError('Duplicate source object ID.')
                seen.add(oid)
                if locator: locators[locator]+=1
                else: missing_locator+=1
                tax_year = a.get('TAXYR');tax_years[str(tax_year) if tax_year is not None else 'unknown']+=1
                klass=text(a.get('PROPCLASS'));classes[klass or 'unknown']+=1
                last=sales.get(locator)
                if last is not None: joined_sales+=1
                row = [locator,oid,None,None,text(a.get('PROP_ADD')) or '',text(a.get('MUNICIPALITY')),tax_year,
                       a.get('TOTASSMT'),a.get('TOTAPVAL'),klass,*(last[:8] if last is not None else [None]*8),
                       f'st-louis-county-current:{locator}:{oid}' if locator else f'st-louis-county-current:objectid:{oid}',
                       f'st-louis-county:{locator}' if locator else None,last[8] if last is not None else None]
                for index in [7,8,12]:
                    if row[index] is not None and (not isinstance(row[index],(int,float)) or not math.isfinite(row[index])): raise ValueError('Nonfinite or nonnumeric source value.')
                    if isinstance(row[index],float) and row[index].is_integer(): row[index]=int(row[index])
                geometry = feature.get('geometry')
                if not geometry:
                    unlocated.append(row);continue
                geom=shape(geometry)
                if not geom.is_valid:
                    invalid_geometry+=1;geom=make_valid(geom)
                if geom.is_empty:
                    unlocated.append(row);continue
                point=geom.representative_point()
                lon,lat=round(point.x,6),round(point.y,6)
                if not (-90.8 < lon < -90.0 and 38.3 < lat < 39.0): raise ValueError('Unexpected County map coordinates.')
                row[2],row[3]=lon,lat
                ix,iy=math.floor(lon/GRID),math.floor(lat/GRID)
                key=f'{ix}_{iy}'
                tile=tiles.setdefault(key,{'bounds':[round(ix*GRID,6),round(iy*GRID,6),round((ix+1)*GRID,6),round((iy+1)*GRID,6)],'rows':[],'summary':fresh_summary()})
                tile['rows'].append(row);add_summary(tile['summary'],row);add_summary(total_summary,row)
            print(json.dumps({'validatedFeatures':len(seen),'total':len(expected),'pointTiles':len(tiles)}),flush=True)
    if seen != set(expected): raise ValueError('A frozen source ID was lost.')
    # Offline derivation preserves the original identity check date rather than claiming a fresh check.
    if args.offline:
        complete = sorted(p.name[:-len('-ids.json')] for p in args.cache.glob('end-*-ids.json') if (args.cache/(p.name[:-len('-ids.json')]+'-count.json')).exists())
        if not complete: raise ValueError('Offline rebuild needs a completed source identity check.')
        final_name = complete[-1]
    else: final_name='end-'+str(int(time.time()))
    final_ids,ids_receipt=fetch(args.cache,final_name+'-ids',{'where':'1=1','returnIdsOnly':'true'})
    final_count,count_receipt=fetch(args.cache,final_name+'-count',{'where':'1=1','returnCountOnly':'true'})
    if sorted(final_ids['objectIds']) != expected or final_count['count'] != len(expected): raise ValueError('Source identities changed during extraction; snapshot rejected.')
    finished=now();retrieval_started=min(r['retrievedAt'] for r in receipts);identity_checked=max(ids_receipt['retrievedAt'],count_receipt['retrievedAt']);retrieval_finished=max([identity_checked]+[r['retrievedAt'] for r in receipts]);args.output.mkdir(parents=True);(args.output/'tiles').mkdir()
    tile_catalog=[]
    for key,tile in sorted(tiles.items()):
        tile['rows'].sort(key=lambda r:r[1])
        payload={'schema':'property-region-tile-v1','id':key,'regionId':REGION,'jurisdiction':REGION,'sourceId':SOURCE_ID,'fields':FIELDS,'rows':tile['rows']}
        raw=encode(payload);(args.output/'tiles'/f'{key}.json').write_bytes(raw)
        tile_catalog.append({'id':key,'bounds':tile['bounds'],'url':f'/st-louis/regions/{REGION}/tiles/{key}.json','count':len(tile['rows']),'bytes':len(raw),'sha256':sha(raw),**finish_summary(tile['summary'])})
    if unlocated: write(args.output/'unlocated.json',{'schema':'property-region-tile-v1','id':'unlocated','regionId':REGION,'jurisdiction':REGION,'sourceId':SOURCE_ID,'fields':FIELDS,'rows':unlocated})
    bounds=[min(t['bounds'][0] for t in tiles.values()),min(t['bounds'][1] for t in tiles.values()),max(t['bounds'][2] for t in tiles.values()),max(t['bounds'][3] for t in tiles.values())]
    point_count=sum(t['count'] for t in tile_catalog)
    manifest={'schema':'property-region-v1','regionId':REGION,'name':'St. Louis County, Missouri','jurisdiction':'st-louis-county',
              'source':{'id':SOURCE_ID,'name':'St. Louis County public tax-roll parcel records','url':BASE,'queryUrl':BASE+'/query','retrievedAt':retrieval_finished,
                        'retrievalStartedAt':retrieval_started,'extractionStartedAt':started,'sourceDataEditedAt':None,'taxYears':dict(tax_years),'metadataSha256':sha(metadata_bytes),
                        'sourceIdentitySha256':sha(encode(expected)),'identityRecheckedAt':identity_checked,'derivedAt':finished,'offlineDerivation':args.offline,
                        'dateMeaning':'TAXYR is the source tax year. Retrieval is not an assessment or record-modification date.'},
              'saleSource':sale_source,'fields':FIELDS,'gridDegrees':GRID,'bounds':bounds,'recordCount':point_count,'mappedPointCount':point_count,'sourceFeatureCount':len(expected),
              'uniqueParcelCount':len(locators),'duplicateLocatorFeatureCount':sum(n-1 for n in locators.values()),'unlocatedCount':len(unlocated),
              'missingParcelIdCount':missing_locator,
              'unlocatedUrl':f'/st-louis/regions/{REGION}/unlocated.json' if unlocated else None,
              'featuresWithLatestTransfer':joined_sales,'propertyClasses':dict(classes),**finish_summary(total_summary),
              'tiles':tile_catalog,'totalTileBytes':sum(t['bytes'] for t in tile_catalog),'largestTileBytes':max(t['bytes'] for t in tile_catalog),
              'geometry':{'kind':'approximate-representative-points','sourceGeneralizationDegrees':.00001,'sourceCoordinateDecimals':6,
                          'pointCoordinateDecimals':6,'invalidGeometriesRepairedForPointPlacement':invalid_geometry,
                          'note':'Points are representative locations from server-simplified polygons, used only as map markers. Exact parcel geometry must be requested on inspection.'},
              'capabilities':{'viewportPoints':True,'currentAssessedValues':True,'currentAssessorAppraisedValues':True,'latestRecordedTransfer':True,'liveParcelInspection':True,'completeTaxBills':False},
              'limitations':['Counts are source parcel features, not houses. Duplicate locators remain separate exact object identities.',
                             'Latest recorded transfer is a selected dated administrative record, not current market value, ownership, or full historical transaction volume.',
                             'Conflicting latest-date prices and explicitly coded multi-parcel amounts are withheld from parcel prices and aggregates. The optional reported amount is only a representative raw source amount.',
                             'Zero/missing/nonmarket/latest source-coded amounts remain explicit; source validity is not independently verified.',
                             'Frozen IDs were rechecked; the public source does not provide a transactional snapshot or per-record edit timestamp.',
                             'Owner, mailing/contact and freeform note fields are not included.'],
              'summaryRules':{'values':'Sums and counts include numeric published values; missing values do not become zero.',
                              'transfers':'Latest recorded amount summaries exclude withheld conflicts and multi-parcel amounts, and include numeric zero and other nonnegative source-coded amounts; negative amounts remain visible in rows but are excluded from price sums/counts. Year counts are latest records per mapped source feature, not all transactions.',
                              'transferCoverage':'Maximum date and price-withholding counts summarize mapped source features. Conflict status takes precedence over multi-parcel status; source-level overlap counts are in saleSource.'}}
    write(args.output/'manifest.json',manifest)
    write(args.cache/'extraction-receipts.json',{'started':started,'finished':finished,'pages':receipts,'totalResponseBytes':sum(r['bytes'] for r in receipts)})
    print(json.dumps({'output':str(args.output),'sourceFeatures':len(expected),'points':point_count,'uniqueParcels':len(locators),'tiles':len(tile_catalog),'bytes':manifest['totalTileBytes'],'latestTransferFeatures':joined_sales,'unlocated':len(unlocated),'finished':finished}),flush=True)


if __name__=='__main__': main()
