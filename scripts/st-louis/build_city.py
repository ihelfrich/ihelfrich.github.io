"""Deterministic local OSM build. uv run --no-project --with shapely python build_city.py"""
import collections, datetime, json, math, re
from pathlib import Path
import xml.etree.ElementTree as ET
ORIGIN=[-90.193,38.628]
BBOX=[-90.215,38.615,-90.17,38.646]

def project(lon,lat):
    return [(lon-ORIGIN[0])*111195*math.cos(math.radians(ORIGIN[1])),-(lat-ORIGIN[1])*111195]

def parse_height(value):
    if value is None: return None
    text=str(value).strip().lower().replace('′',"'").replace('″','"')
    m=re.fullmatch(r"(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*(?:\"|in)?",text)
    if m: result=float(m[1])*.3048+float(m[2] or 0)*.0254
    else:
        m=re.fullmatch(r'(\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres|ft|feet|foot)?',text)
        if not m: return None
        result=float(m[1])*(.3048 if m[2] in {'ft','feet','foot'} else 1)
    return result if 0<result<1500 else None

def walking_allowed(tags):
    h=tags.get('highway')
    if h not in {'residential','living_street','service','pedestrian','footway','path','steps','track','unclassified','tertiary','tertiary_link','secondary','secondary_link','primary','primary_link','cycleway','road'}: return False
    if tags.get('foot') in {'no','private','use_sidepath'} or tags.get('access') in {'no','private'}: return False
    if h=='cycleway' and tags.get('foot') not in {'yes','designated','permissive'}: return False
    return tags.get('area')!='yes'

def stitch_rings(segments):
    pending=[list(s) for s in segments if len(s)>=2]; rings=[]; unresolved=0
    while pending:
        chain=pending.pop(0)
        while chain[0]!=chain[-1]:
            found=False
            for i,s in enumerate(pending):
                if chain[-1]==s[0]: chain.extend(s[1:])
                elif chain[-1]==s[-1]: chain.extend(reversed(s[:-1]))
                elif chain[0]==s[-1]: chain=s[:-1]+chain
                elif chain[0]==s[0]: chain=list(reversed(s[1:]))+chain
                else: continue
                pending.pop(i); found=True; break
            if not found: break
        if chain[0]==chain[-1] and len(set(chain))>=3: rings.append(chain)
        else: unresolved+=1
    return rings,unresolved

def category(tags):
    if tags.get('building') not in {None,'no'} or tags.get('building:part') not in {None,'no'}: return 'buildings'
    if tags.get('natural')=='water' or tags.get('waterway')=='riverbank': return 'water'
    if tags.get('leisure') in {'park','garden','nature_reserve','recreation_ground'} or tags.get('landuse') in {'grass','meadow','forest','recreation_ground','village_green'} or tags.get('natural') in {'wood','grassland','scrub'}: return 'parks'
    return None

def node_passable(tags):
    if tags.get('access') in {'no','private'} or tags.get('foot') in {'no','private'}: return False
    return tags.get('barrier') not in {'wall','fence','retaining_wall','hedge','block'}

def build_graph(nodes,ways):
    positions=[]; ids=[]; edges=[]; indices={}; seen=set(); directional=0
    for way in ways.values():
        tags,refs=way['tags'],way['refs']
        if not walking_allowed(tags): continue
        if tags.get('oneway:foot') in {'yes','1','-1'} or tags.get('foot:forward') in {'no','private'} or tags.get('foot:backward') in {'no','private'}:
            directional+=1; continue
        for a,b in zip(refs,refs[1:]):
            if a not in nodes or b not in nodes: continue
            if not node_passable(nodes[a]['tags']) or not node_passable(nodes[b]['tags']): continue
            for nid in (a,b):
                if nid not in indices:
                    indices[nid]=len(positions); ids.append(nid)
                    positions.append(project(nodes[nid]['lon'],nodes[nid]['lat']))
            ia,ib=indices[a],indices[b]; key=tuple(sorted((ia,ib)))
            distance=math.dist(positions[ia],positions[ib])
            if distance>0 and key not in seen: edges.append([ia,ib,round(distance,3)]); seen.add(key)
    return {'nodes':positions,'edges':edges},ids,directional

