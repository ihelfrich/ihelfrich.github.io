"""Dataset-level checks, including failures that drove geometry cropping and IDs."""
import argparse,json,math,collections,sys
from pathlib import Path
from shapely.geometry import Polygon
from build_city import project,BBOX
parser=argparse.ArgumentParser(description='Validate a processed St. Louis city snapshot.')
parser.add_argument('--data-dir',type=Path,required=True,help='Directory containing city.json; receives validation-result.json.')
base=parser.parse_args().data_dir.resolve()
j=json.loads((base/'city.json').read_text()); errors=[]; stats={}
for category in ('buildings','parks','water','roads','railway','pois'):
    ids=[p['id'] for p in j[category]]
    duplicate=[k for k,v in collections.Counter(ids).items() if v>1]
    if duplicate: errors.append(f'{category}: duplicate ids {duplicate[:5]}')
for cat in ('buildings','parks','water'):
    for item in j[cat]:
        p=Polygon(item['polygon'],holes=item['holes'])
        if not p.is_valid or p.area<=0: errors.append(f'{cat}: invalid polygon {item["id"]}')
xmin,zmax=project(BBOX[0],BBOX[1]); xmax,zmin=project(BBOX[2],BBOX[3])
for item in j['water']:
    if any(not(xmin-.02<=x<=xmax+.02 and zmin-.02<=z<=zmax+.02) for x,z in item['polygon']):
        errors.append(f'water outside display bbox: {item["id"]}')
for item in j['buildings']:
    if not(item['height']>item['minHeight']>=0): errors.append(f'building invalid height: {item["id"]}')
for cat in ('roads','railway'):
    for item in j[cat]:
        if not isinstance(item['bridge'],bool) or not isinstance(item['tunnel'],bool) or not isinstance(item['layer'],(int,float)):
            errors.append(f'{cat} bridge/tunnel/layer type: {item["id"]}')
positions=j['graph']['nodes']; adjacency=[[] for _ in positions]
for a,b,distance in j['graph']['edges']:
    if not (0<=a<len(positions) and 0<=b<len(positions)):
        errors.append('graph invalid node index'); continue
    if abs(distance-math.dist(positions[a],positions[b]))>.003: errors.append('graph edge length mismatch')
    adjacency[a].append(b); adjacency[b].append(a)
components={}; sizes=[]
for i in range(len(positions)):
    if i in components: continue
    cid=len(sizes); stack=[i]; components[i]=cid; count=0
    while stack:
        n=stack.pop(); count+=1
        for neighbor in adjacency[n]:
            if neighbor not in components: components[neighbor]=cid; stack.append(neighbor)
    sizes.append(count)
largest=max(range(len(sizes)),key=lambda c:sizes[c])
for p in j['pois']:
    idx=p['nodeIndex']
    if not (0<=idx<len(positions)): errors.append(f'POI invalid node index {p["id"]}'); continue
    actual=math.dist((p['x'],p['z']),positions[idx])
    if actual>100.02 or abs(actual-p['snapMeters'])>.02: errors.append(f'POI snap distance mismatch {p["id"]}')
stats.update(components=len(sizes),largestComponentNodes=sizes[largest],largestComponentShare=round(sizes[largest]/len(positions),4),poisOnLargestComponent=sum(components[p['nodeIndex']]==largest for p in j['pois']))
stats['landmarks']=[{'id':p['id'],'name':p['name'],'componentNodes':sizes[components[p['nodeIndex']]],'snapMeters':p['snapMeters']} for p in j['pois'] if p['name'] in {'Gateway Arch','Old Courthouse','Citygarden','Union Station','St. Louis Union Station','Kiener Plaza'}]
result={'passed':not errors,'errorCount':len(errors),'errors':errors[:30],'stats':stats}
(base/'validation-result.json').write_text(json.dumps(result,indent=2)); print(json.dumps(result,indent=2))
sys.exit(bool(errors))
