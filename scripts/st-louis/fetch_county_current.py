"""Freeze, verify and stage allowlisted current County tax-roll parcel records.

Run: uv run --no-project --with shapely python scripts/st-louis/fetch_county_current.py
  --cache NEW_PATH --output NEW_STAGING_PATH --metadata PATH --catalog PATH
TAXYR is a tax year, never an inferred assessment date. No owner/mail fields.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
import urllib.parse

from shapely.geometry import box, mapping, shape

BASE = 'https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0'
CATALOG = 'https://www.arcgis.com/home/item.html?id=fd4893ca99244279adb2ffa206e09ec7'
FIELDS = ','.join([
    'OBJECTID', 'LOCATOR', 'TAXYR', 'PROP_ADD', 'PROP_ZIP', 'MUNICIPALITY',
    'LUCODE', 'LUC', 'LANDUSE2', 'LANDUSE3', 'PROPCLASS', 'LIVUNIT',
    'YEARBLT', 'RESQFT', 'ACRES', 'TOTASSMT', 'TOTAPVAL', 'ASSTLANDVAL',
    'ASSTIMPVAL', 'APPLANDVAL', 'APPIMPVAL', 'ZONING', 'MUNI_ZONING',
    'TAXCODE', 'SCHOOL_DISTRICT', 'FIRE_DISTRICT', 'LIBRARY_DISTRICT',
    'SUBDIVISION', 'DEEDBKPG', 'DEEDTYPE', 'RECDATEDAILY', 'LOTDIM',
    'LOTFRONT', 'LOTDEPTH', 'LOTNUM', 'BLOCKNUM',
])
CENTER = [-90.35418, 38.686435]


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(',', ':'), ensure_ascii=False))


def number(value, positive=False):
    return value if (isinstance(value, (int, float)) and not isinstance(value, bool)
                     and math.isfinite(value) and (value > 0 if positive else value >= 0)) else None


def text(value):
    return str(value).strip() if value is not None and str(value).strip() else None


def main():
    parser = argparse.ArgumentParser()
    for name in ('cache', 'output', 'metadata', 'catalog'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists() or args.cache.exists():
        raise ValueError('Use new staging and cache directories; prior snapshots cannot be silently reused.')
    metadata = json.loads(args.metadata.read_text())
    catalog = json.loads(args.catalog.read_text())
    available = {f['name'] for f in metadata['fields']}
    if not set(FIELDS.split(',')).issubset(available):
        raise ValueError('Source schema does not contain every allowlisted field')
    args.cache.mkdir(parents=True)
    started = datetime.now(timezone.utc).isoformat()

    def get(name, params):
        parameters = urllib.parse.urlencode({'f': 'json', **params})
        # Use the same standard Node GET client verified against the public service.
        # No cookies, authorization headers, proxies or access workarounds are added.
        request = BASE + '/query?' + parameters
        client = '''
          import fs from 'node:fs';
          const url=JSON.parse(fs.readFileSync(0,'utf8'));
          const response=await fetch(url,{signal:AbortSignal.timeout(40000)});
          if(!response.ok) throw Error(`Source returned HTTP ${response.status}`);
          const chunks=[];let size=0;
          for await(const chunk of response.body){
            size+=chunk.length;if(size>12000000)throw Error('Response exceeds page budget');
            chunks.push(chunk);
          }
          process.stdout.write(Buffer.concat(chunks));
        '''
        raw = subprocess.run(['node', '--input-type=module', '-e', client],
                             input=json.dumps(request).encode(), capture_output=True,
                             timeout=50, check=True).stdout
        if len(raw) > 12_000_000:
            raise ValueError('Source response exceeds bounded page budget')
        data = json.loads(raw)
        if data.get('error'):
            raise ValueError(f'Source rejected {name}: {data["error"].get("message")}')
        write(args.cache / (name + '.json'), data)
        return data

    scopes = {
        'overland': {'where': "MUNICIPALITY = 'OVERLAND'"},
        'page-i170': {'where': '1=1', 'geometry': ','.join(map(str, CENTER)),
                     'geometryType': 'esriGeometryPoint', 'inSR': 4326, 'distance': 2000,
                     'units': 'esriSRUnit_Meter', 'spatialRel': 'esriSpatialRelIntersects'},
    }

    def scope_ids(prefix):
        result = {}
        for key, query in scopes.items():
            values = get(prefix + key + '-ids', {**query, 'returnIdsOnly': 'true'})['objectIds']
            count = get(prefix + key + '-count', {**query, 'returnCountOnly': 'true'})['count']
            if len(set(values)) != count or len(values) != count:
                raise ValueError(f'Incomplete source identities in {key}')
            result[key] = set(values)
        return result

    ids = scope_ids('start-')
    selected = sorted(set.union(*ids.values()))
    print(json.dumps({'frozenScopeCounts': {k: len(v) for k, v in ids.items()},
                      'uniqueRecords': len(selected)}), flush=True)
    pages = [selected[i:i + 400] for i in range(0, len(selected), 400)]

    def page(pair):
        n, batch = pair
        data = get(f'features-{n:03d}', {'f': 'geojson', 'objectIds': ','.join(map(str, batch)),
                   'outFields': FIELDS, 'returnGeometry': 'true', 'outSR': 4326})
        features = data.get('features', [])
        if (data.get('exceededTransferLimit') or len(features) != len(batch)
                or {f['properties']['OBJECTID'] for f in features} != set(batch)):
            raise ValueError(f'Incomplete or duplicate geometry page {n}')
        return features

    seen, records, tiles, years, invalid = set(), [], {}, {}, 0
    with ThreadPoolExecutor(max_workers=2) as pool:
        for features in pool.map(page, enumerate(pages), buffersize=2):
            for feature in features:
                a = feature['properties']
                oid, locator = a['OBJECTID'], text(a['LOCATOR'])
                if oid in seen or not locator:
                    raise ValueError('Duplicate or absent source identity')
                seen.add(oid)
                geom = shape(feature['geometry'])
                if geom.is_empty or geom.geom_type not in ('Polygon', 'MultiPolygon'):
                    raise ValueError('Missing or unsupported parcel geometry')
                bounds = list(geom.bounds)
                if not all(math.isfinite(v) for v in bounds) or not (-91 < bounds[0] < -90 and 38 < bounds[1] < 40):
                    raise ValueError('Unexpected projected geometry; expected local WGS84')
                point = geom.representative_point()
                record_key = f'st-louis-county-current:{locator}:{oid}'
                tax_year, acres = number(a.get('TAXYR'), True), number(a.get('ACRES'), True)
                year_key = str(tax_year) if tax_year is not None else 'unknown'
                years[year_key] = years.get(year_key, 0) + 1
                props = {
                    'jurisdiction': 'st-louis-county', 'parcelKey': f'st-louis-county:{locator}',
                    'recordKey': record_key, 'parcelId': locator, 'handle': locator,
                    'sourceObjectId': oid, 'address': text(a.get('PROP_ADD')) or '',
                    'municipality': text(a.get('MUNICIPALITY')), 'postalCode': text(a.get('PROP_ZIP')),
                    'taxYear': tax_year, 'assessmentYear': None, 'sourceRecordDate': None,
                    'assessedValueUSD': number(a.get('TOTASSMT')),
                    'assessorAppraisedValueUSD': number(a.get('TOTAPVAL')),
                    'assessedLandUSD': number(a.get('ASSTLANDVAL')),
                    'assessedImprovementsUSD': number(a.get('ASSTIMPVAL')),
                    'appraisedLandUSD': number(a.get('APPLANDVAL')),
                    'appraisedImprovementsUSD': number(a.get('APPIMPVAL')),
                    'areaSqFt': acres * 43560 if acres is not None else None,
                    'propertyClass': text(a.get('PROPCLASS')), 'landUseCode': text(a.get('LUCODE')),
                    'landUseDetailCode': text(a.get('LUC')), 'landUse': text(a.get('LANDUSE2')),
                    'additionalLandUseCode': number(a.get('LANDUSE3')),
                    'dwellingUnits': number(a.get('LIVUNIT')), 'yearBuilt': number(a.get('YEARBLT'), True),
                    'livingAreaSqFt': number(a.get('RESQFT'), True), 'zoning': text(a.get('ZONING')),
                    'municipalZoning': text(a.get('MUNI_ZONING')), 'taxCode': text(a.get('TAXCODE')),
                    'schoolDistrict': text(a.get('SCHOOL_DISTRICT')),
                    'fireDistrict': text(a.get('FIRE_DISTRICT')), 'libraryDistrict': text(a.get('LIBRARY_DISTRICT')),
                    'subdivision': text(a.get('SUBDIVISION')), 'deedBookPage': text(a.get('DEEDBKPG')),
                    'deedType': text(a.get('DEEDTYPE')), 'recordingDateRaw': text(a.get('RECDATEDAILY')),
                    'lotDimensions': text(a.get('LOTDIM')), 'lotFrontageRaw': text(a.get('LOTFRONT')),
                    'lotDepthRaw': text(a.get('LOTDEPTH')), 'lotNumber': text(a.get('LOTNUM')),
                    'blockNumber': text(a.get('BLOCKNUM')), 'scope': [k for k in ids if oid in ids[k]],
                }
                if not geom.is_valid:
                    props['geometryStatus'] = 'invalid-source'
                    invalid += 1
                key = f'{math.floor(point.x / .01)}_{math.floor(point.y / .01)}'
                tile = tiles.setdefault(key, {'bounds': bounds.copy(), 'features': []})
                tile['bounds'] = [min(tile['bounds'][0], bounds[0]), min(tile['bounds'][1], bounds[1]),
                                  max(tile['bounds'][2], bounds[2]), max(tile['bounds'][3], bounds[3])]
                tile['features'].append({'type': 'Feature', 'id': record_key, 'bbox': bounds,
                                         'geometry': feature['geometry'], 'properties': props})
                records.append({**props, 'longitude': point.x, 'latitude': point.y})
            print(f'Validated {len(seen)} / {len(selected)} records', flush=True)
    if seen != set(selected):
        raise ValueError('Source identities were lost')
    if scope_ids('end-') != ids:
        raise ValueError('Source scope identities changed during extraction; snapshot rejected')
    finished = datetime.now(timezone.utc).isoformat()
    identity_hash = hashlib.sha256(json.dumps(selected, separators=(',', ':')).encode()).hexdigest()
    source = {
        'id': 'st-louis-county-current', 'name': 'County public tax-roll parcel records',
        'jurisdiction': 'st-louis-county', 'url': BASE, 'queryUrl': BASE + '/query',
        'retrievedAt': finished, 'retrievalStartedAt': started, 'sourceDataEditedAt': None,
        'catalogModifiedAt': datetime.fromtimestamp(catalog['modified'] / 1000, timezone.utc).isoformat(),
        'catalogUrl': CATALOG, 'termsUrl': CATALOG, 'taxYears': years,
        'metadataSha256': hashlib.sha256(args.metadata.read_bytes()).hexdigest(),
        'sourceIdentitySha256': identity_hash, 'identityRecheckedAt': finished,
        'copyright': 'St. Louis County Assessor’s Office and GIS Service Center',
        'dateMeaning': 'TAXYR is the source tax year. Catalog modification and retrieval are not valuation or record dates.',
    }
    all_bounds = [min(t['bounds'][0] for t in tiles.values()), min(t['bounds'][1] for t in tiles.values()),
                  max(t['bounds'][2] for t in tiles.values()), max(t['bounds'][3] for t in tiles.values())]
    manifest = {
        'schema': 'st-louis-parcels-v1', 'source': source, 'featureCount': len(records),
        'invalidSourceGeometryRecords': invalid, 'coverageGeometry': mapping(box(*all_bounds)),
        'coverageMeaning': 'Envelope of the selected source records; not an administrative or completeness boundary.',
        'scopes': {k: {'sourceCount': len(v), 'query': scopes[k]} for k, v in ids.items()},
        'corridor': {'center': CENTER, 'radiusMetres': 2000, 'label': 'Page Avenue and I-170',
                     'locationSource': 'Esri World Geocoding Service street intersection'},
        'tiles': [], 'indexUrl': '/st-louis/county-current/index.json',
        'limitations': [
            'Includes source records designated Overland and source parcels intersecting a 2 km Page/I-170 query; this is not a census of houses.',
            'A live-service retrieval is frozen here. Future source changes are not automatically included.',
            'No source edit timestamp or assessment effective date is exposed; TAXYR is retained only as taxYear.',
            'Catalog modification is metadata history, not a parcel update date.',
            'Assessed and appraised values are not transaction prices, rent estimates or verified building condition.',
            'Deed references and unparsed recording-date strings are source attributes, not verified sale events.',
            'Freezing and rechecking IDs detects membership changes, not within-record edits during retrieval.',
            'Invalid source geometries are retained and flagged for exclusion from exact spatial confirmation.',
            'GIS is not a legal survey; validate business decisions with the appropriate agency.',
        ],
    }
    for key, tile in sorted(tiles.items()):
        path = args.output / 'tiles' / f'{key}.json'
        write(path, {'type': 'FeatureCollection', 'features': tile['features']})
        manifest['tiles'].append({'id': key, 'bounds': tile['bounds'], 'count': len(tile['features']),
                                  'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                                  'url': f'/st-louis/county-current/tiles/{key}.json'})
    records.sort(key=lambda p: (p['address'], p['recordKey']))
    write(args.output / 'index.json', {'schema': 'county-parcel-index-v1', 'source': source, 'records': records})
    write(args.output / 'manifest.json', manifest)
    print(json.dumps({'records': len(records), 'scopeCounts': {k: len(v) for k, v in ids.items()},
                      'taxYears': years, 'invalidGeometry': invalid, 'sourceIdentitySha256': identity_hash}), flush=True)


if __name__ == '__main__':
    main()
