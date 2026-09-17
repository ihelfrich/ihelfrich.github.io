#!/usr/bin/env python3
"""Collect bounded public City infrastructure snapshots, retaining prior good data.

uv run --no-project python scripts/st-louis/fetch_property_infrastructure.py
--cached rebuilds exact prior observations without advancing their retrieval time.
Only public read-only GIS sources. No water-network endpoints or parcel joins.
"""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import html.parser
import json
import math
import shutil
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESEARCH = ROOT.parent / 'research/property-infrastructure-sources-2026-09-13'
OUTPUT = ROOT / 'public/st-louis/infrastructure'
BASE = 'https://maps8.stlouis-mo.gov/arcgis/rest/services/'
GRID = .01
TERMS = 'https://dynamic.stlouis-mo.gov/opendata/terms.cfm'
SOURCES = [
 {'id':'city-streetlights','sourceId':'stl-city-public-streetlights','url':BASE+'STREETS/Streets_Permitting/MapServer',
  'catalogUrl':'https://www.stlouis-mo.gov/government/departments/street/street-lighting/',
  'layers':[2], 'fields':['OBJECTID','LightID','Lighting_Type','Light_Type','Light_Source','LED_Powered','Date_Installed','Verification_Date'],
  'coverage':'Public street-light inventory in the City of St. Louis; not County coverage or a verified operating-condition survey.',
  'meaning':'Source inventory locations of street lights. No electrical wiring or underground conduit geometry is supplied.',
  'maximum':100000},
 {'id':'city-capital-projects','sourceId':'stl-city-capital-improvement-projects','url':BASE+'Capital_Improvement_Projects/MapServer',
  'catalogUrl':'https://www.stlouis-mo.gov/government/departments/public-service/projects/',
  'layers':[0,1,2,3,4], 'fields':['OBJECTID','NAME','Location','Web','Ward','Type'],
  'layerFields':{0:['OBJECTID','Name','Status','Location','Type','Wards','Page'],1:['OBJECTID','Name_Locations','Location','Type','Wards','Page'],2:['OBJECTID','Name','Location','Type','Ward','Page']},
  'coverage':'Selected projects profiled by the City Board of Public Service Design Division; not all construction, permits, or County projects.',
  'meaning':'Published project locations and corridor geometry. Inclusion does not establish approval, active construction, completion, or a construction date.',
  'maximum':10000}
]


def encode(value):
 return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()


def stamp():
 return dt.datetime.now(dt.timezone.utc).isoformat()


def request(url,params=None):
 values={'f':'json',**(params or {})};encoded=urllib.parse.urlencode(values)
 # All requests are read-only GET queries; 400 IDs fit within the service URL limit.
 req=urllib.request.Request(url+'?'+encoded,headers={'Origin':'https://ihelfrich.github.io'})
 for attempt in range(2):
  try:
   with urllib.request.urlopen(req,timeout=25) as response:
    raw=response.read(8_000_001)
   if len(raw)>8_000_000:raise ValueError('Source response exceeds 8 MB budget')
   data=json.loads(raw)
   if data.get('error'):raise ValueError('Public source error: '+str(data['error'].get('code')))
   return data
  except Exception:
   if attempt==1:raise
   time.sleep(1)


def ids(url,maximum):
 result=request(url+'/query',{'where':'1=1','returnIdsOnly':'true'})
 found=result.get('objectIds')
 if result.get('objectIdFieldName')!='OBJECTID' or not isinstance(found,list) or len(found)>maximum or any(type(x)is not int or x<1 for x in found) or len(set(found))!=len(found):raise ValueError('Invalid source object identities')
 count=request(url+'/query',{'where':'1=1','returnCountOnly':'true'}).get('count')
 if count!=len(found):raise ValueError('Source count and object identities disagree')
 return sorted(found)


def coordinates(geometry):
 if geometry is None:return []
 kind=geometry.get('type');value=geometry.get('coordinates')
 if kind=='Point':return [value]
 if kind=='LineString':return value
 if kind in ('MultiLineString','Polygon'):return [p for line in value for p in line]
 if kind=='MultiPolygon':return [p for polygon in value for line in polygon for p in line]
 raise ValueError('Unsupported source geometry type')


