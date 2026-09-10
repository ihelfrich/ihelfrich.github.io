"""Build full St. Louis County + independent city OSM tiles from a cached PBF.

Run with uv run --no-project --with osmium --with shapely python
scripts/st-louis/build_region.py --data-dir <cache> --output public/st-louis/region
Add --download to acquire the Missouri source once. --validate checks saved tiles.
Only the statewide source is downloaded; all regional extraction is local.
"""
from __future__ import annotations

import argparse
import collections
import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import urllib.request

import osmium
from shapely import make_valid, from_wkb, prepare, set_precision
from shapely.errors import ShapelyError
from shapely.geometry import Polygon, LineString, Point, box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ORIGIN = [-90.193, 38.628]
TILE_SIZE = 2000
LON_SCALE = 111195 * math.cos(math.radians(ORIGIN[1]))
# Admission filter only; the final filter uses the assembled administrative areas.
SEARCH_BBOX = [-90.8, 38.35, -90.05, 38.95]
SOURCE_URL = 'https://download.geofabrik.de/north-america/us/missouri-latest.osm.pbf'
CATEGORIES = ('buildings', 'roads', 'parks', 'water')
MAJOR_ROADS = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link'}
EXCLUDED_ROADS = {'construction', 'proposed', 'abandoned', 'razed', 'platform', 'raceway'}
ANCHORS = {'St. Louis', 'Saint Louis', 'Clayton', 'Kirkwood', 'Ferguson', 'Chesterfield', 'Florissant', 'Wildwood', 'University City', 'Webster Groves', 'Ballwin', 'Creve Coeur', 'Maryland Heights', 'Hazelwood', 'Eureka', 'Manchester', 'Ladue', 'Des Peres', 'Oakville', 'Affton'}


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(',', ':'), allow_nan=False))


def project(lon, lat):
    return [(lon - ORIGIN[0]) * LON_SCALE, -(lat - ORIGIN[1]) * 111195]


def ring(coords):
    return [[round(x, 2), round(z, 2)] for x, z in list(coords)[:-1]]


