#!/usr/bin/env python3
"""Extract the official City 2025-issued permit cohort; never claim County-wide permits.
uv run --no-project python scripts/st-louis/fetch_property_permits.py
--cached rebuilds only from a previously verified allowlisted research snapshot.
"""
import argparse,collections,concurrent.futures,datetime,hashlib,json,math,re,shutil,time,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];RESEARCH=ROOT.parent/'research/permits-2026'
URL='https://maps8.stlouis-mo.gov/arcgis/rest/services/SLDC/Building_Permits_2025/MapServer/8'
SOURCE_ID='st-louis-city-building-permits-2025'
FIELDS='AppType,AppNum,AddrAdjusted,AddrNum,AddrSuf,StDir,StName,StType,ProjectType,MainStrucType,AppDate,IssueDate,CompleteDate,CancelDate,CancelType,EstProjectCost,AppDescription,NbrOfUnits,NewUse,OldUse,HANDLE,LowerAsrParcelId'
def encode(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def query(params):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(URL+'/query?'+urllib.parse.urlencode({'f':'json',**params}),timeout=25) as response:result=json.load(response)
            if 'error'in result:raise ValueError(result['error'])
            return result
        except Exception:
            if attempt==2:raise
            time.sleep(attempt+1)
def fetch_source():
    def count():return query({'where':'1=1','returnCountOnly':'true'})['count']
    n=count()
    if not isinstance(n,int) or not 0<n<25000:raise ValueError('Permit source size outside extraction bound')
    def page(offset):
        result=query({'where':'1=1','outFields':FIELDS,'returnGeometry':'true','outSR':'4326','orderByFields':'AppNum ASC,AppType ASC','resultOffset':offset,'resultRecordCount':1000})
        return result['features']
    def read_all():
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:return [feature for batch in executor.map(page,range(0,n,1000)) for feature in batch]
    first=read_all();second=read_all();end=count()
    # The source misdeclares the 0/1 AddrAdjusted field as OID. Validate the complete
    # allowlisted row multiset twice instead of silently dropping duplicate source OIDs.
    if len(first)!=n or len(second)!=n or end!=n or collections.Counter(map(encode,first))!=collections.Counter(map(encode,second)):raise ValueError('Permit source changed or pagination omitted rows')
    result={'source':URL,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'recordCount':n,'fields':FIELDS.split(','),'features':first,'verifiedIdenticalRepeatedRead':True,'sourceRowMultisetSha256':hashlib.sha256(b'\n'.join(sorted(map(encode,first)))).hexdigest()}
    RESEARCH.mkdir(parents=True,exist_ok=True);(RESEARCH/'city-2025-verified.json').write_bytes(encode(result));return result
def text(value):return re.sub(r'\s+',' ',str(value)).strip() if value is not None else None
def number(value):return value if isinstance(value,(int,float))and not isinstance(value,bool)and math.isfinite(value)and value>=0 else None
def date(raw):
    if not isinstance(raw,(int,float))or not math.isfinite(raw):return None
    try:return datetime.datetime.fromtimestamp(raw/1000,datetime.timezone.utc).date().isoformat()
    except (ValueError,OverflowError,OSError):return None
def normalize(feature,retrieved_at):
    a=feature['attributes'];g=feature.get('geometry')or{};lon=g.get('x');lat=g.get('y')
    if not isinstance(lon,(int,float))or not isinstance(lat,(int,float))or not(-91<lon<-89 and 38<lat<40):raise ValueError('Permit point has unusable source coordinates')
    app_type=text(a['AppType']);app_num=a['AppNum']
    if not re.fullmatch('[A-Z]{1,3}',app_type or'')or not isinstance(app_num,int)or app_num<=0:raise ValueError('Missing permit application identity')
    raw={k:a.get(k)for k in ['AppDate','IssueDate','CompleteDate','CancelDate']};parsed={k:date(v)for k,v in raw.items()};quality=[];today=retrieved_at[:10]
    for key,value in list(parsed.items()):
        if raw[key]is not None and value is None:quality.append(key+':unparseable')
        if value and(value>today or value<'1900-01-01'):quality.append(key+':outside-observed-date-range');parsed[key]=None
    for key in ['CompleteDate','CancelDate']:
        if parsed[key] and parsed['AppDate'] and parsed[key]<parsed['AppDate']:quality.append(key+':before-application');parsed[key]=None
    # A supplied date is an observation, not confirmation of current workflow status.
    status=next((label for field,label in [('CancelDate','cancellation-date-recorded'),('CompleteDate','completion-date-recorded'),('IssueDate','issue-date-recorded'),('AppDate','application-date-recorded')]if parsed[field]),'unknown')
    description=text(a.get('AppDescription'))
    if description:
        description=re.sub(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[contact omitted]',description,flags=re.I)
        description=re.sub(r'\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b','[contact omitted]',description)
    address=' '.join(str(v)for v in [a.get('AddrNum'),a.get('AddrSuf'),a.get('StDir'),a.get('StName'),a.get('StType')]if v is not None and str(v).strip())
    return {'id':f'{SOURCE_ID}:{app_type}:{app_num}','sourceId':SOURCE_ID,'jurisdiction':'st-louis-city','sourceObjectId':a.get('AddrAdjusted'),'applicationNumber':str(app_num),'applicationTypeCode':app_type,'longitude':lon,'latitude':lat,'address':text(address),'projectTypeCode':text(a.get('ProjectType')),'structureTypeCode':text(a.get('MainStrucType')),'description':description,'estimatedCostUSD':number(a.get('EstProjectCost')),'unitCount':number(a.get('NbrOfUnits')),'newUse':text(a.get('NewUse')),'oldUse':text(a.get('OldUse')),'applicationDate':parsed['AppDate'],'issuedDate':parsed['IssueDate'],'completedDate':parsed['CompleteDate'],'cancelledDate':parsed['CancelDate'],'status':status,'statusBasis':'Derived from source date presence; not a live permit workflow status.','rawDates':raw,'dateQuality':quality,'cancellationTypeCode':text(a.get('CancelType')),'parcelHandle':text(a.get('HANDLE')),'parcelIdRaw':text(a.get('LowerAsrParcelId')),'parcelJoinStatus':'not-established'}
def build(snapshot):
    if not snapshot.get('verifiedIdenticalRepeatedRead'):raise ValueError('Only a twice-verified snapshot can be published')
    by_id={};multiplicity=collections.Counter()
    for feature in snapshot['features']:
        record=normalize(feature,snapshot['retrievedAt']);identifier=record['id'];multiplicity[identifier]+=1
        if identifier in by_id and encode(record)!=encode(by_id[identifier]):raise ValueError('Conflicting records for one application identity; review before publication')
        by_id[identifier]=record
    records=sorted(by_id.values(),key=lambda x:(x['issuedDate']or'',x['id']),reverse=True)
    for record in records:record['sourceRowMultiplicity']=multiplicity[record['id']]
    def extent(field):
        dates=[r[field]for r in records if r[field]];return {'min':min(dates)if dates else None,'max':max(dates)if dates else None,'count':len(dates)}
    observed={k:extent(k)for k in ['applicationDate','issuedDate','completedDate','cancelledDate']}
    if observed['issuedDate']['min']<'2025-01-01'or observed['issuedDate']['max']>'2025-12-31':raise ValueError('Published layer no longer matches its declared 2025-issued cohort')
    limitations=['This layer is the City 2025-issued permit cohort. It is not all years, all permit disciplines, all currently active projects, or County-wide permits.','All records have an issue date in 2025; some applications began earlier and completion/cancellation dates extend into 2026. Retrieval date does not imply current permit coverage.','The source declares a nonunique 0/1 field as its object ID. Application type plus application number identifies output records; identical source duplicates are collapsed and their multiplicity retained.','Status labels describe supplied dates and do not verify live workflow status, whether work began, or whether construction is ongoing. Invalid future/pre-application completion dates remain raw evidence and are excluded from derived status.','Project and application type codes are preserved without unverified definitions. Descriptions are source text; estimated project cost is not actual spending or property market value.','Source parcel handles are nonunique in the City cadastral data. No automatic exact-parcel join is asserted. Points are source locations, not building footprints or survey boundaries.','Owner, occupant, contractor and private contact fields are excluded. The connected source does not establish County or municipal permit completeness.']
    coverage={'jurisdiction':'st-louis-city','scope':'2025-issued permit cohort','issueYear':2025,'completeForPublishedLayer':True,'completeForJurisdiction':False,'observedDates':observed,'countyPermitsConnected':False}
    source={'id':SOURCE_ID,'name':'City of St. Louis — Building Permits 2025','url':URL,'queryUrl':URL+'/query','catalogUrl':'https://maps8.stlouis-mo.gov/arcgis/rest/services/SLDC/Building_Permits_2025/MapServer','retrievedAt':snapshot['retrievedAt'],'sourceDataEditedAt':None,'sourceObjectIdField':'AddrAdjusted','sourceObjectIdUnique':False,'applicationIdentityFields':['AppType','AppNum'],'sourceRowCount':snapshot['recordCount'],'sourceRowMultisetSha256':snapshot['sourceRowMultisetSha256'],'coordinateMethod':'Official GIS point geometry requested in EPSG:4326','recordedDatesTimezone':'ArcGIS epoch milliseconds; calendar dates interpreted in UTC','limitations':limitations}
    payload={'schema':'property-permit-points-v1','sourceId':SOURCE_ID,'jurisdiction':'st-louis-city','source':source,'retrievedAt':snapshot['retrievedAt'],'coverage':coverage,'recordCount':len(records),'records':records}
    raw=encode(payload);bounds=[min(r['longitude']for r in records),min(r['latitude']for r in records),max(r['longitude']for r in records),max(r['latitude']for r in records)]
    dataset={'id':SOURCE_ID,'sourceId':SOURCE_ID,'jurisdiction':'st-louis-city','url':'/st-louis/permits/city-2025.json','recordCount':len(records),'sourceRowCount':snapshot['recordCount'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'bounds':bounds,'coverage':coverage}
    manifest={'schema':'property-permits-manifest-v1','retrievedAt':snapshot['retrievedAt'],'datasets':[dataset],'sources':[source],'recordCount':len(records),'sourceRowCount':snapshot['recordCount'],'duplicateSourceRowsCollapsed':snapshot['recordCount']-len(records),'dateQualityFlagCount':sum(bool(r['dateQuality'])for r in records),'statusCounts':dict(collections.Counter(r['status']for r in records)),'coverage':{'st-louis-city':coverage,'st-louis-county':{'status':'not-connected','completeForJurisdiction':False,'reason':'An individual County building-permit public feed has not been verified. County code services cover unincorporated areas and contracted municipal services; municipal coverage varies.'}},'limitations':limitations}
    stage=RESEARCH/'public-staging';stage.mkdir(parents=True,exist_ok=True);(stage/'city-2025.json').write_bytes(raw);(stage/'manifest.json').write_bytes(encode(manifest))
    if len({r['id']for r in records})!=len(records)or sum(r['sourceRowMultiplicity']for r in records)!=snapshot['recordCount']:raise ValueError('Permit identity/count validation failed')
    output=ROOT/'public/st-louis/permits';output.mkdir(parents=True,exist_ok=True)
    for name in ['city-2025.json','manifest.json']:shutil.copy2(stage/name,output/name)
    print(json.dumps({k:manifest[k]for k in ['recordCount','sourceRowCount','duplicateSourceRowsCollapsed','dateQualityFlagCount','statusCounts']}|{'bytes':len(raw),'observedDates':observed},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cached',action='store_true');args=p.parse_args()
    build(json.loads((RESEARCH/'city-2025-verified.json').read_text())if args.cached else fetch_source())
