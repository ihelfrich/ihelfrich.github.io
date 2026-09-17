#!/usr/bin/env python3
"""Build source-grounded City TIF and tax-abatement layers, retaining prior public data on failure.
uv run --no-project --with shapely python scripts/st-louis/fetch_property_incentives.py
--cached uses verified allowlisted acquisition snapshots, preserving their observation dates.
Raw downloaded owner/contact fields are discarded before any cache/publication write.
"""
import argparse,collections,datetime,hashlib,json,math,os,re,sys,urllib.request
from pathlib import Path
from shapely.geometry import shape
from shapely import make_valid
ROOT=Path(__file__).resolve().parents[2];RESEARCH=ROOT.parent/'research/incentives-2026';OUT=ROOT/'public/st-louis/incentives'
SPECS={
 'tif-districts':{'cache':'tif','id':'st-louis-city-tif-districts','label':'City TIF districts','url':'https://static.stlouis-mo.gov/open-data/SLDC/INCENTIVES/TIF/STLTIFs.geojson','catalogUrl':'https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=56','bound':2000,'fields':['OBJECTID','Case_Number','Project_Name','TIF_Location','Incentive_Status','GUID','MODOR_ID','MODOR_PG','TIF_ID','TIF_Percent','Construction_Status','Dwelling_Units','Hotel_Rooms','Commercial_SQFT','Projected_Jobs','Estimated_Jobs','Project_Type','Payoff_Date','Date_Approved','Date_Completed','Ordinance','Project_Amount']},
 'tax-abatements':{'cache':'abatements','id':'st-louis-city-tax-abatements','label':'City tax-abated parcels','url':'https://static.stlouis-mo.gov/open-data/SLDC/TAX-ABATEMENT/taxabatedparcels.geojson','catalogUrl':'https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=61','bound':10000,'fields':['OBJECTID','LowerAsrParcelId','ColParcelId','HANDLE','ParcelId','SITEADDR','IsAbatedProperty','AbatementStartYear','AbatementEndYear','CityBlock','Parcel','RedevPhase','RedevYearEnd','TIFDist']}}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def encode(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
def text(v):return re.sub(r'\s+',' ',str(v)).strip() if v is not None else None
def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_name(path.name+'.tmp');temp.write_bytes(encode(value));os.replace(temp,path)
def finite(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def year(v):return v if isinstance(v,int) and not isinstance(v,bool) and 1900<=v<=2200 else None
def date(raw,observed,allow_future=False):
 if not finite(raw):return None
 try:iso=datetime.datetime.fromtimestamp(raw/1000,datetime.timezone.utc).date().isoformat()
 except (ValueError,OverflowError,OSError):return None
 return iso if iso>='1900-01-01' and (allow_future or iso<=observed[:10]) else None

def fetch_source(spec,cached):
 file=RESEARCH/(spec['cache']+'-verified-source.json')
 if cached:
  d=json.loads(file.read_text())
  if d['sourceUrl']!=spec['url'] or d['fields']!=spec['fields']:raise ValueError('Cached source identity/allowlist mismatch')
  return d
 with urllib.request.urlopen(spec['url'],timeout=30) as r:
  raw=r.read(10000001);headers=dict(r.headers)
 if len(raw)>10000000:raise ValueError('Incentive response exceeded10MB acquisition bound')
 d=json.loads(raw)
 if d.get('type')!='FeatureCollection' or not 0<len(d.get('features',[]))<=spec['bound']:raise ValueError('Unexpected incentive feature collection')
 features=[]
 for f in d['features']:
  a=f['properties']
  if any(field not in a for field in spec['fields']):raise ValueError('Source field missing; refuse a schema-changing refresh')
  features.append({'type':'Feature','properties':{k:a[k] for k in spec['fields']},'geometry':f.get('geometry')})
 snapshot={'sourceUrl':spec['url'],'retrievedAt':now(),'sourceSha256':sha(raw),'sourceBytes':len(raw),'lastModifiedHeader':headers.get('Last-Modified'),'etag':headers.get('ETag'),'fields':spec['fields'],'crs':d.get('crs'),'features':features}
 # Archive only allowlisted data. Hash of the original HTTP body is a receipt, not a hidden PII cache.
 archive=RESEARCH/'versions'/(snapshot['sourceSha256']+'-allowlisted.json')
 if not archive.exists():write(archive,snapshot)
 write(file,snapshot);return snapshot

def parcel_lookup():
 path=ROOT/'public/st-louis/regions/st-louis-city/manifest.json'
 if not path.exists():return {},None
 m=json.loads(path.read_text());lookup=collections.defaultdict(list)
 for tile in m['tiles']:
  d=json.loads((path.parent/'tiles'/f"{tile['id']}.json").read_text());f={k:i for i,k in enumerate(d['fields'])}
  for r in d['rows']:
   handle=(r[f['parcelKey']] or '').removeprefix('st-louis-city:');parcel=r[f['parcelId']]
   if handle and parcel:lookup[(str(parcel),handle)].append({'recordKey':r[f['recordKey']],'parcelKey':r[f['parcelKey']],'parcelId':str(parcel)})
 return lookup,{'id':m['source']['id'],'url':m['source']['url'],'retrievedAt':m['source']['retrievedAt']}

def normalize(layer,feature,snapshot,lookup):
 spec=SPECS[layer];a=feature['properties'];oid=a['OBJECTID']
 if not isinstance(oid,int) or oid<1:raise ValueError('Invalid incentive source OBJECTID')
 raw_geometry=feature.get('geometry');bounds=None;longitude=None;latitude=None;quality=[]
 if raw_geometry:
  if raw_geometry.get('type') not in ('Polygon','MultiPolygon'):raise ValueError('Incentive geometry is not a source polygon')
  geometry=shape(raw_geometry)
  if geometry.is_empty:quality.append('empty-source-geometry')
  else:
   if not geometry.is_valid:quality.append('invalid-source-polygon; repaired only for representative-point placement');geometry=make_valid(geometry)
   bounds=list(geometry.bounds)
   if len(bounds)!=4 or not all(finite(v) for v in bounds) or not(-91<bounds[0]<=bounds[2]<-89 and 38<bounds[1]<=bounds[3]<40):raise ValueError('Incentive geometry outside declared City extent')
   point=geometry.representative_point();longitude,latitude=point.x,point.y
 else:quality.append('missing-source-geometry')
 record={'id':f"{spec['id']}:{oid}",'sourceId':spec['id'],'layerId':layer,'jurisdiction':'st-louis-city','sourceObjectId':oid,'sourceURL':spec['url'],'sourceUrl':spec['url'],'sourceObservedAt':snapshot['retrievedAt'],'recordKey':None,'parcelKey':None,'parcelId':None,'parcelJoinStatus':'not-established','longitude':longitude,'latitude':latitude,'bounds':bounds,'geometry':raw_geometry,'geometryRole':'source-polygon','pointRole':'representative-point-of-source-polygon','geometryQuality':quality,'amountUSD':None}
 if layer=='tif-districts':
  raw_dates={k:a[k]for k in ['Date_Approved','Date_Completed','Payoff_Date']};parsed={k:date(v,snapshot['retrievedAt'],k=='Payoff_Date')for k,v in raw_dates.items()}
  date_quality=[k+':invalid-or-future-event-date'for k,v in raw_dates.items()if v is not None and parsed[k]is None]
  if parsed['Date_Approved']and parsed['Date_Completed']and parsed['Date_Completed']<parsed['Date_Approved']:date_quality.append('Date_Completed:before-recorded-approval');parsed['Date_Completed']=None
  amount=a['Project_Amount']
  record.update(title=text(a['Project_Name'])or f'TIF source feature {oid}',address=text(a['TIF_Location']),caseNumberRaw=a['Case_Number'],ordinanceRaw=a['Ordinance'],tifIdRaw=a['TIF_ID'],stateRecordIdRaw=a['MODOR_ID'],sourceGuidRaw=a['GUID'],sourceStatusCode=a['Incentive_Status'],sourceConstructionStatus=a['Construction_Status'],projectTypeRaw=a['Project_Type'],approvalDate=parsed['Date_Approved'],completionDate=parsed['Date_Completed'],payoffDateRecorded=parsed['Payoff_Date'],rawDates=raw_dates,dateQuality=date_quality,documentDate=parsed['Date_Approved'],dateBasis='recorded-approval-date',datePrecision='day',status='approval-date-recorded' if parsed['Date_Approved']else'source-record; approval-date-not-supplied',statusBasis='Status code has no verified legend; recorded dates and construction label do not establish current authorization or completion.',amountUSD=amount if finite(amount)and amount>=0 else None,amountMeaning='Source Project_Amount; not tax receipts, expenditure or current market value.',sourceMetrics={k:a[k]for k in ['TIF_Percent','Dwelling_Units','Hotel_Rooms','Commercial_SQFT','Projected_Jobs','Estimated_Jobs']})
  if str(a['Case_Number']).strip().lower() in ('test','none','null',''):record['caseNumberQuality']='placeholder-or-missing; no case join'
 else:
  start,end=year(a['AbatementStartYear']),year(a['AbatementEndYear']);q=[]
  if start is None:q.append('start-year-invalid-or-missing')
  if end is None:q.append('end-year-invalid-or-missing')
  if start and end and start>end:q.append('reversed-source-period');start=end=None
  pair=(str(a['ParcelId']).strip(),str(a['HANDLE']).strip());matches=lookup.get(pair,[])
  if len(matches)==1:record.update(matches[0],parcelJoinStatus='exact-identifiers-unique-in-current-snapshot')
  elif matches:record['parcelJoinStatus']='ambiguous-current-identifiers'
  record.update(title=f"Tax-abatement record · {text(a['SITEADDR'])or oid}",address=text(a['SITEADDR']),parcelIdRaw=a['ParcelId'],parcelHandleRaw=a['HANDLE'],lowerAssessorParcelIdRaw=a['LowerAsrParcelId'],collectorParcelIdRaw=a['ColParcelId'],sourceAbatementFlag=a['IsAbatedProperty'],abatementStartYear=start,abatementEndYear=end,rawYears={'AbatementStartYear':a['AbatementStartYear'],'AbatementEndYear':a['AbatementEndYear']},dateQuality=q,documentDate=None,dateBasis='recorded-abatement-year-interval',datePrecision='year',status='abatement-period-recorded'if start and end else'source-record; period-not-usable',statusBasis='Recorded year interval in the published file; not a verification of present eligibility, continued entitlement or amount saved.')
 return record

def build(snapshots):
 lookup,identity_source=parcel_lookup();datasets=[];sources=[];all_records=[];stage={}
 for layer,snapshot in snapshots.items():
  spec=SPECS[layer];records=[normalize(layer,f,snapshot,lookup)for f in snapshot['features']]
  if len({r['id']for r in records})!=len(records):raise ValueError('Duplicate incentive source identity')
  dates=[r['approvalDate']for r in records if r.get('approvalDate')];starts=[r['abatementStartYear']for r in records if r.get('abatementStartYear')];ends=[r['abatementEndYear']for r in records if r.get('abatementEndYear')]
  coverage={'sourceFeatureCount':len(records),'mappedPointCount':sum(r['longitude']is not None for r in records),'uniqueSourceObjectIds':len(records),'approvalDates':{'count':len(dates),'min':min(dates)if dates else None,'max':max(dates)if dates else None},'recordedYears':{'min':min(starts)if starts else None,'max':max(ends)if ends else None},'exactParcelIdentityJoins':sum(r['recordKey']is not None for r in records),'amountSuppliedCount':sum(r['amountUSD']is not None for r in records),'completeForPublishedFile':True,'confirmedCurrentYearCoverage':False}
  source={'id':spec['id'],'name':spec['label'],'url':spec['url'],'catalogUrl':spec['catalogUrl'],'retrievedAt':snapshot['retrievedAt'],'sourceSha256':snapshot['sourceSha256'],'sourceBytes':snapshot['sourceBytes'],'httpLastModified':snapshot['lastModifiedHeader'],'httpEtag':snapshot.get('etag'),'sourceDataEditedAt':None,'httpDateMeaning':'HTTP Last-Modified describes the distributed file, not current project activity or record validity.','fields':spec['fields'],'coordinateMeaning':'Original source polygon; representative point computed only for display, with exact source geometry retained.','parcelIdentitySource':identity_source if layer=='tax-abatements'else None}
  limitations=['The file is not verified as a complete current-year incentive inventory. Retrieval does not update the vintage of its records.','Source status codes lack a verified legend and are not converted to current active/approved states.','Tax-abatement years describe the recorded period only; no exact start/end days or current tax savings are invented.','TIF project amounts, when supplied, are not tax receipts or actual public spending. Missing amounts remain missing.','Only a unique exact ParcelId plus HANDLE match may link an abatement to the current parcel snapshot. No case, parent-company or proximity joins are inferred.','Owner, mailing, contact, tax-balance and sale-price fields are not published.']
  payload={'schema':'property-incentive-records-v1','layerId':layer,'source':source,'coverage':coverage,'limitations':limitations,'records':records}
  raw=encode(payload)
  if len(raw)>16000000:raise ValueError('Incentive file exceeds16MB client bound')
  filename=layer+'.json';stage[filename]=payload;datasets.append({'id':layer,'url':'/st-louis/incentives/'+filename,'bytes':len(raw),'sha256':sha(raw),'recordCount':len(records),'coverage':coverage});sources.append(source);all_records.extend(records)
 manifest={'schema':'property-incentives-manifest-v1','retrievedAt':max(s['retrievedAt']for s in sources),'datasets':datasets,'sources':sources,'recordCount':len(all_records),'complete':True,'confirmedCurrentYearCoverage':False}
 history={'schema':'property-observation-input-v1','complete':True,'source':{'id':'st-louis-city-incentives-observed','label':'Published City TIF and tax-abatement files','url':'https://www.stlouis-mo.gov/data/','retrievedAt':manifest['retrievedAt']},'recordCount':len(all_records),'records':[{k:r.get(k)for k in ['id','title','sourceURL','jurisdiction','sourceObjectId','recordKey','parcelKey','parcelId','longitude','latitude','address','status','documentDate','amountUSD']}|{'sourceUpdatedAt':None,'recordKey':None,'parcelKey':None,'parcelId':None}for r in all_records]}
 for name,data in stage.items():write(OUT/name,data)
 write(OUT/'history-input.json',history);write(OUT/'manifest.json',manifest)
 write(OUT/'status.json',{'schema':'property-source-status-v1','state':'ready','attemptedAt':now(),'lastSuccessfulRetrievalAt':manifest['retrievedAt'],'recordCount':len(all_records),'retainedPreviousData':False})
 print(json.dumps({'records':manifest['recordCount'],'datasets':datasets},indent=2))

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cached',action='store_true');args=p.parse_args()
 try:
  RESEARCH.mkdir(parents=True,exist_ok=True);snapshots={layer:fetch_source(spec,args.cached)for layer,spec in SPECS.items()};build(snapshots)
 except Exception as e:
  old=json.loads((OUT/'manifest.json').read_text())if(OUT/'manifest.json').exists()else{}
  write(OUT/'status.json',{'schema':'property-source-status-v1','state':'failed','attemptedAt':now(),'lastSuccessfulRetrievalAt':old.get('retrievedAt'),'retainedPreviousData':bool(old),'error':str(e)[:400]});raise
if __name__=='__main__':main()
