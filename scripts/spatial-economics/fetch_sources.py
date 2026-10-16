"""Fetch explicit public inputs only; retained cache makes builds reproducible."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.geospatial-cache'
CACHE.mkdir(exist_ok=True)
BASE = 'https://lehd.ces.census.gov/data/lodes/LODES8/nc/'
SOURCES = {
    'nc_wac.csv.gz': BASE + 'wac/nc_wac_S000_JT01_2023.csv.gz',
    'nc_rac.csv.gz': BASE + 'rac/nc_rac_S000_JT01_2023.csv.gz',
    'nc_xwalk.csv.gz': BASE + 'nc_xwalk.csv.gz',
    'version.txt': BASE + 'version.txt',
}
QUERY = '''[out:json][timeout:80];(
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](35.43,-82.74,35.75,-82.36);
way["waterway"="river"](35.43,-82.74,35.75,-82.36);
);out body;>;out skel qt;'''

def fetch(item):
    name, url = item
    path = CACHE / name
    if not path.exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'HelfrichSpatialEconomics/1.0 public research demonstration'})
        with urllib.request.urlopen(req, timeout=110) as response:
            data = response.read(100_000_000)
        path.write_bytes(data)
    data = path.read_bytes()
    return {'file': name, 'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(fetch, SOURCES.items()))
    path = CACHE / 'osm.json'
    endpoint = 'https://overpass-api.de/api/interpreter'
    if not path.exists():
        req = urllib.request.Request(endpoint + '?' + urllib.parse.urlencode({'data': QUERY}), headers={'User-Agent': 'HelfrichSpatialEconomics/1.0', 'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=110) as response:
            data = response.read(100_000_000)
        parsed = json.loads(data)
        if parsed.get('remark') or not parsed.get('elements'):
            raise RuntimeError('Overpass returned incomplete data')
        path.write_bytes(data)
    osm = json.loads(path.read_bytes())
    records.append({'file':'osm.json','url':endpoint,'query':QUERY,'timestamp':osm.get('osm3s',{}).get('timestamp_osm_base'),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    manifest = {'retrieved': datetime.now(timezone.utc).isoformat(), 'sources':records}
    (CACHE / 'sources.json').write_text(json.dumps(manifest, indent=2))
    print(json.dumps({'sources':[{k:r[k] for k in ('file','bytes')} for r in records], 'osm_elements':len(osm['elements'])}))
