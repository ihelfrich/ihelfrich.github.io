#!/usr/bin/env python3
"""Build compact City record points from frozen, independently verified official inputs.

uv run --no-project python scripts/st-louis/build_city_region.py
The research inputs are source snapshots, not generated example data. See manifest sources.
Refresh attributes with --refresh-attributes. Regenerate the sales input with:
uv run --no-project --with access-parser==0.0.6 python scripts/st-louis/build_city_region.py --parse-sales
The official prclsale.mdb archive and download metadata must first be in the research folder.
Sales MDB is parsed using access-parser 0.0.6;
Access Currency integers are scaled by 10,000 (Microsoft specification).
"""
from __future__ import annotations
import argparse,collections,concurrent.futures,datetime,decimal,hashlib,json,math,shutil,time,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
RESEARCH=ROOT.parent/'research/city-region-2026'
BASE='https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0'
SOURCE_ID='st-louis-city-regional-records-2026-09'
GIS_SALES_ID='st-louis-city-gis-residential-sale-fields'
MDB_SALES_ID='st-louis-city-prclsale-2026-09-12'
FIELDS=['parcelId','sourceObjectId','longitude','latitude','address','municipality','taxYear','assessedValueUSD','assessorAppraisedValueUSD','propertyClass','latestSaleDateISO','latestSaleDateRaw','latestSalePriceUSD','latestSalePriceStatus','latestSaleValidityCode','latestSaleMarketValidityCode','latestSaleInstrumentTypeCode','latestSaleDateCenturyInferred','recordKey','parcelKey','latestSaleSourceId']
ALLOW_FIELDS='OBJECTID,HANDLE,ParcelId,ColParcelId,SITEADDR,AsdTotal,AsdLand,AsdImprove,PropertyClassCode,AsrClassCode,ResSaleDate,ResSalePrice,LastDate'
METRICS=['assessedValueUSD','assessorAppraisedValueUSD','latestSalePriceUSD']
def read(path):return json.loads(Path(path).read_text())
def encode(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(encode(value))
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def query(params):
    url=BASE+'/query?'+urllib.parse.urlencode({'f':'json',**params})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url,timeout=30) as response:data=json.load(response)
            if 'error' in data:raise RuntimeError(data['error'])
            return data
        except Exception:
            if attempt==2:raise
            time.sleep(1+attempt)
def refresh_attributes():
    ids=sorted(query({'where':'1=1','returnIdsOnly':'true'})['objectIds']);started=stamp()
    def batch(index):
        subset=ids[index:index+500]
        data=query({'objectIds':','.join(map(str,subset)),'outFields':ALLOW_FIELDS,'returnGeometry':'false'})
        attrs=[x['attributes'] for x in data['features']]
        if sorted(a['OBJECTID'] for a in attrs)!=subset:raise ValueError('Partial/changed attribute batch')
        return attrs
    attrs=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        for records in executor.map(batch,range(0,len(ids),500)):attrs.extend(records)
    if sorted(query({'where':'1=1','returnIdsOnly':'true'})['objectIds'])!=ids:raise ValueError('Source IDs changed during extraction')
    write(RESEARCH/'current-attributes.json',{'source':BASE,'queryUrl':BASE+'/query','retrievalStartedAt':started,'retrievedAt':stamp(),'fields':ALLOW_FIELDS.split(','),'recordCount':len(attrs),'startEndIdsEqual':True,'records':sorted(attrs,key=lambda a:a['OBJECTID'])})
def finite(value):return float(value) if isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value) and value>=0 else None
def date_iso(raw):
    if raw is None:return None
    try:
        if isinstance(raw,(int,float)):
            return datetime.datetime.fromtimestamp(raw/1000,datetime.timezone.utc).date().isoformat()
        return datetime.date.fromisoformat(str(raw)[:10]).isoformat()
    except (ValueError,OverflowError,OSError):return None
def currency(raw):
    if raw is None:return None
    if not isinstance(raw,int):raise ValueError('Unexpected Access Currency representation')
    if raw<0:return None
    return float(decimal.Decimal(raw)/10000)
def parse_sales():
    from access_parser import AccessParser
    database=AccessParser(str(RESEARCH/'prclsale.mdb'))
    parsed=database.parse_table('PrclSale')
    allowed=['AsrParcelId','SaleDate','SalePrice','NbrOfParcels','SalePricePerParcel','SaleType']
    expected=database.get_table('PrclSale').table_header['number_of_rows']
    if any(len(parsed[key])!=expected for key in allowed):raise ValueError('Access table header/row count mismatch')
    write(RESEARCH/'sales-rows.json',{key:parsed[key] for key in allowed})