def polygon_parts(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == 'Polygon':
        return [geom]
    return [p for g in getattr(geom, 'geoms', []) for p in polygon_parts(g)]


def line_parts(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == 'LineString':
        return [geom]
    return [p for g in getattr(geom, 'geoms', []) for p in line_parts(g)]


def category(tags):
    if tags.get('building') not in {None, 'no'} or tags.get('building:part') not in {None, 'no'}:
        return 'buildings'
    if tags.get('natural') == 'water' or tags.get('waterway') == 'riverbank':
        return 'water'
    if tags.get('leisure') in {'park', 'garden', 'nature_reserve', 'recreation_ground', 'golf_course', 'pitch', 'sports_centre'} or tags.get('landuse') in {'grass', 'meadow', 'forest', 'recreation_ground', 'village_green', 'cemetery'} or tags.get('natural') in {'wood', 'grassland', 'scrub'}:
        return 'parks'
    return None


def boundary_name(tags):
    if tags.get('boundary') != 'administrative' or tags.get('admin_level') != '6':
        return None
    name = tags.get('name', '').lower().replace('saint ', 'st. ')
    if name == 'st. louis county':
        return 'St. Louis County'
    if name in {'st. louis', 'city of st. louis', 'st. louis city'}:
        return 'St. Louis city'
    return None


def parse_height(value):
    if value is None:
        return None
    text = str(value).strip().lower().replace('′', "'").replace('″', '"')
    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*(?:\"|in)?", text)
    if match:
        result = float(match[1]) * .3048 + float(match[2] or 0) * .0254
    else:
        match = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres|ft|feet|foot)?', text)
        if not match:
            return None
        result = float(match[1]) * (.3048 if match[2] in {'ft', 'feet', 'foot'} else 1)
    return result if 0 < result < 1500 else None


def building_attributes(tags, stats):
    levels = parse_height(tags.get('building:levels')) or 0
    height = parse_height(tags.get('height'))
    kind = tags.get('building') or tags.get('building:part', 'yes')
    defaults = {'house': 6.4, 'detached': 6.4, 'semidetached_house': 6.4, 'terrace': 6.4, 'shed': 3.2, 'garage': 3.2, 'garages': 3.2, 'industrial': 6.4, 'apartments': 12.8, 'commercial': 12.8, 'retail': 6.4, 'roof': 3.2}
    source = 'tagged' if height else 'levels' if levels else 'default'
    height = height or levels * 3.2 or defaults.get(kind, 9.6)
    minimum = parse_height(tags.get('min_height')) or (parse_height(tags.get('building:min_level')) or 0) * 3.2
    if minimum >= height:
        stats['invalidMinimumHeightsReset'] += 1
        minimum = 0
    stats['height_' + source] += 1
    return dict(height=round(height, 3), heightSource=source, minHeight=round(minimum, 3), kind=kind, levels=levels, isPart=tags.get('building:part') not in {None, 'no'})


class Extractor(osmium.SimpleHandler):
    def __init__(self, path):
        super().__init__()
        self.file = path.open('w')
        self.stats = collections.Counter()
        self.boundaries = []
        self.places = []
        self.consumed = set()
        self.search = box(*SEARCH_BBOX)
        self.wkb = osmium.geom.WKBFactory()

    def record(self, oid, cat, tags, geom):
        self.file.write(json.dumps([oid, cat, tags, mapping(geom)], separators=(',', ':')) + '\n')
        self.stats['candidate_' + cat] += 1

    def node(self, node):
        if not node.location.valid():
            return
        name = node.tags.get('name')
        if name in ANCHORS and node.tags.get('place') and self.search.covers(Point(node.lon, node.lat)):
            x, z = project(node.lon, node.lat)
            self.places.append(dict(id='n' + str(node.id), name=name, x=round(x, 2), z=round(z, 2), kind=node.tags.get('place')))

    def relation(self, relation):
        tags = dict(relation.tags)
        if category(tags) and tags.get('type') == 'multipolygon':
            self.consumed.update('w' + str(m.ref) for m in relation.members if m.type == 'w' and m.role in {'outer', ''})

    def way(self, way):
        kind = way.tags.get('highway')
        if not kind or kind in EXCLUDED_ROADS or way.tags.get('area') == 'yes':
            return
        try:
            coords = [(n.lon, n.lat) for n in way.nodes]
            if len(coords) < 2:
                return
            line = LineString(coords)
            if not self.search.intersects(line):
                return
            self.record('w' + str(way.id), 'roads', dict(way.tags), LineString([project(*p) for p in coords]))
        except (osmium.InvalidLocationError, ValueError):
            self.stats['invalidRoadGeometry'] += 1

    def area(self, area):
        tags = dict(area.tags)
        cat = category(tags)
        boundary = boundary_name(tags)
        airport = tags.get('aeroway') == 'aerodrome' and ('Lambert' in tags.get('name', '') or tags.get('iata') == 'STL')
        if not cat and not boundary and not airport:
            return
        try:
            geographic = from_wkb(self.wkb.create_multipolygon(area))
            if not self.search.intersects(geographic):
                return
            pieces = [Polygon([project(x, y) for x, y in p.exterior.coords], [[project(x, y) for x, y in h.coords] for h in p.interiors]) for p in polygon_parts(geographic)]
            geom = unary_union([p if p.is_valid else make_valid(p) for p in pieces])
            oid = ('w' if area.from_way() else 'r') + str(area.orig_id())
            if boundary:
                self.boundaries.append(dict(id=oid, name=boundary, geometry=mapping(geom), tags=tags))
            if airport:
                point = geom.representative_point()
                self.places.append(dict(id=oid, name=tags.get('name', 'St. Louis Lambert International Airport'), x=round(point.x, 2), z=round(point.y, 2), kind='airport'))
            if cat:
                self.record(oid, cat, tags, geom)
        except (osmium.InvalidLocationError, ValueError, RuntimeError, ShapelyError):
            self.stats['invalidAreaGeometry'] += 1


def get_source(data_dir, download):
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / 'missouri-latest.osm.pbf'
    if not path.exists():
        if not download:
            raise SystemExit('Cached PBF missing; add --download to acquire the source.')
        with urllib.request.urlopen(SOURCE_URL, timeout=60) as response, path.with_suffix('.part').open('wb') as target:
            while chunk := response.read(1024 * 1024):
                target.write(chunk)
        path.with_suffix('.part').replace(path)
    meta_path = data_dir / 'source-manifest.json'
    if not meta_path.exists():
        reader = osmium.io.Reader(str(path))
        snapshot = reader.header().get('osmosis_replication_timestamp')
        reader.close()
        with path.open('rb') as source:
            digest = hashlib.file_digest(source, 'sha256').hexdigest()
        meta = dict(name='OpenStreetMap contributors / Geofabrik Missouri', url=SOURCE_URL, metadataUrl='https://download.geofabrik.de/north-america/us/missouri.html', retrievedAt=datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat(), osmSnapshotTimestamp=snapshot or None, license='ODbL 1.0', licenseUrl='https://www.openstreetmap.org/copyright', attribution='© OpenStreetMap contributors', sha256=digest, bytes=path.stat().st_size)
        write_json(meta_path, meta)
    return path, json.loads(meta_path.read_text())


def extract(data_dir, pbf, force):
    cache, metadata = data_dir / 'regional-candidates.jsonl', data_dir / 'regional-candidates-meta.json'
    if cache.exists() and metadata.exists() and not force:
        return cache, json.loads(metadata.read_text())
    handler = Extractor(cache.with_suffix('.part'))
    handler.apply_file(str(pbf), locations=True, idx='flex_mem')
    handler.file.close()
    if {b['name'] for b in handler.boundaries} != {'St. Louis County', 'St. Louis city'}:
        raise SystemExit('Both complete administrative boundaries required: ' + str([b['name'] for b in handler.boundaries]))
    cache.with_suffix('.part').replace(cache)
    meta = dict(boundaries=handler.boundaries, places=handler.places, consumed=sorted(handler.consumed), stats=handler.stats)
    write_json(metadata, meta)
    return cache, meta


def build(data_dir, output, source, cache, metadata):
    stats = collections.Counter(metadata['stats'])
    administrative = [(b, make_valid(shape(b['geometry']))) for b in metadata['boundaries']]
    region = unary_union([g for _, g in administrative])
    if not region.is_valid or region.area < 1.1e9:
        raise SystemExit('Invalid or implausibly small county + city boundary')
    prepare(region)
    consumed = set(metadata['consumed'])
    features = []
    with cache.open() as rows:
        for row in rows:
            oid, cat, tags, geometry = json.loads(row)
            if oid in consumed and cat != 'roads':
                stats['suppressedMultipolygonMemberWays'] += 1
                continue
            geom = shape(geometry)
            if not geom.is_valid:
                geom = make_valid(geom)
                stats['repairedGeometries'] += 1
            if not region.intersects(geom):
                continue
            # Buildings crossing a boundary retain their actual complete footprint.
            if cat != 'buildings' and not region.covers(geom):
                geom = geom.intersection(region)
            pieces = line_parts(geom) if cat == 'roads' else polygon_parts(geom)
            encoded_pieces = []
            for piece in pieces:
                if (piece.length if cat == 'roads' else piece.area) < 1:
                    stats['excludedTinyShapes'] += 1
                    continue
                piece = piece.simplify(.3 if cat == 'roads' else .25, preserve_topology=True)
                if cat == 'roads':
                    encoded_pieces.append(LineString([[round(x, 2), round(z, 2)] for x, z in piece.coords]))
                else:
                    encoded = Polygon(ring(piece.exterior.coords), [ring(h.coords) for h in piece.interiors])
                    if not encoded.is_valid:
                        encoded = make_valid(encoded)
                        stats['quantizationTopologyRepairs'] += 1
                    # Repaired intersections can add fractional coordinates. Snap
                    # once more using GEOS precision reduction, preserving validity.
                    encoded = set_precision(encoded, grid_size=.01)
                    encoded_pieces.extend(p for p in polygon_parts(encoded) if p.area >= 1)
            for i, piece in enumerate(encoded_pieces):
                features.append((oid + (':' + str(i) if len(encoded_pieces) > 1 else ''), cat, tags, piece))
    parts = [g for _, c, t, g in features if c == 'buildings' and t.get('building:part') not in {None, 'no'}]
    part_tree = STRtree(parts) if parts else None
    tiles = {}
    def ensure_tile(tx, tz):
        key = str(tx) + '_' + str(tz)
        grid = [tx * TILE_SIZE, tz * TILE_SIZE, (tx + 1) * TILE_SIZE, (tz + 1) * TILE_SIZE]
        return tiles.setdefault(key, dict(id=key, gridBounds=grid, bounds=grid[:], **{c: [] for c in CATEGORIES}))
    # Explicit empty edge/rural cells guarantee the tile grid covers both areas,
    # even where no features have been mapped in OSM.
    xmin, zmin, xmax, zmax = region.bounds
    for tx in range(math.floor(xmin / TILE_SIZE), math.floor(xmax / TILE_SIZE) + 1):
        for tz in range(math.floor(zmin / TILE_SIZE), math.floor(zmax / TILE_SIZE) + 1):
            if region.intersects(box(tx * TILE_SIZE, tz * TILE_SIZE, (tx + 1) * TILE_SIZE, (tz + 1) * TILE_SIZE)):
                ensure_tile(tx, tz)
    overview = dict(origin=ORIGIN, roads=[], parks=[], water=[], boundary=[ring(p.exterior.coords) for p in polygon_parts(region.simplify(8, preserve_topology=True))])
    for oid, cat, tags, geom in features:
        if cat == 'buildings' and tags.get('building:part') in {None, 'no'} and part_tree is not None:
            if any(geom.covers(parts[int(i)].representative_point()) and geom.intersection(parts[int(i)]).area / max(parts[int(i)].area, 1) > .9 for i in part_tree.query(geom)):
                stats['suppressedParentOutlines'] += 1
                continue
        centroid = geom.centroid
        tx, tz = math.floor(centroid.x / TILE_SIZE), math.floor(centroid.y / TILE_SIZE)
        key = str(tx) + '_' + str(tz)
        tile = ensure_tile(tx, tz)
        b = geom.bounds
        tile['bounds'] = [min(tile['bounds'][0], b[0]), min(tile['bounds'][1], b[1]), max(tile['bounds'][2], b[2]), max(tile['bounds'][3], b[3])]
        item = dict(id=oid, name=tags.get('name', ''))
        if cat == 'roads':
            item.update(points=[[round(x, 2), round(z, 2)] for x, z in geom.coords], kind=tags['highway'], bridge=tags.get('bridge', 'no') not in {'no', 'false', '0'}, tunnel=tags.get('tunnel', 'no') not in {'no', 'false', '0'}, layer=float(tags.get('layer', '0')) if re.fullmatch(r'-?\d+(?:\.\d+)?', tags.get('layer', '0')) else 0)
            if item['kind'] in MAJOR_ROADS:
                overview['roads'].append({**item, 'points': [[round(x, 1), round(z, 1)] for x, z in geom.simplify(10).coords]})
        else:
            item.update(polygon=ring(geom.exterior.coords), holes=[ring(h.coords) for h in geom.interiors])
            if cat == 'buildings':
                item.update(building_attributes(tags, stats))
            elif cat == 'water' and geom.area > 3000 or cat == 'parks' and geom.area > 40000:
                simple = geom.simplify(12, preserve_topology=True)
                overview[cat].append({**item, 'polygon': ring(simple.exterior.coords), 'holes': [ring(h.coords) for h in simple.interiors]})
        tile[cat].append(item)
        stats[cat] += 1
    output.mkdir(parents=True, exist_ok=True)
    tile_dir = output / 'tiles'
    tile_dir.mkdir(exist_ok=True)
    tile_meta = []
    for key, tile in sorted(tiles.items()):
        payload = {c: sorted(tile[c], key=lambda v: v['id']) for c in CATEGORIES}
        path = tile_dir / (key + '.json')
        write_json(path, payload)
        tile_meta.append(dict(id=key, url='/st-louis/region/tiles/' + key + '.json', bounds=[round(v, 2) for v in tile['bounds']], gridBounds=tile['gridBounds'], bytes=path.stat().st_size, **{c: len(payload[c]) for c in CATEGORIES}))
    # Remove only obsolete generated tiles inside the explicitly selected output.
    current = {t['id'] + '.json' for t in tile_meta}
    for old in tile_dir.glob('*.json'):
        if old.name not in current:
            old.unlink()
    write_json(output / 'overview.json', overview)
    places = [p for p in metadata['places'] if region.covers(Point(p['x'], p['z']))]
    places = sorted({p['name']: p for p in places}.values(), key=lambda p: p['name'])
    manifest = dict(version=1, source=source, origin=ORIGIN, units='meters', bounds=[round(v, 2) for v in region.bounds], tileSize=TILE_SIZE, tiles=tile_meta, places=places, boundary=[ring(p.exterior.coords) for p in polygon_parts(region.simplify(2, preserve_topology=True))], administrativeBoundaries=[dict(id=b['id'], name=b['name'], areaKm2=round(g.area / 1e6, 3), rings=[ring(p.exterior.coords) for p in polygon_parts(g.simplify(2, preserve_topology=True))]) for b, g in administrative], counts={**stats, 'tiles': len(tiles)}, overviewUrl='/st-louis/region/overview.json', overviewBytes=(output / 'overview.json').stat().st_size, totalTileBytes=sum(t['bytes'] for t in tile_meta), coverage=dict(scope='Full geographic extent of St. Louis County and independent St. Louis city, using valid mapped OSM features', buildingCompleteness='OSM mapping is not a complete inventory of every existing structure.', heights='Tagged heights retained; levels converted at 3.2 m/floor; remaining heights use documented building-kind defaults.', heightDefaultsMeters={'house': 6.4, 'shed_or_garage': 3.2, 'industrial_or_retail': 6.4, 'apartments_or_commercial': 12.8, 'other': 9.6}, geometry='Local equirectangular approximation matching downtown; x east, z south. Footprints simplified 0.25 m; roads 0.3 m. Non-buildings clipped to the administrative union.', tileOwnership='Each geometry assigned once by centroid. Tile bounds expand beyond gridBounds to enclose every owned geometry; use bounds for visibility. Multi-part source objects retain OSM IDs with numeric suffixes.', omittedRoadKinds=sorted(EXCLUDED_ROADS), graph='Regional tiles are visual exploration; walking graph remains downtown only.'))
    write_json(output / 'manifest.json', manifest)
    validate(output)
    write_json(data_dir / 'build-summary.json', {k: manifest[k] for k in ('bounds', 'counts', 'places', 'source', 'totalTileBytes', 'overviewBytes')})
    print(json.dumps(dict(tiles=len(tiles), counts=manifest['counts'], bounds=manifest['bounds'], totalTileBytes=manifest['totalTileBytes'], overviewBytes=manifest['overviewBytes'], places=len(places))))


def validate(output):
    manifest = json.loads((output / 'manifest.json').read_text())
    ids = {c: set() for c in CATEGORIES}
    counts = collections.Counter()
    for info in manifest['tiles']:
        tile = json.loads((output / 'tiles' / (info['id'] + '.json')).read_text())
        bounds = box(*info['bounds']).buffer(.02)
        for cat in CATEGORIES:
            assert len(tile[cat]) == info[cat], (info['id'], cat)
            for item in tile[cat]:
                assert item['id'] not in ids[cat], (cat, item['id'])
                ids[cat].add(item['id'])
                geom = LineString(item['points']) if cat == 'roads' else Polygon(item['polygon'], item['holes'])
                assert geom.is_valid and not geom.is_empty, (cat, item['id'], 'invalid')
                assert bounds.covers(geom), (info['id'], item['id'], 'out of bounds')
                if cat == 'buildings':
                    assert 0 < item['height'] < 1500 and 0 <= item['minHeight'] < item['height']
                    assert item['heightSource'] in {'tagged', 'levels', 'default'}
                counts[cat] += 1
    for cat in CATEGORIES:
        assert counts[cat] == manifest['counts'][cat], (cat, 'count mismatch')
    assert len(manifest['administrativeBoundaries']) == 2
    tile_coverage = unary_union([box(*tile['gridBounds']) for tile in manifest['tiles']]).buffer(.02)
    for boundary in manifest['administrativeBoundaries']:
        assert all(tile_coverage.covers(Polygon(r)) for r in boundary['rings']), (boundary['name'], 'uncovered boundary')
    assert {'Clayton', 'Kirkwood', 'Ferguson', 'Chesterfield', 'Florissant', 'Wildwood', 'University City'} <= {p['name'] for p in manifest['places']}
    assert any(p['kind'] == 'airport' for p in manifest['places'])
    print('Validation passed: unique IDs, valid geometries, reasonable heights, containing tile bounds, full boundary grid coverage, two administrative areas, required place anchors.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path)
    parser.add_argument('--output', type=Path, default=Path('public/st-louis/region'))
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--force-extract', action='store_true')
    parser.add_argument('--validate', action='store_true')
    args = parser.parse_args()
    if args.validate:
        validate(args.output)
        return
    if args.data_dir is None:
        parser.error('--data-dir required unless --validate')
    pbf, source = get_source(args.data_dir, args.download)
    cache, metadata = extract(args.data_dir, pbf, args.force_extract)
    build(args.data_dir, args.output, source, cache, metadata)


if __name__ == '__main__':
    main()