def relation_polygons(rel,ways,nodes):
    from shapely.geometry import Polygon
    outer=[]; inner=[]
    for m in rel['members']:
        if m['type']!='way':
            if m['role'] in {'outer','inner'}: return [],'unsupported polygon member'
            continue
        if m['role'] not in {'outer','inner',''}: continue
        way=ways.get(m['ref'])
        if not way or any(n not in nodes for n in way['refs']): return [],'missing member or node'
        (inner if m['role']=='inner' else outer).append(way['refs'])
    outers,bad_o=stitch_rings(outer); inners,bad_i=stitch_rings(inner)
    if bad_o or bad_i or not outers: return [],'unclosed polygon rings'
    def coords(refs): return [project(nodes[n]['lon'],nodes[n]['lat']) for n in refs]
    shells=[Polygon(coords(r)) for r in outers]; assigned=[[] for _ in shells]
    for r in inners:
        hole=Polygon(coords(r)); candidates=[i for i,s in enumerate(shells) if s.covers(hole)]
        if not candidates: return [],'inner ring not covered by outer'
        assigned[min(candidates,key=lambda i:shells[i].area)].append(coords(r))
    return [Polygon(s.exterior.coords,holes=assigned[i]) for i,s in enumerate(shells)],None

def load_osm(path):
    root=ET.parse(path).getroot(); nodes={}; ways={}; relations={}
    for el in root:
        tags={t.attrib['k']:t.attrib['v'] for t in el.findall('tag')}; oid=el.get('id')
        if el.tag=='node': nodes[oid]={'lon':float(el.get('lon')),'lat':float(el.get('lat')),'tags':tags}
        elif el.tag=='way': ways[oid]={'refs':[nd.get('ref') for nd in el.findall('nd')],'tags':tags}
        elif el.tag=='relation': relations[oid]={'members':[dict(m.attrib) for m in el.findall('member')],'tags':tags}
    return nodes,ways,relations,root.find('meta')

