"""Derive street-name anchors from the retained City + County OSM road tiles.

Stdlib only: python3 scripts/st-louis/build_street_labels.py
No network, new source acquisition, buildings, or estimated street names.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
from pathlib import Path

PRIORITIES = {'motorway': 0, 'trunk': 0, 'primary': 1, 'secondary': 2,
              'tertiary': 3, 'unclassified': 4, 'residential': 4,
              'living_street': 4, 'service': 5, 'pedestrian': 5, 'footway': 6,
              'cycleway': 6, 'path': 6}
TILE_SIZE = 2000


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    path.write_text(payload, encoding='utf-8')
    return len(payload.encode('utf-8'))


def anchors(road):
    name = road.get('name', '').strip()
    rank = PRIORITIES.get(road.get('kind'))
    if not name or len(name) > 160 or rank is None or road.get('tunnel'):
        return
    points = road.get('points', [])
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    length = sum(lengths)
    if not math.isfinite(length) or length < 12:
        return
    # Long roads get repeated anchors; short OSM way fragments are spatially
    # thinned below, so intersections do not multiply one road's name.
    count = max(1, math.ceil(length / (700 if rank <= 2 else 240)))
    segment, offset = 0, 0
    for i in range(count):
        distance = length * (i + .5) / count
        while segment < len(lengths) - 1 and offset + lengths[segment] < distance:
            offset += lengths[segment]
            segment += 1
        if not lengths[segment]:
            continue
        fraction = (distance - offset) / lengths[segment]
        a, b = points[segment:segment + 2]
        yield {'id': f"{road['id']}:{i}", 'name': name,
               'x': round(a[0] + fraction * (b[0] - a[0]), 1),
               'z': round(a[1] + fraction * (b[1] - a[1]), 1),
               'priority': rank, 'length': round(length, 1)}


def build(source, output):
    manifest_bytes = (source / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    candidates = []
    source_road_count = 0
    for tile in sorted(manifest['tiles'], key=lambda t: t['id']):
        data = json.loads((source / 'tiles' / f"{tile['id']}.json").read_text())
        source_road_count += len(data.get('roads', []))
        for road in data.get('roads', []):
            candidates.extend(anchors(road))
    candidates.sort(key=lambda a: (a['priority'], -a['length'], a['id']))
    selected, cells = [], collections.defaultdict(list)
    for anchor in candidates:
        spacing = 400 if anchor['priority'] <= 2 else 160
        cell = (math.floor(anchor['x'] / spacing), math.floor(anchor['z'] / spacing))
        key = anchor['name'].casefold()
        neighbors = [item for dx in (-1, 0, 1) for dz in (-1, 0, 1)
                     for item in cells[(key, cell[0] + dx, cell[1] + dz)]]
        if any(math.hypot(anchor['x'] - p['x'], anchor['z'] - p['z']) < spacing for p in neighbors):
            continue
        cells[(key, *cell)].append(anchor)
        selected.append({k: v for k, v in anchor.items() if k != 'length'})
    tiles = collections.defaultdict(list)
    for anchor in selected:
        tile_id = f"{math.floor(anchor['x'] / TILE_SIZE)}_{math.floor(anchor['z'] / TILE_SIZE)}"
        tiles[tile_id].append(anchor)
    index = []
    for tile_id, labels in sorted(tiles.items()):
        labels.sort(key=lambda a: (a['priority'], a['id']))
        x, z = map(int, tile_id.split('_'))
        size = write(output / 'tiles' / f'{tile_id}.json', {'version': 1, 'labels': labels})
        index.append({'id': tile_id, 'bounds': [x * TILE_SIZE, z * TILE_SIZE,
                     (x + 1) * TILE_SIZE, (z + 1) * TILE_SIZE], 'count': len(labels), 'bytes': size})
    overview = [a for a in selected if a['priority'] <= 2]
    overview_size = write(output / 'overview.json', {'version': 1, 'labels': overview})
    result = {'version': 1, 'origin': manifest['origin'], 'units': 'meters',
              'source': manifest['source'], 'sourceManifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
              'coverage': 'Named, mapped streets and paths in the retained City and County OSM extract; not a complete official street inventory.',
              'method': 'Along-road anchors, named-road priority and distance thinning; no building data included.',
              'tileSize': TILE_SIZE, 'tiles': index, 'overviewBytes': overview_size,
              'counts': {'sourceRoads': source_road_count, 'labels': len(selected), 'tiles': len(index), 'overview': len(overview)}}
    write(output / 'manifest.json', result)
    print(json.dumps({'counts': result['counts'], 'tileBytes': sum(t['bytes'] for t in index), 'overviewBytes': overview_size}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('public/st-louis/region'))
    parser.add_argument('--output', type=Path, default=Path('public/st-louis/street-labels'))
    args = parser.parse_args()
    build(args.source, args.output)
