"""Count-checked, allowlisted Overland and Page/I-170 public parcel snapshot.
Run with uv run --no-project --with shapely python ... --cache PATH --output PATH.
Source assessments are historical; retrieval never relabels them as current.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import urllib.request
import urllib.parse
from shapely.geometry import shape, mapping, box

BASE = 'https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/STLCO_STC_Parcels_Revised/FeatureServer/0'
FIELDS = 'OBJECTID_1,LOCATOR,TAXYR,PROP_ADD,PROP_ZIP,MUNICIPALI,LUCODE,LIVUNIT,YEARBLT,RESQFT,ACRES,TOTASSMT,TOTAPVAL,ASSTLANDVA,ASSTIMPVAL,ZONING'
CENTER = [-90.35418, 38.686435]

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(',', ':'), ensure_ascii=False))

def main():
    p = argparse.ArgumentParser(); p.add_argument('--cache', type=Path, required=True); p.add_argument('--output', type=Path, required=True); p.add_argument('--metadata', type=Path, required=True)
    args = p.parse_args(); args.cache.mkdir(parents=True, exist_ok=True)
    if args.output.exists(): raise ValueError('Use a new output directory; do not overwrite an accepted snapshot.')
    def get(name, params):
        path = args.cache / (name + '.json')
        if path.exists(): return json.loads(path.read_text())
        parameters=urllib.parse.urlencode({'f':'json', **params}); url=BASE+'/query?'+parameters
        request=urllib.request.Request(BASE+'/query',data=parameters.encode(),headers={'Content-Type':'application/x-www-form-urlencoded'}) if len(url)>1500 else url
        with urllib.request.urlopen(request, timeout=30) as response: raw = response.read(12_000_001)
        if len(raw) > 12_000_000: raise ValueError('Source response exceeds page budget')
        data = json.loads(raw)
        if data.get('error'): raise ValueError('Parcel source rejected query')
        write(path, data); return data
    scopes = {'overland': {'where':"MUNICIPALI = 'OVERLAND'"}, 'page-i170': {'where':'1=1','geometry':','.join(map(str,CENTER)), 'geometryType':'esriGeometryPoint','inSR':4326,'distance':2000,'units':'esriSRUnit_Meter','spatialRel':'esriSpatialRelIntersects'}}
    ids = {}
    for key, query in scopes.items():
        values = get(key+'-ids', {**query,'returnIdsOnly':'true'})['objectIds']
        count = get(key+'-count', {**query,'returnCountOnly':'true'})['count']
        if len(set(values)) != count or len(values) != count: raise ValueError('Incomplete source identities')
        ids[key] = set(values)
    selected = sorted(set.union(*ids.values())); seen = set(); tiles = {}; records = []; years = {}; invalid = 0
    pages = [selected[i:i+400] for i in range(0,len(selected),400)]
    def page(pair):
        number, batch = pair
        value = get(f'features-{number:03d}', {'f':'geojson','objectIds':','.join(map(str,batch)), 'outFields':FIELDS,'returnGeometry':'true','outSR':4326})
        if value.get('exceededTransferLimit') or {f['properties']['OBJECTID_1'] for f in value.get('features',[])} != set(batch): raise ValueError('Incomplete geometry page')
        return value['features']
    stamp = datetime.now(timezone.utc).isoformat()
    def number(value, positive=False):
        return value if isinstance(value,(float,int)) and math.isfinite(value) and (value>0 if positive else value>=0) else None
    with ThreadPoolExecutor(max_workers=2) as pool:
        for features in pool.map(page, enumerate(pages), buffersize=2):
            for f in features:
                a=f['properties']; oid=a['OBJECTID_1']; locator=str(a['LOCATOR']).strip()
                if oid in seen or not locator: raise ValueError('Duplicate or absent record identity')
                seen.add(oid); geom=shape(f['geometry'])
                if geom.is_empty or geom.geom_type not in ('Polygon','MultiPolygon'): raise ValueError('Invalid geometry kind')
                b=list(geom.bounds); point=geom.representative_point(); record_key=f'st-louis-county:{locator}:{oid}'
                scope=[key for key in ids if oid in ids[key]]; year=number(a.get('TAXYR'),True); years[str(year)]=years.get(str(year),0)+1
                acres=number(a.get('ACRES'),True)
                props={'jurisdiction':'st-louis-county','parcelKey':f'st-louis-county:{locator}','recordKey':record_key,'parcelId':locator,'handle':locator,'sourceObjectId':oid,'address':str(a.get('PROP_ADD') or '').strip(),'municipality':a.get('MUNICIPALI'),'postalCode':str(a.get('PROP_ZIP') or '').strip(),'assessmentYear':year,'assessedValueUSD':number(a.get('TOTASSMT')),'assessorAppraisedValueUSD':number(a.get('TOTAPVAL')),'assessedLandUSD':number(a.get('ASSTLANDVA')),'assessedImprovementsUSD':number(a.get('ASSTIMPVAL')),'areaSqFt':acres*43560 if acres else None,'landUseCode':a.get('LUCODE'),'dwellingUnits':number(a.get('LIVUNIT')),'yearBuilt':number(a.get('YEARBLT'),True),'livingAreaSqFt':number(a.get('RESQFT'),True),'historicalZoning':a.get('ZONING'),'scope':scope,'sourceRecordDate':None}
                if not geom.is_valid: props['geometryStatus']='invalid-source'; invalid+=1
                key=f'{math.floor(point.x/.01)}_{math.floor(point.y/.01)}'
                item=tiles.setdefault(key,{'bounds':b.copy(),'features':[]})
                item['bounds']=[min(item['bounds'][0],b[0]),min(item['bounds'][1],b[1]),max(item['bounds'][2],b[2]),max(item['bounds'][3],b[3])]
                item['features'].append({'type':'Feature','id':record_key,'bbox':b,'geometry':f['geometry'],'properties':props})
                records.append({**props,'longitude':point.x,'latitude':point.y})
            print(f'Validated {len(seen)} / {len(selected)} source records',flush=True)
    if seen != set(selected): raise ValueError('Source identities were lost')
    metadata=json.loads(args.metadata.read_text()); edited=metadata['editingInfo']['dataLastEditDate']
    source={'id':'st-louis-county-stc-revised','name':'St. Louis County published parcel study snapshot','jurisdiction':'st-louis-county','url':BASE,'retrievedAt':stamp,'sourceDataEditedAt':datetime.fromtimestamp(edited/1000,timezone.utc).isoformat(),'metadataSha256':hashlib.sha256(args.metadata.read_bytes()).hexdigest(),'assessmentYears':years,'termsUrl':'https://www.arcgis.com/home/item.html?id=06d43012de4a484ab004f5b34ea0e8e8','copyright':'St. Louis County Assessor’s Office and GIS Service Center'}
    all_bounds=[min(t['bounds'][0] for t in tiles.values()),min(t['bounds'][1] for t in tiles.values()),max(t['bounds'][2] for t in tiles.values()),max(t['bounds'][3] for t in tiles.values())]
    manifest={'schema':'st-louis-parcels-v1','source':source,'featureCount':len(records),'invalidSourceGeometryRecords':invalid,'coverageGeometry':mapping(box(*all_bounds)),'coverageMeaning':'Envelope of a selected historical snapshot, not an administrative or completeness boundary.','scopes':{key:{'sourceCount':len(value)} for key,value in ids.items()},'corridor':{'center':CENTER,'radiusMetres':2000,'label':'Page Avenue and I-170','locationSource':'Esri World Geocoding Service street intersection'},'tiles':[],'limitations':['All Overland-designated source records plus all source parcels intersecting the 2 km corridor query; this is not a current census of houses.','Historical assessments and source building attributes are not current sale prices, rents or verified building condition.','Invalid source geometries are retained but excluded from exact spatial confirmation.','GIS is not a legal survey; validate business decisions with the appropriate agency.']}
    for key,tile in sorted(tiles.items()):
        path=args.output/'tiles'/f'{key}.json'; write(path,{'type':'FeatureCollection','features':tile['features']})
        manifest['tiles'].append({'id':key,'bounds':tile['bounds'],'count':len(tile['features']),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'url':f'/st-louis/county-parcels/tiles/{key}.json'})
    records.sort(key=lambda p:(p['address'],p['recordKey']))
    write(args.output/'index.json',{'schema':'county-parcel-index-v1','source':source,'records':records})
    manifest['indexUrl']='/st-louis/county-parcels/index.json'; write(args.output/'manifest.json',manifest)
    print(json.dumps({'records':len(records),'overland':len(ids['overland']),'corridor':len(ids['page-i170']),'assessmentYears':years,'invalidGeometry':invalid}))

if __name__=='__main__': main()