def latest_mdb(table,allowed_parcels,expected_rows=94444):
    length=len(table['AsrParcelId'])
    if length!=expected_rows or any(len(column)!=length for column in table.values()):raise ValueError('MDB row lengths/header count mismatch')
    grouped=collections.defaultdict(list)
    for index,parcel in enumerate(table['AsrParcelId']):
        if parcel in allowed_parcels:grouped[parcel].append(index)
        if table['SalePrice'][index] is not None:
            price=decimal.Decimal(table['SalePrice'][index])/10000
            per=decimal.Decimal(table['SalePricePerParcel'][index].replace('$','').replace(',',''))
            if abs(price/table['NbrOfParcels'][index]-per)>decimal.Decimal('.011'):raise ValueError('Access Currency/price-per-parcel validation failed')
    output={};conflicts=0;multi=0
    for parcel,indices in grouped.items():
        latest=max(date_iso(table['SaleDate'][i]) for i in indices)
        last=[i for i in indices if date_iso(table['SaleDate'][i])==latest]
        amounts={table['SalePrice'][i] for i in last};types={table['SaleType'][i] for i in last}
        is_multi=any(table['NbrOfParcels'][i]!=1 for i in last)
        conflict=len(amounts)>1
        amount=None if conflict or is_multi else currency(next(iter(amounts)))
        status='conflicting-latest-day-prices' if conflict else 'multi-parcel-total-withheld' if is_multi else 'missing' if amount is None else 'recorded-zero' if amount==0 else 'recorded'
        conflicts+=conflict;multi+=is_multi
        output[parcel]={'date':latest,'raw':table['SaleDate'][last[0]],'price':amount,'status':status,'code':str(next(iter(types))) if len(types)==1 else None,'sourceId':MDB_SALES_ID}
    return output,{'rawRowCount':length,'matchedUnambiguousParcelAccounts':len(output),'latestDayPriceConflicts':conflicts,'latestMultiParcelTotalsWithheld':multi,'minObservedSaleDateISO':min(map(date_iso,table['SaleDate'])),'maxObservedSaleDateISO':max(map(date_iso,table['SaleDate']))}
def choose_sale(attribute,mdb):
    gis_date=date_iso(attribute.get('ResSaleDate'))
    if gis_date and (not mdb or gis_date>mdb['date']):
        price=finite(attribute.get('ResSalePrice'))
        return {'date':gis_date,'raw':str(attribute['ResSaleDate']),'price':price,'status':'missing' if price is None else 'recorded-zero' if price==0 else 'recorded','code':None,'sourceId':GIS_SALES_ID}
    return mdb

def aggregate(rows):
    metrics={name:{'sum':0,'count':0} for name in METRICS};years={};unknown=0
    for row in rows:
        for name in METRICS:
            value=row[FIELDS.index(name)]
            if value is not None:metrics[name]['sum']+=value;metrics[name]['count']+=1
        date=row[10]
        if date:
            entry=years.setdefault(date[:4],{'count':0,'priceSum':0,'priceCount':0});entry['count']+=1
            if row[12] is not None:entry['priceSum']+=row[12];entry['priceCount']+=1
        else:unknown+=1
    for m in metrics.values():m['sum']=round(m['sum'],4)
    for y in years.values():y['priceSum']=round(y['priceSum'],4)
    return {'metrics':metrics,'latestSaleYears':dict(sorted(years.items())),'unknownSaleDateCount':unknown}