def geometry(raw):
 if raw is None:return None
 if 'x' in raw and 'y' in raw:result={'type':'Point','coordinates':[raw['x'],raw['y']]}
 elif 'paths' in raw:
  paths=[[[p[0],p[1]] for p in line] for line in raw['paths']]
  if not paths or any(len(line)<2 for line in paths):raise ValueError('Invalid source line geometry')
  result={'type':'LineString','coordinates':paths[0]} if len(paths)==1 else {'type':'MultiLineString','coordinates':paths}
 else:raise ValueError('Unexpected geometry; source schema requires review')
 pts=coordinates(result)
 if not pts or any(not isinstance(p,list) or len(p)!=2 or any(type(n) not in (int,float) or not math.isfinite(n) for n in p) or not -180<=p[0]<=180 or not -90<=p[1]<=90 for p in pts):raise ValueError('Invalid geographic coordinates')
 return result


class LinkParser(html.parser.HTMLParser):
 def __init__(self):super().__init__();self.urls=[]
 def handle_starttag(self,tag,attrs):
  if tag.lower()=='a':self.urls.extend(v for k,v in attrs if k.lower()=='href' and v)


def official_link(raw,fallback):
 if not isinstance(raw,str):return fallback
 parser=LinkParser();parser.feed(raw)
 for candidate in [raw,*parser.urls]:
  try:
   u=urllib.parse.urlparse(candidate)
   if u.scheme=='https' and u.hostname in ('www.stlouis-mo.gov','stlouis-mo.gov') and not u.username and not u.password and u.port in (None,443):return candidate
  except ValueError:continue
 return fallback


def scalar(value):
 if value is None:return None
 if type(value) not in (str,int,float) or isinstance(value,float) and not math.isfinite(value):raise ValueError('Unexpected non-scalar source attribute')
 if isinstance(value,str):return value.strip()[:500] or None
 return value


def transform(feature,source,layer):
 a=feature.get('attributes',{});oid=a.get('OBJECTID')
 if type(oid)is not int or oid<1:raise ValueError('Invalid source identity')
 shape=geometry(feature.get('geometry'))
 project=source['id']=='city-capital-projects'
 attrs={key:scalar(a.get(key)) for key in source.get('layerFields',{}).get(layer,source['fields']) if key not in ('OBJECTID','Web','Page')}
 identity=f"{source['sourceId']}:{layer}:{oid}"
 return {'type':'Feature','id':identity,'geometry':shape,'properties':{'id':identity,'sourceObjectId':oid,'sourceLayerId':layer,
  'title':str(attrs.get('NAME') or attrs.get('Name') or attrs.get('Name_Locations') or f"Capital project {layer}:{oid}") if project else f"Street light {attrs.get('LightID') or oid}",
  'address':attrs.get('Location') if project else None,'sourceURL':official_link(a.get('Web') or a.get('Page'),source['url']+f'/{layer}'),
  'attributes':attrs}}


def fetch_source(source):
 layers=[]
 for layer in source['layers']:
  url=source['url']+f'/{layer}';before=request(url)
  fields=source.get('layerFields',{}).get(layer,source['fields'])
  names={f['name'] for f in before.get('fields',[])}
  if not set(fields).issubset(names):raise ValueError('Expected public field schema changed: '+url)
  oidset=ids(url,source['maximum']);chunks=[oidset[i:i+400] for i in range(0,len(oidset),400)]
  def batch(chunk):
   raw=request(url+'/query',{'objectIds':','.join(map(str,chunk)),'outFields':','.join(fields),'returnGeometry':'true','outSR':4326})
   rows=raw.get('features',[]);returned=[r.get('attributes',{}).get('OBJECTID') for r in rows]
   if raw.get('exceededTransferLimit') or sorted(returned)!=chunk:raise ValueError('Incomplete or mismatched object-ID batch')
   return [transform(r,source,layer) for r in rows]
  features=[]
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
   for start in range(0,len(chunks),2):
    for values in ex.map(batch,chunks[start:start+2]):features.extend(values)
  after=request(url)
  if ids(url,source['maximum'])!=oidset or before.get('editingInfo')!=after.get('editingInfo'):raise ValueError('Source changed during collection')
  layers.append({'id':layer,'name':before.get('name'),'geometryType':before.get('geometryType'),'sourceDataEditedAt':None,
   'fields':[{k:f.get(k) for k in ('name','type','alias')} for f in before.get('fields',[]) if f['name'] in fields],
   'objectIdsSha256':hashlib.sha256(encode(oidset)).hexdigest(),'count':len(features),'features':features})
  print(json.dumps({'source':source['id'],'layer':layer,'count':len(features)}),flush=True)
 return {'sourceId':source['sourceId'],'retrievedAt':stamp(),'layers':layers,'exactObjectIdsVerified':True,'sourceObjectIdsRechecked':True,'sourceEditingEpochAvailable':False}


