"""Fetch only business-designation candidates from public County GIS; never all owners.
uv run --no-project python scripts/st-louis/fetch_property_ownership.py --cache ../research/ownership-signals-2026/cache --output public/st-louis/ownership-signals
Rebuild only the name lookup from verified published tiles, with no network request:
uv run --no-project python scripts/st-louis/fetch_property_ownership.py --output public/st-louis/ownership-signals --name-index-only
The name pattern is an indicator, not entity verification, private-equity affiliation,
or an identification of the buyer on any past transfer. No mailing fields requested.
"""
import argparse, hashlib, json, math, re, subprocess, unicodedata, urllib.parse
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
BASE='https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0'
TOKENS=[' LLC',' L.L.C.',' L L C',' INC',' CORP',' LLP',' L.L.P.',' LP',' L.P.',' LTD',' LIMITED']
WHERE=' OR '.join(f"UPPER(OWNER_NAME) LIKE '%{s}%'" for s in TOKENS)
PATTERN=re.compile(r'(?<![A-Z0-9])(?:L\.?\s*L\.?\s*C\.?|L\.?\s*L\.?\s*P\.?|L\.?\s*P\.?|INC(?:ORPORATED)?\.?|CORP(?:ORATION)?\.?|LTD\.?|LIMITED)(?![A-Z0-9])',re.I)
RULE='county-business-designator-v1'
FIELDS=['OBJECTID','LOCATOR','OWNER_NAME']
def now():return datetime.now(timezone.utc).isoformat()
def encode(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def digest(b):return hashlib.sha256(b).hexdigest()
def normalized_name(name):return ' '.join(unicodedata.normalize('NFKC',name).lower().split())
def read(cache,name,params,resume):
 path=cache/(name+'.json');receipt=cache/(name+'-receipt.json')
 url=BASE+'/query?'+urllib.parse.urlencode({'f':'json','where':WHERE,**params})
 if resume and path.exists():
  raw=path.read_bytes();r=json.loads(receipt.read_text());assert r['url']==url and r['sha256']==digest(raw)
 else:
  result=subprocess.run(['curl','--max-time','35','--max-filesize','3000000','--compressed','--silent','--show-error','--fail',url],capture_output=True,check=True,timeout=40)
  raw=result.stdout;r={'url':url,'retrievedAt':now(),'bytes':len(raw),'sha256':digest(raw)}
  path.write_bytes(raw);receipt.write_bytes(encode(r))
 d=json.loads(raw)
 if d.get('error'):raise ValueError(d['error'].get('message','Official source error'))
 return d,r

def build_signals(features,region):
 positions={}
 manifest=json.loads((region/'manifest.json').read_text())
 for tile in manifest['tiles']:
  payload=json.loads((region/'tiles'/f"{tile['id']}.json").read_text())
  f=payload['fields'];positions.update({r[f.index('sourceObjectId')]:{k:r[f.index(k)] for k in ['parcelId','recordKey','parcelKey','longitude','latitude']} for r in payload['rows']})
 if manifest.get('unlocatedCount'):
  payload=json.loads((region/'unlocated.json').read_text());f=payload['fields']
  positions.update({r[f.index('sourceObjectId')]:{k:r[f.index(k)] for k in ['parcelId','recordKey','parcelKey','longitude','latitude']} for r in payload['rows']})
 records=[];rejected=0;unmatched=[]
 for feature in features:
  a=feature['attributes'];name=(a.get('OWNER_NAME') or '').strip();match=PATTERN.search(name)
  if not match:rejected+=1;continue
  oid=a['OBJECTID'];parcel=(a.get('LOCATOR') or '').strip() or None;point=positions.get(oid)
  if point is None or point['parcelId']!=parcel:unmatched.append(oid);continue
  records.append({'id':f'county-business-name:{oid}','jurisdiction':'st-louis-county','sourceObjectId':oid,**point,'ownerName':name,'indicator':'name_contains_legal_designator','matchedDesignator':match.group(0),'ruleVersion':RULE})
 return records,{'candidateFeatureCount':len(features),'publishedIndicatorCount':len(records),'rejectedTokenCandidates':rejected,'unmatchedExactRegionIdentityCount':len(unmatched),'unmatchedSourceObjectIds':unmatched,'mappedIndicatorCount':sum(r['longitude'] is not None and r['latitude'] is not None for r in records)},manifest['source']

def publish_snapshot(result,output):
 records=result.pop('records');groups={};unlocated=[];tile_index=[]
 (output/'tiles').mkdir(exist_ok=True)
 for record in records:
  x,y=record['longitude'],record['latitude']
  if x is None or y is None:unlocated.append(record);continue
  ix,iy=math.floor(x/.02),math.floor(y/.02);key=f'{ix}_{iy}'
  groups.setdefault(key,[]).append(record)
 for key,rows in sorted(groups.items()):
  ix,iy=map(int,key.split('_'))
  payload={'schema':'ownership-signals-tile-v1','id':key,'jurisdiction':'st-louis-county','sourceId':result['source']['id'],'records':rows}
  raw=encode(payload);(output/'tiles'/f'{key}.json').write_bytes(raw)
  tile_index.append({'id':key,'bounds':[round(ix*.02,6),round(iy*.02,6),round((ix+1)*.02,6),round((iy+1)*.02,6)],'url':f'/st-louis/ownership-signals/tiles/{key}.json','count':len(rows),'bytes':len(raw),'sha256':digest(raw)})
 if unlocated:(output/'unlocated.json').write_bytes(encode({'schema':'ownership-signals-tile-v1','id':'unlocated','jurisdiction':'st-louis-county','sourceId':result['source']['id'],'records':unlocated}))
 result.update(gridDegrees=.02,tiles=tile_index,recordCount=len(records),unlocatedCount=len(unlocated),unlocatedUrl='/st-louis/ownership-signals/unlocated.json' if unlocated else None,totalTileBytes=sum(t['bytes'] for t in tile_index),largestTileBytes=max((t['bytes'] for t in tile_index),default=0))
 (output/'index.json').write_bytes(encode(result))
 add_name_index(output)

def add_name_index(output):
 """Aggregate exact literal names; normalization is for substring lookup only."""
 path=output/'index.json';manifest=json.loads(path.read_text());names={};seen=set();mapped=0;unlocated=0
 def add(record,tile_id):
  nonlocal mapped,unlocated
  oid=record['sourceObjectId']
  if oid in seen:raise ValueError('A source object was duplicated in the ownership tiles.')
  seen.add(oid);name=record['ownerName']
  if not isinstance(name,str) or not name or record['ruleVersion']!=manifest['ruleVersion']:raise ValueError('Invalid published name record.')
  entry=names.setdefault(name,{'name':name,'normalizedOwnerName':normalized_name(name),'count':0,'tiles':{},'unlocatedCount':0})
  entry['count']+=1
  if tile_id is None:entry['unlocatedCount']+=1;unlocated+=1
  else:entry['tiles'][tile_id]=entry['tiles'].get(tile_id,0)+1;mapped+=1
 for tile in manifest['tiles']:
  raw=(output/'tiles'/f"{tile['id']}.json").read_bytes()
  if len(raw)!=tile['bytes'] or digest(raw)!=tile['sha256']:raise ValueError('Published ownership tile changed from its digest.')
  data=json.loads(raw)
  if data['id']!=tile['id'] or data['sourceId']!=manifest['source']['id'] or len(data['records'])!=tile['count']:raise ValueError('Ownership tile identity/count mismatch.')
  for record in data['records']:add(record,tile['id'])
 if manifest.get('unlocatedCount'):
  data=json.loads((output/'unlocated.json').read_text())
  if data['sourceId']!=manifest['source']['id'] or len(data['records'])!=manifest['unlocatedCount']:raise ValueError('Unlocated ownership count/source mismatch.')
  for record in data['records']:add(record,None)
 if len(seen)!=manifest['recordCount'] or mapped!=manifest['coverage']['mappedIndicatorCount'] or unlocated!=manifest['unlocatedCount']:raise ValueError('Name index does not reconcile the published snapshot.')
 records=[]
 for name,entry in sorted(names.items()):
  entry['tiles']=[{'id':key,'count':count} for key,count in sorted(entry['tiles'].items())]
  if not entry['unlocatedCount']:entry.pop('unlocatedCount')
  records.append(entry)
 result={'schema':'ownership-name-index-v1','sourceId':manifest['source']['id'],'ruleVersion':manifest['ruleVersion'],'retrievedAt':manifest['source']['retrievedAt'],'derivedAt':now(),
         'normalization':'NFKC; lowercase; collapse whitespace; no aliases','countMeaning':'Counts are published source parcel features. Exact literal names remain separate; name matching does not establish common beneficial ownership or acquisitions.',
         'coverage':{'indicatorCount':len(seen),'mappedIndicatorCount':mapped,'unlocatedIndicatorCount':unlocated,'nameCount':len(records),'representedTileCount':len(manifest['tiles'])},'records':records}
 raw=encode(result);(output/'names-index.json').write_bytes(raw)
 manifest.update(nameIndexUrl='/st-louis/ownership-signals/names-index.json',nameIndexBytes=len(raw),nameIndexSha256=digest(raw),nameCount=len(records))
 path.write_bytes(encode(manifest))
 return {'names':len(records),'bytes':len(raw),'indicatorCount':len(seen),'mappedIndicatorCount':mapped,'unlocatedIndicatorCount':unlocated}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cache',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--region',type=Path,default=Path('public/st-louis/regions/st-louis-county'));p.add_argument('--resume',action='store_true');p.add_argument('--name-index-only',action='store_true');args=p.parse_args()
 if args.name_index_only:
  print(json.dumps(add_name_index(args.output)));return
 if args.cache is None:p.error('--cache is required for source acquisition.')
 if args.output.exists():raise ValueError('Use a new output directory; previous snapshots are not overwritten.')
 args.cache.mkdir(parents=True,exist_ok=True)
 ids,r0=read(args.cache,'ids',{'returnIdsOnly':'true'},args.resume);expected=sorted(ids['objectIds'])
 if len(expected)!=len(set(expected)) or len(expected)>100000:raise ValueError('Unexpected candidate ID count.')
 count,rc=read(args.cache,'count',{'returnCountOnly':'true'},args.resume);assert count['count']==len(expected)
 batches=[expected[i:i+4000] for i in range(0,len(expected),4000)]
 def page(pair):
  i,b=pair
  params={'where':f'({WHERE}) AND OBJECTID >= {b[0]} AND OBJECTID <= {b[-1]}','outFields':','.join(FIELDS),'returnGeometry':'false','orderByFields':'OBJECTID','resultRecordCount':4000}
  d,r=read(args.cache,f'page-{i:03d}',params,args.resume);items=d['features']
  if d.get('exceededTransferLimit') or sorted(f['attributes']['OBJECTID'] for f in items)!=b:raise ValueError('Incomplete exact candidate page.')
  if any(set(f['attributes'])!=set(FIELDS) for f in items):raise ValueError('Unexpected source field outside publication allowlist.')
  return items,r
 features=[];receipts=[r0,rc]
 with ThreadPoolExecutor(max_workers=3) as pool:
  for items,receipt in pool.map(page,enumerate(batches)):
   features.extend(items);receipts.append(receipt)
 end,re=read(args.cache,'end-ids',{'returnIdsOnly':'true'},args.resume);assert sorted(end['objectIds'])==expected;receipts.append(re)
 records,coverage,point_source=build_signals(features,args.region)
 args.output.mkdir(parents=True)
 source={'id':'st-louis-county-business-name-indicators','name':'St. Louis County public parcel owner-name designations','url':BASE,'queryUrl':BASE+'/query','where':WHERE,'requestedFields':FIELDS,'retrievedAt':max(r['retrievedAt'] for r in receipts),'retrievalStartedAt':min(r['retrievedAt'] for r in receipts),'sourceIdentitySha256':digest(encode(expected)),'sourceDataEditedAt':None,'sourceOwnerNameMaxLength':40,'method':'Public server-filtered GIS query, strict local legal-designator token filter, exact OBJECTID plus LOCATOR join to regional point snapshot','recordDateMeaning':'Retrieval is the observation date of the source owner label; no ownership-start or acquisition date is supplied.'}
 result={'schema':'ownership-signals-v1','source':source,'ruleVersion':RULE,'rulePattern':PATTERN.pattern,'label':'Business-name indicator','coverage':coverage,'coordinateSource':{'url':point_source['url'],'retrievedAt':point_source['retrievedAt'],'identityRule':'Both source OBJECTID and LOCATOR must match the region record.'},'limitations':['Names with a matched legal designator are source-name indicators, not independently verified legal entities.','This snapshot does not establish private-equity affiliation, beneficial ownership, a recent purchase, or the buyer on any past transfer.','The source name is limited to 40 characters. Unmatched, differently abbreviated or truncated company names may be missed.','Multiple entities may share names or service providers. No name-based consolidation of beneficial owners is performed.','No household-wide owner list, mailing addresses, contact fields or person-level registry records are requested or published.','Point locations are approximate regional map markers; they are not parcel boundaries.'],'records':records}
 publish_snapshot(result,args.output)
 (args.cache/'receipts.json').write_bytes(encode({'source':source,'requests':receipts}))
 print(json.dumps({'coverage':coverage,'bytes':(args.output/'index.json').stat().st_size,'output':str(args.output)}))
if __name__=='__main__':main()