def main():
    from shapely import make_valid
    from shapely.geometry import Polygon,LineString,box
    from shapely.strtree import STRtree
    import argparse
    parser=argparse.ArgumentParser(description='Build the city snapshot from saved OSM XML and its source manifest.')
    parser.add_argument('--data-dir',type=Path,required=True,help='Directory containing source.osm and source-manifest.json; receives generated outputs')
    base=parser.parse_args().data_dir
    nodes,ways,relations,meta=load_osm(base/'source.osm')
    manifest=json.loads((base/'source-manifest.json').read_text())
    manifest['osmSnapshotTimestamp']=meta.get('osm_base') if meta is not None else None
    manifest['version']='osm-'+(manifest['osmSnapshotTimestamp'] or manifest['retrievedAt'])[:10]
    manifest['buildTimestamp']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    manifest['inputCounts']={'nodes':len(nodes),'ways':len(ways),'relations':len(relations)}
    stats=collections.Counter(); issues=[]; shapes=[]; consumed=set()
    for rid,rel in relations.items():
        cat=category(rel['tags'])
        if not cat or rel['tags'].get('type')!='multipolygon': continue
        polygons,error=relation_polygons(rel,ways,nodes)
        consumed.update(m['ref'] for m in rel['members'] if m['type']=='way')
        if error:
            stats['unresolvedRelations']+=1; issues.append({'id':'r'+rid,'category':cat,'reason':error}); continue
        stats['resolvedRelations']+=1
        shapes.extend(('r'+rid+(':'+str(i) if len(polygons)>1 else ''),cat,rel['tags'],poly) for i,poly in enumerate(polygons))
    for wid,way in ways.items():
        cat=category(way['tags']); refs=way['refs']
        if not cat or wid in consumed: continue
        if len(refs)<4 or refs[0]!=refs[-1] or any(n not in nodes for n in refs): stats['excludedOpenOrMissingWays']+=1; continue
        shapes.append(('w'+wid,cat,way['tags'],Polygon([project(nodes[n]['lon'],nodes[n]['lat']) for n in refs])))
    xmin,zmax=project(BBOX[0],BBOX[1]); xmax,zmin=project(BBOX[2],BBOX[3])
    display_box=box(xmin,zmin,xmax,zmax)
    validated=[]
    for oid,cat,tags,poly in shapes:
        if not poly.is_valid: stats['repairedGeometries']+=1; poly=make_valid(poly)
        if cat=='water' and not display_box.covers(poly):
            stats['waterClippedToDisplayBbox']+=1; poly=poly.intersection(display_box)
        pieces=[poly] if poly.geom_type=='Polygon' else [p for p in getattr(poly,'geoms',[]) if p.geom_type=='Polygon']
        if not pieces: stats['excludedInvalidGeometries']+=1
        for pi,piece in enumerate(pieces):
            if piece.area<1 or not piece.is_valid: stats['excludedTinyOrInvalidGeometries']+=1; continue
            validated.append((oid+(':'+str(pi) if len(pieces)>1 else ''),cat,tags,piece.simplify(.25,preserve_topology=True)))
    parts=[s[3] for s in validated if s[1]=='buildings' and s[2].get('building:part') not in {None,'no'}]
    part_tree=STRtree(parts) if parts else None
    city={'origin':ORIGIN,'units':'meters','bbox':BBOX,**{k:[] for k in ('buildings','roads','parks','water','trees','railway','pois')}}
    def ring(coords): return [[round(x,2),round(z,2)] for x,z in list(coords)[:-1]]
    for oid,cat,tags,poly in validated:
        is_part=tags.get('building:part') not in {None,'no'}
        if cat=='buildings' and not is_part and part_tree is not None:
            if any(poly.covers(parts[int(i)].representative_point()) and poly.intersection(parts[int(i)]).area/max(parts[int(i)].area,1)>.90 for i in part_tree.query(poly)):
                stats['suppressedParentOutlines']+=1; continue
        item={'id':oid,'name':tags.get('name',''),'polygon':ring(poly.exterior.coords),'holes':[ring(r.coords) for r in poly.interiors]}
        if cat=='buildings':
            level=parse_height(tags.get('building:levels')) or 0; height=parse_height(tags.get('height'))
            kind=tags.get('building') or tags.get('building:part','yes')
            defaults={'house':6.4,'detached':6.4,'semidetached_house':6.4,'terrace':6.4,'shed':3.2,'garage':3.2,'garages':3.2,'industrial':6.4,'apartments':12.8,'commercial':12.8,'retail':6.4,'roof':3.2}
            source='tagged' if height else 'levels' if level else 'default'
            height=height or level*3.2 or defaults.get(kind,9.6)
            minimum=parse_height(tags.get('min_height')) or (parse_height(tags.get('building:min_level')) or 0)*3.2
            item.update(height=round(height,3),heightSource=source,levels=level,kind=kind,roof=tags.get('roof:shape','unknown'),minHeight=round(minimum,3),isPart=is_part)
            stats['height_'+source]+=1
        city[cat].append(item)
    for wid,way in ways.items():
        tags,refs=way['tags'],way['refs']; coords=[project(nodes[n]['lon'],nodes[n]['lat']) for n in refs if n in nodes]
        if len(coords)<2 or len(coords)!=len(refs): continue
        if 'highway' in tags and tags.get('highway') not in {'construction','proposed'}:
            line=LineString(coords).simplify(.3,preserve_topology=True)
            city['roads'].append({'id':'w'+wid,'kind':tags['highway'],'name':tags.get('name',''),'points':[[round(x,2),round(z,2)] for x,z in line.coords],'bridge':tags.get('bridge','no') not in {'no','false','0'},'tunnel':tags.get('tunnel','no') not in {'no','false','0'},'layer':float(tags.get('layer','0')) if re.fullmatch(r'-?\d+(?:\.\d+)?',tags.get('layer','0')) else 0})
        if tags.get('railway') in {'rail','light_rail','tram','subway'}: city['railway'].append({'id':'w'+wid,'points':[[round(x,2),round(z,2)] for x,z in coords],'bridge':tags.get('bridge','no') not in {'no','false','0'},'tunnel':tags.get('tunnel','no') not in {'no','false','0'},'layer':float(tags.get('layer','0')) if re.fullmatch(r'-?\d+(?:\.\d+)?',tags.get('layer','0')) else 0})
    graph,node_ids,directional=build_graph(nodes,ways)
    city['graph']={'nodes':[[round(x,3),round(z,3)] for x,z in graph['nodes']],'edges':graph['edges']}
    stats['excludedDirectionalWalkingWays']=directional
    buckets=collections.defaultdict(list)
    for i,(x,z) in enumerate(graph['nodes']): buckets[(math.floor(x/100),math.floor(z/100))].append(i)
    def snap(x,z):
        bx,bz=math.floor(x/100),math.floor(z/100)
        candidates=[i for dx in (-1,0,1) for dz in (-1,0,1) for i in buckets[(bx+dx,bz+dz)]]
        if not candidates: return None,None
        index=min(candidates,key=lambda i:math.dist((x,z),graph['nodes'][i])); distance=math.dist((x,z),graph['nodes'][index])
        return (index,round(distance,2)) if distance<=100 else (None,None)
    def poi_kind(tags):
        if not tags.get('name'): return None
        if tags['name']=='St. Louis Union Station': return 'landmark'
        if tags.get('tourism') in {'museum','attraction','gallery','viewpoint','artwork'}: return tags['tourism']
        if tags.get('amenity') in {'cafe','restaurant','library','theatre'}: return tags['amenity']
        if tags.get('leisure') in {'park','garden'}: return tags['leisure']
        return None
    poi_candidates=[]
    for nid,node in nodes.items():
        x,z=project(node['lon'],node['lat'])
        if node['tags'].get('natural')=='tree': city['trees'].append([round(x,2),round(z,2)])
        kind=poi_kind(node['tags'])
        if kind: poi_candidates.append(('n'+nid,node['tags']['name'],kind,x,z))
    poi_shapes={}
    for oid,cat,tags,poly in validated:
        source_id=oid.split(':')[0]
        if source_id not in poi_shapes or poly.area>poi_shapes[source_id][3].area:
            poi_shapes[source_id]=(source_id,cat,tags,poly)
    for oid,cat,tags,poly in poi_shapes.values():
        kind=poi_kind(tags)
        if kind:
            point=poly.representative_point(); poi_candidates.append((oid,tags['name'],kind,point.x,point.y))
    seen_pois=set()
    for oid,name,kind,x,z in poi_candidates:
        key=(name.lower(),round(x/20),round(z/20))
        if key in seen_pois: continue
        seen_pois.add(key); index,distance=snap(x,z)
        if index is None: stats['poisExcludedBeyond100m']+=1; continue
        city['pois'].append({'id':oid,'name':name,'kind':kind,'x':round(x,2),'z':round(z,2),'nodeIndex':index,'snapMeters':distance,'snapType':'nearest-node-unverified-entrance','pointSource':'osm-node' if oid.startswith('n') else 'polygon-representative-point','featured':name in {'Gateway Arch','Old Courthouse','Citygarden','St. Louis Union Station','Kiener Plaza'}})
    city['pois'].sort(key=lambda p:(not p['featured'],p['name'].lower(),p['id']))
    manifest['outputCounts']={k:len(city[k]) for k in ('buildings','roads','parks','water','trees','railway','pois')}
    manifest['outputCounts'].update(graphNodes=len(graph['nodes']),graphEdges=len(graph['edges']))
    manifest['validationCounts']=dict(stats); manifest['unresolvedGeometryDetails']=issues
    manifest['heightDefaultsMeters']={'house':6.4,'shed_or_garage':3.2,'industrial_or_retail':6.4,'apartments_or_commercial':12.8,'other':9.6}
    manifest['limitations']=[
        'The walking graph is a bounded extract; routes and amenity counts near its boundary may be truncated.',
        'Complete intersecting OSM ways can extend beyond the requested bbox; water polygons are clipped to the display bbox.',
        'Mapped POIs are incomplete. Nearest-node snaps do not establish traversable entrances or cross-barrier connections.',
        'Walking edges preserve shared OSM node identity. Geometric crossings alone do not connect paths.',
        'No traffic, transit vehicles, jobs, observed pedestrian flows or live measurements are present.',
        'Height tags are source assertions. Levels are multiplied by 3.2 m. Missing heights use explicit display defaults.',
        'Incomplete multipolygon relations and their member ways are excluded.',
        'Walking times are not supplied. Any speed or travel-time claim needs a separate model.',
        'Conditional access, schedules, stairs accessibility, temporary closures and routing across open pedestrian areas are unmodeled.',
        'Asymmetric pedestrian restrictions are excluded because graph edges are bidirectional.']
    city['source']={k:manifest.get(k) for k in ('source','sourceUrl','retrievedAt','osmSnapshotTimestamp','version','bbox','license','attribution','licenseUrl')}
    city['assumptions']={'heightPerLevelMeters':3.2,'defaultHeightMeters':9.6,'graphEdges':'bidirectional','poiSnapMaxMeters':100,'poiSnapMeaning':'proximity only; entrance unverified','geometrySimplificationMeters':.25,'boundaryLimited':True,'live':False}
    (base/'city.json').write_text(json.dumps(city,separators=(',',':')))
    manifest['cityJsonBytes']=(base/'city.json').stat().st_size
    (base/'source-manifest.json').write_text(json.dumps(manifest,indent=2))
    (base/'graph-osm-node-ids.json').write_text(json.dumps(node_ids))
    (base/'REPORT.md').write_text('# St. Louis scene data build\n\nSource: '+manifest['sourceUrl']+'\n\nRetrieved: '+manifest['retrievedAt']+'\n\nAttribution: © OpenStreetMap contributors; ODbL. https://www.openstreetmap.org/copyright\n\n## Counts\n\n```json\n'+json.dumps({'output':manifest['outputCounts'],'validation':dict(stats),'bytes':manifest['cityJsonBytes']},indent=2)+'\n```\n\n## Contract\n\nOrigin [-90.193,38.628]; local meters; x east, z south. Polygon rings are open arrays; holes are separate rings. Building height is total above-ground height; minHeight is the bottom of an elevated part (render minHeight to height). levels=0 means untagged; roof=unknown means no roof-shape tag. Graph edges [i,j,distanceMeters] are bidirectional. nodeIndex associates a POI with its nearest graph node within 100 m; snapMeters is separate and does not create an edge or verify an entrance. Roads preserve bridge/tunnel/layer tags.\n\n## Limits\n\n'+'\n'.join('- '+v for v in manifest['limitations'])+'\n\n## Exclusions\n\n```json\n'+json.dumps(issues,indent=2)+'\n```\n')
    print(json.dumps({'counts':manifest['outputCounts'],'validation':dict(stats),'bytes':manifest['cityJsonBytes']}))

if __name__=='__main__': main()
