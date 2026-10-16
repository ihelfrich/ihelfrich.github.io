"""Build a bounded, directed transport graph and 1 km LODES aggregates.

Run: uv run --no-project --with numpy --with scipy --with pyproj --with shapely
     python scripts/spatial-economics/build_dataset.py
"""
from pathlib import Path
from collections import defaultdict, Counter
import csv
import gzip
import json
import math
import re
import hashlib
import numpy as np
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components, dijkstra
from pyproj import Transformer, Geod
from shapely.geometry import LineString
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.geospatial-cache'
OUT = ROOT / 'public/spatial-economics'
OUT.mkdir(parents=True, exist_ok=True)
CORE = [-82.65, 35.50, -82.45, 35.68]
GRID = 1000
project = Transformer.from_crs(4326, 32617, always_xy=True).transform
unproject = Transformer.from_crs(32617, 4326, always_xy=True).transform
geod = Geod(ellps='WGS84')
raw = json.loads((CACHE/'osm.json').read_text())
nodes = {r['id']:(r['lon'], r['lat']) for r in raw['elements'] if r['type']=='node'}
ways = [r for r in raw['elements'] if r['type']=='way']
roads = [r for r in ways if 'highway' in r.get('tags',{}) and not any(r['tags'].get(k) in ['no','private'] for k in ['access','vehicle','motor_vehicle','motorcar'])]
rivers = [r for r in ways if r.get('tags',{}).get('waterway')=='river']
river_lines = unary_union([LineString([project(*nodes[n]) for n in w['nodes']]) for w in rivers])
speeds = {'motorway':55,'trunk':45,'primary':35,'secondary':30,'tertiary':25,'unclassified':25,'residential':20,'living_street':10}
def speed(tags):
    value = tags.get('maxspeed','')
    if re.fullmatch(r'\d+(?:\.\d+)?(?: mph)?', value):
        return min(130, max(5, float(value.split()[0]) * (1.609344 if 'mph' in value else 1)))
    return 20*1.609344 if tags['highway'].endswith('_link') else speeds.get(tags['highway'],25)*1.609344

# A crossing is a mapped bridge segment intersecting the river centreline,
# buffered by 25 m for source alignment; selecting candidates is explicit below.
candidates = []
for w in roads:
    t=w['tags']
    if t.get('bridge') not in [None,'no']:
        line=LineString([project(*nodes[n]) for n in w['nodes']])
        if line.distance(river_lines) <= 25:
            xy=line.interpolate(.5,normalized=True)
            lon,lat=unproject(xy.x,xy.y)
            if CORE[0]<lon<CORE[2] and CORE[1]<lat<CORE[3]:
                candidates.append({'way':w['id'],'name':t.get('name',t.get('ref','Unnamed crossing')),'lon':round(lon,6),'lat':round(lat,6),'highway':t['highway']})
(OUT/'crossing-candidates.json').write_text(json.dumps(candidates,indent=2))
print('Crossing candidates:', json.dumps(candidates))

# Names must match source OSM tags. Parallel carriageways with the same road
# name form one closure intervention; never infer an observed disaster closure.
selected_names = ['Amboy Road','Haywood Road','Craven Street','Pearson Bridge Road','Old Leicester Highway']
selected = [c for c in candidates if c['name'] in selected_names]
groups=[]
for name in selected_names:
    matches=[c for c in selected if c['name']==name]
    if matches:
        groups.append({'id':len(groups),'name':name,'wayIds':[c['way'] for c in matches], 'lon':round(sum(c['lon'] for c in matches)/len(matches),6), 'lat':round(sum(c['lat'] for c in matches)/len(matches),6)})
interstate=[c for c in candidates if c['name']=='Billy Graham Freeway' and c['lon'] < -82.56]
if interstate:
    groups.append({'id':len(groups),'name':'I-240 / French Broad','wayIds':[c['way'] for c in interstate],'lon':round(sum(c['lon'] for c in interstate)/len(interstate),6),'lat':round(sum(c['lat'] for c in interstate)/len(interstate),6)})
way_group={w:g['id'] for g in groups for w in g['wayIds']}
if len(groups)<3:
    raise RuntimeError('Inspect crossing-candidates.json and select at least three explicit source names')

