#!/usr/bin/env python3
"""Build an attributed City zoning snapshot with stdlib; no County downloads.
Run: uv run --no-project python scripts/st-louis/fetch_zoning.py
"""
import argparse, concurrent.futures, json, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path
SERVICE = "https://maps9.stlouis-mo.gov/arcgis/rest/services/PDA/Zoning/MapServer"
MAP_PAGE = "https://www.stlouis-mo.gov/government/departments/public-safety/building/zoning/zoning-map.cfm"
TERMS = "https://dynamic.stlouis-mo.gov/opendata/terms.cfm"
def query(layer, **params):
    url = f"{SERVICE}/{layer}/query?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=25) as response: raw = response.read(20_000_001)
    if len(raw) > 20_000_000: raise ValueError("Response exceeds bounded query limit")
    data = json.loads(raw)
    if data.get("error"): raise ValueError(f"Source error for layer {layer}")
    return data

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("public/st-louis/zoning"))
    parser.add_argument("--known-base-count", type=int, help="Reuse a just-verified count from this build session")
    args = parser.parse_args()
    retrieved = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    count = args.known_base_count if args.known_base_count is not None else query(3, where="1=1", returnCountOnly="true", f="json")["count"]
    if not 1 <= count <= 200_000: raise ValueError("Unexpected source count; review required")
    def page(offset):
        payload = query(3, where="1=1", outFields="OBJECTID,HANDLE,LAYER", returnGeometry="false", orderByFields="OBJECTID", resultOffset=offset, resultRecordCount=2000, f="json")
        return [f["attributes"] for f in payload["features"]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: pages = list(pool.map(page, range(0, count, 2000)))
    records = [row for page_rows in pages for row in page_rows]
    if len(records) != count or len({r['OBJECTID'] for r in records}) != count: raise ValueError("Base pagination incomplete or source changed")
    by_handle = {}
    for row in records:
        if not row.get("HANDLE"): raise ValueError("Base record missing HANDLE")
        by_handle.setdefault(row['HANDLE'], []).append([row['OBJECTID'], row.get('LAYER')])
    geometries = {}
    for name, layer, fields in [("multi", 2, "OBJECTID,HANDLE,LAYER"), ("overlays", 0, "OBJECTID,Name,UpDated,ORDINANCE,ItemType")]:
        payload = query(layer, where="1=1", outFields=fields, returnGeometry="true", outSR=4326, orderByFields="OBJECTID", resultRecordCount=2000, f="geojson")
        if payload.get('type') != 'FeatureCollection' or payload.get('exceededTransferLimit') or len(payload.get('features', [])) >= 2000: raise ValueError(f"{name} pagination requires review")
        if not all(f.get('geometry', {}).get('type') in ('Polygon', 'MultiPolygon') for f in payload['features']): raise ValueError(f"Unexpected {name} geometry")
        geometries[name] = payload
    args.output.mkdir(parents=True, exist_ok=True)
    def write(name, data):
        path = args.output/name
        temporary = path.with_suffix(path.suffix+'.tmp')
        temporary.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8'); temporary.replace(path)
        return path.stat().st_size
    sizes = {'base.json': write('base.json', {'byHandle':by_handle,'count':count})}
    for name, payload in geometries.items(): sizes[name+'.geojson'] = write(name+'.geojson',payload)
    manifest = {'schema':'st-louis-zoning-v1','retrievedAt':retrieved,'sourceDate':None,'effectiveDate':None,
      'jurisdiction':'st-louis-city','sourceUrl':SERVICE,'mapUrl':MAP_PAGE,'termsUrl':TERMS,
      'attribution':'City of St. Louis Planning and Urban Design Agency',
      'base':{'url':'/st-louis/zoning/base.json','sourceUrl':f'{SERVICE}/3','count':count,'handles':len(by_handle)},
      'multi':{'url':'/st-louis/zoning/multi.geojson','sourceUrl':f'{SERVICE}/2','count':len(geometries['multi']['features'])},
      'overlays':{'url':'/st-louis/zoning/overlays.geojson','sourceUrl':f'{SERVICE}/0','count':len(geometries['overlays']['features'])},
      'parcelManifestUrl':'/st-louis/parcels/manifest.json',
      'limitations':['Base data date and legal effective dates are unknown; retrieval is not legal currency.',
      'City raw extracts can be incomplete or inaccurate. Derived data remains subject to City open-data terms.',
      'Base districts join official parcels by HANDLE; multiple parcel accounts can share a HANDLE.',
      'Split-zone polygons and overlays are evaluated at the selected point separately.',
      'Review current ordinances, overlays and site-specific approvals. No development entitlement is computed.',
      'County municipal and unincorporated zoning is outside this City snapshot.']}
    sizes['manifest.json'] = write('manifest.json',manifest)
    print(json.dumps({'records':count,'handles':len(by_handle),'multi':manifest['multi']['count'],'overlays':manifest['overlays']['count'],'bytes':sizes,'output':str(args.output)}))
if __name__ == '__main__': main()