def bounds_of(features):
 pts=[p for f in features for p in coordinates(f['geometry'])]
 return [min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)] if pts else None


def clean_cached_feature(feature,source,layer):
 p=feature.get('properties',{});oid=p.get('sourceObjectId');identity=f"{source['sourceId']}:{layer}:{oid}"
 if type(oid)is not int or oid<1 or p.get('sourceLayerId')!=layer or feature.get('type')!='Feature' or feature.get('id')!=identity or p.get('id')!=identity:raise ValueError('Cached source identity cannot be verified')
 g=feature.get('geometry')
 if g is not None:
  if g.get('type')=='Point':g=geometry({'x':g['coordinates'][0],'y':g['coordinates'][1]})
  elif g.get('type') in ('LineString','MultiLineString'):g=geometry({'paths':[g['coordinates']] if g['type']=='LineString' else g['coordinates']})
  else:raise ValueError('Unverified cached geometry')
 allowed=set(source.get('layerFields',{}).get(layer,source['fields']))-{'OBJECTID','Web','Page'}
 attrs=p.get('attributes')
 if not isinstance(attrs,dict) or set(attrs)-allowed:raise ValueError('Unapproved cached source attributes')
 attrs={key:scalar(value) for key,value in attrs.items()}
 url=p.get('sourceURL');fallback=source['url']+f'/{layer}'
 if url!=fallback and official_link(url,None)!=url:raise ValueError('Invalid cached source URL')
 if not isinstance(p.get('title'),str) or not p['title'] or len(p['title'])>600:raise ValueError('Invalid cached title')
 return {'type':'Feature','id':identity,'geometry':g,'properties':{'id':identity,'sourceObjectId':oid,'sourceLayerId':layer,'title':p['title'],'address':scalar(p.get('address')),'sourceURL':url,'attributes':attrs}}