used=sorted({n for w in roads for n in w['nodes']})
index={n:i for i,n in enumerate(used)}
coords=np.array([nodes[n] for n in used])
edges=[]
display_roads=[]
for w in roads:
    t=w['tags']; ids=w['nodes']; kmh=speed(t)
    direction=t.get('oneway','yes' if t.get('junction')=='roundabout' or t['highway']=='motorway' else 'no')
    group=way_group.get(w['id'],-1)
    for a,b in zip(ids,ids[1:]):
        length=geod.inv(*nodes[a],*nodes[b])[2]
        if length<=0: continue
        minutes=length/(kmh*1000/60)
        if direction!='-1': edges.append([index[a],index[b],minutes,group])
        if direction not in ['yes','1','true']: edges.append([index[b],index[a],minutes,group])
    if t['highway'] not in ['residential','living_street']:
        display_roads.append({'coordinates':[[round(v,6) for v in nodes[n]] for n in ids], 'type':t['highway'], 'bridge':group})

# Keep only the largest weakly connected road component. Directed failures are
# retained and are reported as unreachable by the shortest-path model.
mat=coo_matrix((np.ones(len(edges)),([e[0] for e in edges],[e[1] for e in edges])),shape=(len(used),len(used))).tocsr()
_, labels=connected_components(mat,directed=True,connection='weak')
largest=Counter(labels).most_common(1)[0][0]
active=np.flatnonzero(labels==largest)
active_xy=np.array([project(*coords[i]) for i in active])
tree=cKDTree(active_xy)

blocks={}
with gzip.open(CACHE/'nc_xwalk.csv.gz','rt') as f:
    for row in csv.DictReader(f):
        lon,lat=float(row['blklondd']),float(row['blklatdd'])
        if CORE[0]<=lon<=CORE[2] and CORE[1]<=lat<=CORE[3]:
            blocks[row['tabblk2020']]={'lon':lon,'lat':lat,'jobs':0,'workers':0,'low':0,'middle':0,'high':0}
for filename, key, target in [('nc_wac.csv.gz','w_geocode','jobs'),('nc_rac.csv.gz','h_geocode','workers')]:
    with gzip.open(CACHE/filename,'rt') as f:
        for row in csv.DictReader(f):
            if row[key] in blocks:
                block=blocks[row[key]]; block[target]=int(row['C000'])
                if target=='workers':
                    for field,column in [('low','CE01'),('middle','CE02'),('high','CE03')]:block[field]=int(row[column])

cells={}
for block in blocks.values():
    if not block['workers'] and not block['jobs']:continue
    x,y=project(block['lon'],block['lat']); key=(math.floor(x/GRID),math.floor(y/GRID))
    c=cells.setdefault(key,{'jobs':0,'workers':0,'low':0,'middle':0,'high':0,'blocks':0})
    for v in ['jobs','workers','low','middle','high']:c[v]+=block[v]
    c['blocks']+=1
included=[]; excluded=[]
for (gx,gy),c in sorted(cells.items()):
    x,y=(gx+.5)*GRID,(gy+.5)*GRID
    distance,nearest=tree.query([x,y]); lon,lat=unproject(x,y)
    c.update(id=f'{gx}-{gy}',lon=round(lon,6),lat=round(lat,6),snapMeters=round(float(distance),1),node=int(active[nearest]),bounds=[[round(v,6) for v in unproject(xx,yy)] for xx,yy in [(gx*GRID,gy*GRID),((gx+1)*GRID,gy*GRID),((gx+1)*GRID,(gy+1)*GRID),(gx*GRID,(gy+1)*GRID)]])
    (included if distance<=750 else excluded).append(c)

# Collapse degree-two geometry nodes only when neither routing nor intervention
# identity changes. All snapped cells and selected bridge endpoints are kept.
from graph_contract import contract_graph
component_edges=[e for e in edges if labels[e[0]]==largest]
kept,remap,compressed=contract_graph(component_edges,{c['node'] for c in included})
for c in included:c['node']=remap[c['node']]
final_edges=[[a,b,round(t,7),g] for (a,b,g),t in sorted(compressed.items())]
# Independent full-geometry routing oracle checks compression and JS routing.
raw_min={}
for a,b,t,g in edges:
    key=(a,b);raw_min[key]=min(t,raw_min.get(key,float('inf')))