def build():
    snapshot=read(ROOT/'public/st-louis/parcels/manifest.json');search=read(ROOT/'public/st-louis/parcels/search.json')['records']
    attributes=read(RESEARCH/'current-attributes.json');attr={a['OBJECTID']:a for a in attributes['records']}
    if not attributes.get('startEndIdsEqual') or len(attr)!=len(search):raise ValueError('Unverified current coverage')
    parcel_counts=collections.Counter(r[1] for r in search)
    unique_parcels={p for p,n in parcel_counts.items() if n==1}
    mdb,mdb_stats=latest_mdb(read(RESEARCH/'sales-rows.json'),unique_parcels)
    grouped=collections.defaultdict(list);allrows=[];chosen_sources=collections.Counter()
    for record in search:
        handle,parcel,address,lon,lat,oldtile,key=record;oid=int(key.rsplit(':',1)[1]);a=attr[oid]
        if (a['HANDLE'],a['ParcelId'])!=(handle,parcel):raise ValueError('Current/snapshot identity mismatch')
        if not(-91<lon<-89 and 38<lat<40):raise ValueError('City coordinate outside region')
        sale=choose_sale(a,mdb.get(parcel))
        if sale:chosen_sources[sale['sourceId']]+=1
        row=[parcel,oid,lon,lat,a['SITEADDR'] or address,'St. Louis City',None,finite(a['AsdTotal']),None,a['PropertyClassCode'],sale['date'] if sale else None,sale['raw'] if sale else None,sale['price'] if sale else None,sale['status'] if sale else 'not-available',sale['code'] if sale else None,None,None,False if sale else None,key,'st-louis-city:'+handle,sale['sourceId'] if sale else None]
        tile=f'{math.floor(lon/.02)}_{math.floor(lat/.02)}';grouped[tile].append(row);allrows.append(row)
    stage=RESEARCH/'region-staging'
    if stage.exists():shutil.rmtree(stage)
    stage.mkdir(parents=True);tiles=[]
    for key,rows in sorted(grouped.items()):
        rows.sort(key=lambda row:row[18]);bounds=[min(r[2] for r in rows),min(r[3] for r in rows),max(r[2] for r in rows),max(r[3] for r in rows)]
        summary=aggregate(rows)
        payload={'schema':'property-region-tile-v1','id':key,'regionId':'st-louis-city','jurisdiction':'st-louis-city','sourceId':SOURCE_ID,'fields':FIELDS,'count':len(rows),'rows':rows,**summary}
        raw=encode(payload);(stage/'tiles').mkdir(exist_ok=True);(stage/'tiles'/f'{key}.json').write_bytes(raw)
        tiles.append({'id':key,'url':f'/st-louis/regions/st-louis-city/tiles/{key}.json','bounds':bounds,'count':len(rows),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),**summary})
    download=read(RESEARCH/'sales-download.json');sales_schema=read(RESEARCH/'sales-schema.json')
    codebook={str(x['SaleType']):{'label':x['Descr'],'description':x['Explanation']} for t in sales_schema if t['table']=='CdSaleType' for x in t['codes']}
    sales_source={'id':MDB_SALES_ID,'name':'City of St. Louis Assessor parcel sales database — PrclSale table','url':download['url'],'catalogUrl':'https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=31','retrievedAt':download['retrievedAt'],'httpLastModified':download['lastModified'],'archiveEntryTimestamp':'2026-09-11T21:52:02','timestampTimezone':'unspecified ZIP timestamp','archiveSha256':download['sha256'],'member':'prclsale.mdb','memberSha256':hashlib.sha256((RESEARCH/'prclsale.mdb').read_bytes()).hexdigest(),'dateField':'PrclSale.SaleDate','priceField':'PrclSale.SalePrice (Access Currency divided by 10000)','join':'Exact AsrParcelId = ParcelId, only when current GIS ParcelId identifies one record','codeField':'PrclSale.SaleType','codebook':codebook,'limits':['Latest source sale date is 2024-11-28 despite a September 2026 file timestamp. Coverage has gaps and is not a complete transaction history.','Same-day conflicting prices and multi-parcel totals are withheld from per-parcel price metrics. HistPrclSale recording dates are not substituted for SaleDate.','Sale-type labels are source classifications, not independently verified arm’s-length transactions.'],**mdb_stats}
    gis_source={'id':GIS_SALES_ID,'name':'City public parcel GIS — residential sale fields','url':BASE,'queryUrl':BASE+'/query','retrievedAt':attributes['retrievedAt'],'dateField':'ResSaleDate','rawDateEncoding':'ArcGIS milliseconds since Unix epoch; date taken in UTC','priceField':'ResSalePrice','minObservedSaleDateISO':min(date_iso(a['ResSaleDate']) for a in attr.values() if a['ResSaleDate'] is not None),'maxObservedSaleDateISO':max(date_iso(a['ResSaleDate']) for a in attr.values() if a['ResSaleDate'] is not None),'limits':['Fields are explicitly named residential sale fields; they do not establish complete all-property transfer coverage.','No sale validity or instrument type codes are provided by these fields. Price is included only when its record has a sale date.']}
    sources={'geometry':snapshot['source'],'assessment':{'id':'st-louis-city-current-gis-assessment','name':'City public parcel GIS — assessed total','url':BASE,'queryUrl':BASE+'/query','retrievedAt':attributes['retrievedAt'],'field':'AsdTotal','assessmentYear':None,'taxYear':None,'sourceDataEditedAt':None,'limits':['Assessment effective year is not supplied. AsdTotal is assessed value, not tax billed, current asking price or independently appraised market value. No total appraised value is supplied.']},MDB_SALES_ID:sales_source,GIS_SALES_ID:gis_source}
    limits=['City points represent 134,347 source GIS records, including 11 duplicate ParcelId groups and shared parcel handles; aggregate values count GIS records, not deduplicated real estate holdings.','Coordinates are interior representative points of the September 8 geometry snapshot. Current IDs and parcel identities were verified unchanged September 12; boundary geometry was not downloaded again.','Assessed values were refreshed September 12, 2026; assessment year, tax year and total appraised value are unknown. Unknown values are null; source zeros remain zero.','Latest available sale is selected from the MDB and residential GIS fields by date; MDB wins equal dates. This does not establish the latest deed, current ownership, or complete market activity.','City sale coverage reaches February 28, 2025 in GIS and November 28, 2024 in PrclSale. Source retrieval/file dates are not transaction coverage dates.','Latest sale filters summarize one latest available sale per GIS record, not all historical transactions. Positive prices may be non-market transfers; source codes require interpretation.','Ambiguous ParcelId joins, conflicting latest-day prices and multi-parcel total prices are excluded from MDB price attribution. No owners, mailing addresses or personal contacts are included.','GIS boundaries and point locations are informational and are not a legal survey.']
    manifest={'schema':'property-region-v1','regionId':'st-louis-city','jurisdiction':'st-louis-city','name':'St. Louis City','source':{'id':SOURCE_ID,'name':'St. Louis City public parcel and sales records','url':BASE,'queryUrl':BASE+'/query','retrievedAt':attributes['retrievedAt'],'assessmentYear':None,'taxYear':None,'sourceDataEditedAt':None,'limitations':limits},'sources':sources,'generatedAt':stamp(),'fields':FIELDS,'gridDegrees':.02,'recordCount':len(allrows),'count':len(allrows),'distinctParcelIds':len(parcel_counts),'duplicateParcelIdGroups':sum(n>1 for n in parcel_counts.values()),'bounds':[min(r[2] for r in allrows),min(r[3] for r in allrows),max(r[2] for r in allrows),max(r[3] for r in allrows)],'tiles':tiles,'metricsUnit':'source GIS records; duplicate account records not deduplicated','latestSaleSourceCounts':dict(chosen_sources),'maxObservedLatestTransferDateISO':max(row[10] for row in allrows if row[10] is not None),'limitations':limits,'verification':{'currentSourceCount':len(attr),'currentSourceIdsStableDuringFetch':True,'currentIdsExactlyMatchGeometrySnapshot':True,'currentHandleAndParcelIdMatchGeometrySnapshot':True,'archiveCurrencyCrossCheckedAgainstSourcePerParcelPrices':True},**aggregate(allrows)}
    write(stage/'manifest.json',manifest)
    if sum(t['count'] for t in tiles)!=len(search) or len({r[18] for r in allrows})!=len(search):raise ValueError('Output coverage failure')
    for tile in tiles:
        raw=(stage/'tiles'/f"{tile['id']}.json").read_bytes()
        if hashlib.sha256(raw).hexdigest()!=tile['sha256'] or len(json.loads(raw)['rows'])!=tile['count']:raise ValueError('Output tile integrity failure')
    output=ROOT/'public/st-louis/regions/st-louis-city'
    if output.exists():shutil.rmtree(output)
    shutil.copytree(stage,output)
    write(RESEARCH/'build-summary.json',{'recordCount':manifest['recordCount'],'tileCount':len(tiles),'bytes':sum(t['bytes'] for t in tiles),'assessed':manifest['metrics']['assessedValueUSD'],'saleSourceCounts':dict(chosen_sources),'unknownSaleDateCount':manifest['unknownSaleDateCount'],'sales':mdb_stats})
    print(json.dumps(read(RESEARCH/'build-summary.json'),indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh-attributes',action='store_true');parser.add_argument('--parse-sales',action='store_true');args=parser.parse_args()
    if args.refresh_attributes:refresh_attributes()
    if args.parse_sales:parse_sales()
    build()
