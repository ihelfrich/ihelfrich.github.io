# /// script
# requires-python = ">=3.12"
# dependencies = ["shapely>=2.0,<3"]
# ///
"""Reuse public Policy Atlas geometry for cartographic context only."""
from collections import defaultdict
from pathlib import Path
import argparse
import hashlib
import json
from shapely.geometry import shape
from shapely import make_valid
from shapely.ops import unary_union

parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,default=Path('/Users/ian/Developer/american-policy-atlas/app/public/data/us_counties.min.geojson'))
args=parser.parse_args()
source=args.source.read_bytes();data=json.loads(source)
groups=defaultdict(list)
for feature in data['features']:
    groups[feature['properties']['state_name']].append(make_valid(shape(feature['geometry'])))
features=[]
for name,geometries in sorted(groups.items()):
    merged=unary_union(geometries).simplify(.015,preserve_topology=True)
    polygons=[merged] if merged.geom_type=='Polygon' else list(merged.geoms)
    lines=[[[round(x,5),round(y,5)] for x,y in p.exterior.coords] for p in polygons if p.geom_type=='Polygon']
    features.append({'name':name,'lines':lines})
assert len(features)==51
output=Path(__file__).resolve().parents[2]/'public/spatial-economics/national'
(output/'context.json').write_text(json.dumps({'states':features},separators=(',',':'))+'\n')
receipt={'source':'https://ihelfrich.github.io/american-policy-atlas/data/us_counties.min.geojson','sourceSha256':hashlib.sha256(source).hexdigest(),'upstream':'https://www2.census.gov/geo/tiger/TIGER2023/COUNTY/tl_2023_us_county.zip','vintage':'TIGER 2023, topology-simplified by American Policy Atlas','transformation':'Make valid, dissolve county polygons by state name, simplify at 0.015 geographic degrees, retain outer rings, round coordinates to five decimals. Cartographic context only, never used to assign investment geography.','coverage':'50 states and DC; no territory outlines. Territory projects are retained independently in the atlas.','license':'U.S. Census Bureau public-domain source geometry.','states':len(features),'build':'scripts/spatial-economics/build_national_context.py'}
(output/'context-sources.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'states':len(features),'bytes':(output/'context.json').stat().st_size}))