raw_matrix=coo_matrix((list(raw_min.values()),([k[0] for k in raw_min],[k[1] for k in raw_min])),shape=(len(used),len(used))).tocsr()
# Verify every included origin/destination, not just the downloadable sample.
all_targets=[c['node'] for c in included]
all_sources=[kept[n] for n in all_targets]
raw_od=dijkstra(raw_matrix,directed=True,indices=all_sources)[:,all_sources]
contracted_min={}
for a,b,t,g in final_edges:
    contracted_min[a,b]=min(t,contracted_min.get((a,b),float('inf')))
contracted_matrix=coo_matrix((list(contracted_min.values()),([k[0] for k in contracted_min],[k[1] for k in contracted_min])),shape=(len(kept),len(kept))).tocsr()
contracted_od=dijkstra(contracted_matrix,directed=True,indices=all_targets)[:,all_targets]
assert np.array_equal(np.isfinite(raw_od),np.isfinite(contracted_od)), 'Contraction changes route reachability'
finite=np.isfinite(raw_od)
max_error=float(np.max(np.abs(raw_od[finite]-contracted_od[finite])))
assert max_error < 0.00001, f'Contraction changes minimum travel time: {max_error} minutes'
contraction_check={'originDestinationPairs':int(raw_od.size),'finitePairs':int(finite.sum()),'maxAbsoluteMinutesError':max_error,'toleranceMinutes':0.00001,'method':'All included OD pairs: SciPy original geometry graph versus contracted published graph.'}
(OUT/'contraction-verification.json').write_text(json.dumps(contraction_check,indent=2)+'\n')
del raw_od,contracted_od
sample_cells=included[::max(1,len(included)//8)][:8]
source_nodes=[kept[c['node']] for c in sample_cells]
oracle_distances=dijkstra(raw_matrix,directed=True,indices=source_nodes)
oracle=[]
for i,source in enumerate(sample_cells):
    for target in included[::17]:
        value=float(oracle_distances[i,kept[target['node']]])
        oracle.append({'from':source['node'],'to':target['node'],'minutes':value if math.isfinite(value) else None})
(OUT/'routing-oracle.json').write_text(json.dumps({'method':'SciPy Dijkstra on original unsimplified OSM geometry graph; no connectors','pairs':oracle},separators=(',',':')))
manifest=json.loads((CACHE/'sources.json').read_text())
data={'schema':1,'title':'Asheville economic access','bounds':CORE,'gridMeters':GRID,'nodes':[[round(float(v),6) for v in coords[i]] for i in kept], 'edges':final_edges,'cells':included,'bridges':groups,'roads':display_roads,'rivers':[{'name':w.get('tags',{}).get('name','River'),'coordinates':[[round(v,6) for v in nodes[n]] for n in w['nodes']]} for w in rivers], 'provenance':manifest,'coverage':{'blocksInWindow':len(blocks),'includedCells':len(included),'excludedCells':len(excluded),'includedJobs':sum(c['jobs'] for c in included),'includedWorkers':sum(c['workers'] for c in included),'excludedJobs':sum(c['jobs'] for c in excluded),'excludedWorkers':sum(c['workers'] for c in excluded),'rawNodes':len(used),'connectedNodes':len(active),'graphNodes':len(kept),'directedEdges':len(final_edges),'maxSnapMeters':750},'assumptions':{'jobYear':2023,'jobType':'JT01 primary jobs','roadSnapshot':raw.get('osm3s',{}).get('timestamp_osm_base'),'speedMphFallback':speeds,'linkSpeedMph':20,'connectorSpeedMph':15,'boundary':'Only jobs and residents inside the study window; roads extend into a surrounding buffer. No external jobs, traffic, turn restrictions, flood hydraulics, damage functions or mode choice.'}}
encoded=json.dumps(data,separators=(',',':'))
(OUT/'asheville.json').write_text(encoded)
(OUT/'sources.json').write_text(json.dumps({'sources':manifest,'coverage':data['coverage'],'assumptions':data['assumptions']},indent=2))
print(json.dumps({'coverage':data['coverage'],'sha256':hashlib.sha256(encoded.encode()).hexdigest(),'bytes':len(encoded),'bridges':groups},indent=2))
