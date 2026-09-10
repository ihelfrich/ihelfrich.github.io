#!/usr/bin/env python
# Run: uv run --no-project --with shapely python scripts/st-louis/fetch_parcels.py --cache ... --evidence ... --output public/st-louis/parcels
"""Build an attributed City parcel snapshot. Anonymous, allowlisted fields only.

Reads the public City service without changing geometry. Each parcel is stored
once; tile bounds expand around all source polygons, so edge/multipart queries
fetch every candidate tile. Publication is a separate parent-owned operation.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import urllib.parse
import urllib.request

BASE = 'https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0'
BOUNDARY = 'https://maps8.stlouis-mo.gov/arcgis/rest/services/ASSESSOR/Assessor_Public_Parcels/MapServer/15'
FIELDS = 'OBJECTID,HANDLE,ParcelId,ColParcelId,SITEADDR,SQFT,AsrLandUse1,AsdTotal,LastDate'
MAX_BYTES = 300_000_000
PAGE_SIZE = 1000

def request_json(url, path, limit=16_000_000):
    if path.exists():
        return json.loads(path.read_text())
    # ArcGIS query supports POST; long object-ID lists exceed ordinary URL limits.
    endpoint, _, parameters = url.partition('?')
    post = len(url)>1500
    request = urllib.request.Request(endpoint if post else url, data=parameters.encode() if post else None,
        headers={'User-Agent': 'St-Louis-public-parcel-snapshot/1.0', **({'Content-Type':'application/x-www-form-urlencoded'} if post else {})})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read(limit+1)
    if len(body)>limit:
        raise ValueError('Bounded public response limit exceeded')
    result = json.loads(body)
    if result.get('error'):
        raise ValueError('Official parcel service rejected a public query')
    path.write_bytes(body)
    return result

def query(params):
    return BASE+'/query?'+urllib.parse.urlencode(params)

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(',', ':'), ensure_ascii=False))

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--evidence',type=Path,help='Optional existing verified city-count.json and city-coverage.json; otherwise retrieve them into the fresh cache')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    args.cache.mkdir(parents=True,exist_ok=True)
    stamp=args.cache/'retrieved-at.json'
    if not stamp.exists(): write_json(stamp, {'retrievedAt':datetime.now(timezone.utc).isoformat()})
    retrieved=json.loads(stamp.read_text())['retrievedAt']
    if args.evidence:
        expected=json.loads((args.evidence/'city-count.json').read_text())['count']
    else:
        expected=request_json(query({'f':'json','where':'1=1','returnCountOnly':'true'}),args.cache/'city-count.json')['count']
    ids=request_json(query({'f':'json','where':'1=1','returnIdsOnly':'true'}),args.cache/'object-ids.json')['objectIds']
    if len(ids)!=expected or len(set(ids))!=len(ids): raise ValueError('Source count changed or object IDs are duplicated; review a new snapshot')
    ids.sort()
    batches=[ids[i:i+PAGE_SIZE] for i in range(0,len(ids),PAGE_SIZE)]
    def page(pair):
        number,object_ids=pair
        path=args.cache/f'page-{number:04d}.json'
        payload=request_json(query({'f':'geojson','objectIds':','.join(map(str,object_ids)),'outFields':FIELDS,'returnGeometry':'true','outSR':'4326','orderByFields':'OBJECTID ASC'}),path)
        if payload.get('exceededTransferLimit') or len(payload.get('features',[]))!=len(object_ids): raise ValueError('Incomplete parcel page; snapshot not published')
        returned={f['properties']['OBJECTID'] for f in payload['features']}
        if returned!=set(object_ids): raise ValueError('Parcel object-ID page differs from requested source identities')
        return path,path.stat().st_size
    paths=[]; total=0
    with ThreadPoolExecutor(max_workers=2) as pool:
        for number,(path,size) in enumerate(pool.map(page,enumerate(batches),buffersize=2),start=1):
            paths.append(str(path.resolve())); total+=size
            if total>MAX_BYTES: raise ValueError('Snapshot exceeds 300 MB admission limit')
            if number%25==0 or number==len(batches): print(json.dumps({'pages':number,'totalPages':len(batches),'sourceBytes':total}),flush=True)
    root=Path(__file__).resolve().parents[2]
    config={'pages':paths,'module':str(root/'src/lib/city-parcels.mjs'),'retrievedAt':retrieved,'output':str((args.cache/'normalized.jsonl').resolve())}
    config_path=args.cache/'normalize-config.json';write_json(config_path,config)
    code='''import fs from "node:fs";import{pathToFileURL}from"node:url";
const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const{normalizeCityParcels}=await import(pathToFileURL(c.module));
const fd=fs.openSync(c.output,"w"),seen=new Set();
for(const path of c.pages){const result=normalizeCityParcels(JSON.parse(fs.readFileSync(path,"utf8")),{retrievedAt:c.retrievedAt});for(const f of result.features){if(seen.has(f.id))throw Error("Duplicate parcel HANDLE across source pages");seen.add(f.id);fs.writeSync(fd,JSON.stringify(f)+"\\n");}}
fs.closeSync(fd);console.log(JSON.stringify({normalized:seen.size}));'''
    subprocess.run(['node','--input-type=module','-e',code,str(config_path.resolve())],check=True,timeout=90)
    from shapely.geometry import shape
    tiles={}; search=[]; missing_addresses=0; handles={}; invalid_geometry=0
    with (args.cache/'normalized.jsonl').open() as stream:
        for line in stream:
            feature=json.loads(line); bounds=feature['bbox']; p=feature['properties']
            geometry=shape(feature['geometry'])
            if geometry.is_empty: raise ValueError('Empty source polygon requires review')
            if not geometry.is_valid:
                invalid_geometry+=1
                p['geometryStatus']='invalid-source'
            handles[p['handle']]=handles.get(p['handle'],0)+1
            key=f'{math.floor((bounds[0]+bounds[2])/2/.01)}_{math.floor((bounds[1]+bounds[3])/2/.01)}'
            tile=tiles.setdefault(key,{'bounds':bounds[:],'features':[]})
            tile['bounds']=[min(tile['bounds'][0],bounds[0]),min(tile['bounds'][1],bounds[1]),max(tile['bounds'][2],bounds[2]),max(tile['bounds'][3],bounds[3])]
            tile['features'].append(feature)
            if p['address']:
                point=geometry.representative_point()
                search.append([p['handle'],p['parcelId'],p['address'],point.x,point.y,key,p['recordKey']])
            else: missing_addresses+=1
    if args.evidence:
        coverage=json.loads((args.evidence/'city-coverage.json').read_text())
    else:
        coverage=request_json(BOUNDARY+'/query?'+urllib.parse.urlencode({'f':'geojson','where':'1=1','outFields':'OBJECTID','returnGeometry':'true','outSR':'4326'}),args.cache/'city-coverage.json')
    if len(coverage.get('features',[]))!=1: raise ValueError('Unexpected City jurisdiction boundary shape')
    source={'id':'st-louis-city-parcels','jurisdiction':'st-louis-city','name':'City of St. Louis public parcel data','url':BASE,'catalogUrl':'https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=82','termsUrl':'https://dynamic.stlouis-mo.gov/opendata/terms.cfm','catalogPublishedAt':'2026-08-27','retrievedAt':retrieved,'assessmentYear':None,'geometryPolicy':'Source WGS84 geometry; no simplification. GIS boundaries are not a legal survey.'}
    manifest={'schema':'st-louis-parcels-v1','source':source,'recordCount':len(ids),'distinctHandles':len(handles),'sharedHandleGroups':sum(n>1 for n in handles.values()),'completeSourceExtraction':True,'sourceBytes':total,'coverageGeometry':coverage['features'][0]['geometry'],'coverageSource':BOUNDARY,'county':{'status':'unsupported','reason':'Current public parcel transport and redistribution terms remain unverified.'},'tiles':[],'search':{'url':'/st-louis/parcels/search.json','count':len(search),'missingAddresses':missing_addresses,'format':['handle','parcelId','address','longitude','latitude','tileId','recordKey']},'limitations':['Source snapshot is not live and is not a legal survey.','The City disclaims completeness, accuracy and fitness; validate decisions with the originating department.','Parcel boundaries and assessed values do not establish ownership, availability, asking price or permitted development.','Assessment year is not supplied. LastDate is retained without interpreting its meaning.','HANDLE is a nonunique join key; sourceObjectId/recordKey identifies a record within this snapshot and can change on refresh.']}
    manifest['invalidSourceGeometryRecords']=invalid_geometry
    if invalid_geometry:manifest['limitations'].append(f'{invalid_geometry} source record has invalid geometry topology and is excluded from exact spatial confirmation; its geometry is retained without repair.')
    # Build into a new directory first; failed downloads/validation never replace a good snapshot.
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='parcel-build-',dir=args.output.parent) as temp:
        staging=Path(temp); bytes_written=0
        for key,tile in sorted(tiles.items()):
            path=staging/'tiles'/f'{key}.json'
            write_json(path,{'type':'FeatureCollection','features':tile['features']})
            size=path.stat().st_size;bytes_written+=size
            manifest['tiles'].append({'id':key,'bounds':tile['bounds'],'count':len(tile['features']),'bytes':size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'url':f'/st-louis/parcels/tiles/{key}.json'})
        write_json(staging/'search.json',{'schema':'st-louis-parcel-addresses-v1','source':source,'records':search})
        bytes_written+=(staging/'search.json').stat().st_size
        manifest['payloadBytes']=bytes_written
        if bytes_written>MAX_BYTES:raise ValueError('Public payload exceeds 300 MB limit')
        write_json(staging/'manifest.json',manifest)
        args.output.mkdir(parents=True,exist_ok=True)
        import shutil
        for file in staging.iterdir():
            target=args.output/file.name
            if file.is_dir(): shutil.copytree(file,target,dirs_exist_ok=True)
            else: shutil.copy2(file,target)
    print(json.dumps({'records':len(ids),'tiles':len(tiles),'searchRecords':len(search),'sourceBytes':total,'payloadBytes':bytes_written,'output':str(args.output)}),flush=True)

if __name__=='__main__':main()