def build(snapshots,directory):
 directory.mkdir(parents=True,exist_ok=True);entries=[]
 for source,snapshot in zip(SOURCES,snapshots):
  if snapshot['sourceId']!=source['sourceId'] or not snapshot.get('exactObjectIdsVerified') or not (snapshot.get('sourceObjectIdsRechecked') or snapshot.get('sourceEpochUnchanged')):raise ValueError('Unverified cached snapshot')
  if [layer['id'] for layer in snapshot['layers']]!=source['layers']:raise ValueError('Cached source layer set changed')
  features=[clean_cached_feature(f,source,layer['id']) for layer in snapshot['layers'] for f in layer['features']]
  if len(features)!=sum(layer['count'] for layer in snapshot['layers']):raise ValueError('Cached source count changed')
  if len({f['id'] for f in features})!=len(features):raise ValueError('Duplicate cross-layer source identity')
  mapped=[f for f in features if f['geometry'] is not None];groups={}
  for f in mapped:
   key='projects' if source['id']=='city-capital-projects' else '_'.join(str(math.floor(v/GRID)) for v in f['geometry']['coordinates'])
   groups.setdefault(key,[]).append(f)
  tiles=[]
  for key,values in sorted(groups.items()):
   values.sort(key=lambda f:f['id']);payload={'type':'FeatureCollection','schema':'property-infrastructure-geojson-v1','layerId':source['id'],'sourceId':source['sourceId'],'tileId':key,'retrievedAt':snapshot['retrievedAt'],'features':values}
   path=directory/source['id']/f'{key}.geojson';path.parent.mkdir(parents=True,exist_ok=True);raw=encode(payload);path.write_bytes(raw)
   bounds=bounds_of(values)
   if source['id']=='city-streetlights':
    x,y=map(int,key.split('_'));bounds=[x*GRID,y*GRID,(x+1)*GRID,(y+1)*GRID]
   tiles.append({'id':key,'url':'/st-louis/infrastructure/'+source['id']+'/'+key+'.geojson','count':len(values),'bounds':bounds,
    'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'coordinateCount':sum(len(coordinates(f['geometry'])) for f in values),
    'geometryTypes':sorted(set(f['geometry']['type'] for f in values))})
  entries.append({'id':source['id'],'available':True,'coverage':source['coverage'],'meaning':source['meaning'],'recordCount':len(features),'mappedCount':len(mapped),'unmappedCount':len(features)-len(mapped),'bounds':bounds_of(mapped),'gridDegrees':GRID if source['id']=='city-streetlights' else None,'tiles':tiles,
   'source':{'id':source['sourceId'],'url':source['url'],'catalogUrl':source['catalogUrl'],'queryUrl':source['url']+'/{layer}/query','retrievedAt':snapshot['retrievedAt'],'sourceDataEditedAt':None,
    'dateBasis':'Source does not supply a verified whole-dataset update date. Retrieval is an observation date.',
    'browserAccess':'Anonymous server-side queries verified; Access-Control-Allow-Origin was absent. Published snapshots are served from this site.',
    'termsUrl':TERMS,'licenseIdentifier':None,'termsBasis':'City public dataset terms; source-specific REST license text is not supplied. No Creative Commons or public-domain license is asserted.',
    'termsCurrentTextVerified':False,'termsReviewNote':'Existing City public-data terms reference; the legacy terms page timed out during this collection. Official source attribution and limits are retained.',
    'sourceLayers':[{k:v for k,v in layer.items() if k!='features'} for layer in snapshot['layers']],
    'exactObjectIdsVerified':True,'sourceObjectIdsRechecked':True,'sourceEditingEpochAvailable':False}})
 manifest={'schema':'property-infrastructure-manifest-v1','generatedAt':stamp(),'layers':entries,'limitations':['Street-light positions are asset inventory points, not wires, conduits, utility connection evidence, or proof of operating condition.','Capital projects are a selected public catalog, not a census of construction or approvals.','No building interior, buried network, or exact parcel joins are inferred.','Source object ID sets and counts were unchanged across each collection; services supply no reliable source editing epoch, so attribute changes during collection cannot be ruled out.']}
 (directory/'manifest.json').write_bytes(encode(manifest))
 return manifest


def publish(staging,output):
 backup=output.with_name(output.name+'-previous')
 if backup.exists():shutil.rmtree(backup)
 if output.exists():output.rename(backup)
 try:staging.rename(output)
 except BaseException:
  if backup.exists():backup.rename(output)
  raise
 if backup.exists():shutil.rmtree(backup)


def main():
 parser=argparse.ArgumentParser();parser.add_argument('--cached',action='store_true');parser.add_argument('--resume',action='store_true',help='Reuse already verified component snapshots with original retrieval dates; fetch missing components only.');args=parser.parse_args()
 RESEARCH.mkdir(parents=True,exist_ok=True);started=stamp();staging=None
 try:
  snapshots=[]
  for source in SOURCES:
   cached=RESEARCH/(source['id']+'-verified.json')
   reuse=args.cached or args.resume and cached.exists()
   snapshot=json.loads(cached.read_bytes()) if reuse else fetch_source(source)
   if not reuse:cached.write_bytes(encode(snapshot))
   snapshots.append(snapshot)
  staging=Path(tempfile.mkdtemp(prefix='infrastructure-stage-',dir=OUTPUT.parent));manifest=build(snapshots,staging)
  status={'schema':'property-infrastructure-status-v1','status':'ready','attemptedAt':started,'finishedAt':stamp(),'mode':'cached-rebuild' if args.cached else 'resume' if args.resume else 'fresh','count':sum(x['recordCount'] for x in manifest['layers'])}
  (staging/'status.json').write_bytes(encode(status));publish(staging,OUTPUT)
  print(json.dumps({'status':'ready','layers':[{k:x[k] for k in ('id','recordCount','mappedCount','unmappedCount')} for x in manifest['layers']]}))
 except Exception as error:
  OUTPUT.mkdir(parents=True,exist_ok=True);(OUTPUT/'status.json').write_bytes(encode({'schema':'property-infrastructure-status-v1','status':'failed','attemptedAt':started,'finishedAt':stamp(),'error':str(error)[:500],'priorDataRetained':(OUTPUT/'manifest.json').exists()}))
  raise
 finally:
  if staging and staging.exists():shutil.rmtree(staging)

if __name__=='__main__':main()
