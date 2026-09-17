#!/usr/bin/env python3
"""Public City water-material inventory. No account/owner fields or parcel joins.

uv run --no-project python scripts/st-louis/fetch_property_utilities.py
--cached rebuilds a previously verified snapshot without changing its retrieval date.
Request timeout 25s, at most 3 attempts, 2 concurrent 1,000-OID batches.
Run under an outer `timeout 600` in the source-refresh pipeline.
"""
import argparse
import collections
import concurrent.futures
import datetime as dt
import hashlib
import json
import math
import re
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESEARCH = ROOT.parent / 'research/utilities-2026'
OUTPUT = ROOT / 'public/st-louis/utilities'
SOURCE_ID = 'st-louis-city-water-materials'
URL = 'https://services6.arcgis.com/HZXbCkpCSqbGd0vK/arcgis/rest/services/STLWD_LSLI__Read_Only_View/FeatureServer/0'
VIEWER = 'https://stlcity.maps.arcgis.com/apps/webappviewer/index.html?id=d0b9af6b0560441e8758d096be69a87b'
TERMS = 'https://dynamic.stlouis-mo.gov/opendata/terms.cfm'
CATALOG = 'https://www.stlouis-mo.gov/government/departments/public-utilities/water/identify-lead-service-line.cfm'
FIELDS = ['OBJECTID', 'GlobalID', 'address', 'utilmaterial', 'utilsource', 'utilstatus', 'custmaterial', 'custsource', 'custstatus']
CODE_FIELDS = ['utilmaterial', 'utilsource', 'utilstatus', 'custmaterial', 'custsource', 'custstatus']
STATUSES = ['lead', 'galvanized-replacement', 'unknown', 'non-lead']
GRID = .01


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def request(url, params=None):
    encoded = urllib.parse.urlencode({'f': 'json', **(params or {})})
    # ArcGIS supports read-only POST queries. Exact 1,000-ID batches can exceed
    # the service's GET URL limit; this does not invoke an edit operation.
    endpoint = urllib.request.Request(url, data=encoded.encode(), headers={'Content-Type': 'application/x-www-form-urlencoded'}) if params and 'objectIds' in params else url + '?' + encoded
    for attempt in range(3):
        try:
            with urllib.request.urlopen(endpoint, timeout=25) as response:
                raw = response.read(8_000_001)
            if len(raw) > 8_000_000:
                raise ValueError('Source response exceeds extraction budget')
            result = json.loads(raw)
            if result.get('error'):
                raise ValueError(str(result['error']))
            return result
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def ids():
    result = request(URL + '/query', {'where': '1=1', 'returnIdsOnly': 'true'})
    values = result.get('objectIds', [])
    if result.get('objectIdFieldName') != 'OBJECTID' or not 1 <= len(values) <= 200000:
        raise ValueError('Unverified inventory size or OID field')
    if any(type(x) is not int or x < 1 for x in values) or len(values) != len(set(values)):
        raise ValueError('Source OIDs are not unique positive integers')
    return sorted(values)


def domains(metadata):
    found = {field['name']: field for field in metadata.get('fields', [])}
    if any(key not in found for key in FIELDS):
        raise ValueError('Public view no longer has the expected allowlisted fields')
    result = {}
    for key in CODE_FIELDS:
        domain = found[key].get('domain') or {}
        values = domain.get('codedValues')
        if domain.get('type') != 'codedValue' or not values:
            raise ValueError('Source code domain unavailable: ' + key)
        result[key] = [{'code': row['code'], 'label': row['name']} for row in values]
    expected_status = {0: 'Unknown', 1: 'Lead', 2: 'Non-Lead', 3: 'Galvanized Requiring Replacement'}
    for key in ['utilstatus', 'custstatus']:
        if {v['code']: v['label'] for v in result[key]} != expected_status:
            raise ValueError('Source status definitions changed; classification requires review')
    for key in ['utilmaterial', 'custmaterial']:
        if next((v['label'] for v in result[key] if v['code'] == 109), None) != 'Lead - LP':
            raise ValueError('Source lead material definition changed')
    return result


def fetch_source():
    before = request(URL)
    source_ids = ids()
    code_domains = domains(before)
    chunks = [source_ids[n:n+1000] for n in range(0, len(source_ids), 1000)]

    def read_chunk(chunk):
        payload = request(URL + '/query', {'objectIds': ','.join(map(str, chunk)), 'outFields': ','.join(FIELDS),
            'returnGeometry': 'true', 'outSR': '4326', 'orderByFields': 'OBJECTID ASC'})
        features = payload.get('features', [])
        returned = [row.get('attributes', {}).get('OBJECTID') for row in features]
        if payload.get('exceededTransferLimit') or len(returned) != len(chunk) or sorted(returned) != chunk:
            raise ValueError('Source OID batch is incomplete or duplicated')
        # Explicitly remove unexpected additions to a public view; no account IDs.
        return [{'attributes': {key: row['attributes'].get(key) for key in FIELDS}, 'geometry': row.get('geometry')}
                for row in features]

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        # Executor.map(buffersize=...) was only added in Python 3.14. Submit
        # two batches at a time to preserve the bound on our Python 3.12 runner.
        features = []
        for offset in range(0, len(chunks), 2):
            for batch in executor.map(read_chunk, chunks[offset:offset+2]):
                features.extend(batch)
    after = request(URL)
    if ids() != source_ids or before.get('editingInfo') != after.get('editingInfo') or domains(after) != code_domains:
        raise ValueError('Source changed during acquisition; prior published inventory is preserved')
    snapshot = {'sourceUrl': URL, 'retrievedAt': stamp(), 'metadata': before, 'recordCount': len(features),
        'objectIdsSha256': hashlib.sha256(encode(source_ids)).hexdigest(), 'exactObjectIdsVerified': True,
        'sourceEpochUnchanged': True, 'features': features}
    RESEARCH.mkdir(parents=True, exist_ok=True)
    (RESEARCH / 'city-water-verified.json').write_bytes(encode(snapshot))
    return snapshot


def coded(raw, definitions):
    if raw is not None and (isinstance(raw, (dict, list, bool)) or not isinstance(raw, (str, int, float))):
        raise ValueError('A source code is not scalar')
    if isinstance(raw, float):
        raise ValueError('Expected an integer or textual source code, not a floating value')
    match = next((entry for entry in definitions if type(entry['code']) is type(raw) and entry['code'] == raw), None)
    return {'code': raw, 'label': match['label'] if match else 'Not supplied' if raw is None else f'Unrecognized source code ({raw})',
            'recognized': match is not None}


def classification(a):
    # Status evidence stays separate from materials. Galvanized material alone
    # does not establish the source's "requiring replacement" determination.
    if a.get('utilstatus') == 1 or a.get('custstatus') == 1 or a.get('utilmaterial') == 109 or a.get('custmaterial') == 109:
        return 'lead'
    if a.get('utilstatus') == 3 or a.get('custstatus') == 3:
        return 'galvanized-replacement'
    if a.get('utilstatus') == 2 and a.get('custstatus') == 2:
        return 'non-lead'
    return 'unknown'


def normalize(feature, code_domains):
    a = feature['attributes']
    oid = a.get('OBJECTID')
    if type(oid) is not int or oid < 1:
        raise ValueError('Invalid source object identity')
    global_id = a.get('GlobalID')
    if global_id is not None and not re.fullmatch(r'\{?[\da-fA-F]{8}(?:-[\da-fA-F]{4}){3}-[\da-fA-F]{12}\}?', str(global_id)):
        raise ValueError('Malformed public source GlobalID')
    address = re.sub(r'\s+', ' ', a.get('address') or '').strip() or None
    if address is not None and (len(address) > 500 or '@' in address):
        raise ValueError('Unexpected content in public address field')
    g = feature.get('geometry') or {}
    lon, lat = g.get('x'), g.get('y')
    if not all(type(v) in (int, float) and math.isfinite(v) for v in (lon, lat)) or not (-91 < lon < -89 and 38 < lat < 40):
        lon = lat = None
    row = {'id': f'{SOURCE_ID}:{oid}', 'sourceId': SOURCE_ID, 'jurisdiction': 'st-louis-city',
        'sourceObjectId': oid, 'sourceGlobalId': global_id, 'address': address, 'longitude': lon, 'latitude': lat,
        'status': classification(a), 'geometryStatus': 'source-point' if lon is not None else 'unlocated',
        'recordKey': None, 'parcelKey': None, 'parcelJoinStatus': 'not-established'}
    for key, name in [('utilmaterial', 'utilityMaterial'), ('utilsource', 'utilityEvidence'), ('utilstatus', 'utilityStatus'),
                      ('custmaterial', 'customerMaterial'), ('custsource', 'customerEvidence'), ('custstatus', 'customerStatus')]:
        row[name] = coded(a.get(key), code_domains[key])
    return row


def write_json(path, payload):
    raw = encode(payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def semantic_records_hash(records):
    """Content identity independent of source order and collection timestamps."""
    rows = [{k: v for k, v in row.items() if k not in ('retrievedAt', 'sourceRetrievedAt')} for row in records]
    return hashlib.sha256(encode(sorted(rows, key=lambda row: row['id']))).hexdigest()


def build(snapshot):
    if not snapshot.get('exactObjectIdsVerified') or not snapshot.get('sourceEpochUnchanged') or snapshot.get('sourceUrl') != URL:
        raise ValueError('Only an exact-ID, stable-epoch acquisition may be published')
    code_domains = domains(snapshot['metadata'])
    records = sorted((normalize(f, code_domains) for f in snapshot['features']), key=lambda r: r['sourceObjectId'])
    if len(records) != snapshot['recordCount'] or len({r['id'] for r in records}) != len(records):
        raise ValueError('Published identities/count do not reconcile')
    global_ids = [r['sourceGlobalId'].lower() for r in records if r['sourceGlobalId'] is not None]
    if len(set(global_ids)) != len(global_ids):
        raise ValueError('Conflicting source GlobalIDs')
    found_hash = hashlib.sha256(encode([r['sourceObjectId'] for r in records])).hexdigest()
    if found_hash != snapshot['objectIdsSha256']:
        raise ValueError('Source ID digest mismatch')
    groups = collections.defaultdict(list)
    unlocated, search_rows = [], []
    for row in records:
        tile = None
        if row['longitude'] is None:
            unlocated.append(row)
        else:
            x, y = math.floor(row['longitude']/GRID), math.floor(row['latitude']/GRID)
            tile = f'{x}_{y}'
            groups[tile].append(row)
        search_rows.append([row['sourceObjectId'], row['address'], tile, row['status']])
    stage = RESEARCH / 'public-staging'
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    tiles = []
    for tile, rows in sorted(groups.items()):
        x, y = map(int, tile.split('_'))
        relative = f'city-water/tiles/{tile}.json'
        stats = write_json(stage/relative, {'schema': 'property-utilities-tile-v1', 'sourceId': SOURCE_ID,
            'id': tile, 'retrievedAt': snapshot['retrievedAt'], 'records': rows})
        tiles.append({'id': tile, 'bounds': [x*GRID, y*GRID, (x+1)*GRID, (y+1)*GRID], 'count': len(rows),
            'statusCounts': dict(collections.Counter(r['status'] for r in rows)), 'url': '/st-louis/utilities/'+relative, **stats})
    unlocated_stats = write_json(stage/'city-water/unlocated.json', {'schema': 'property-utilities-tile-v1', 'sourceId': SOURCE_ID,
        'id': 'unlocated', 'retrievedAt': snapshot['retrievedAt'], 'records': unlocated})
    search_stats = write_json(stage/'city-water/search-index.json', {'schema': 'property-utilities-search-v1', 'sourceId': SOURCE_ID,
        'retrievedAt': snapshot['retrievedAt'], 'fields': ['sourceObjectId', 'address', 'tileId', 'status'], 'rows': search_rows})
    edited = snapshot['metadata'].get('editingInfo', {}).get('dataLastEditDate')
    edited_date = dt.datetime.fromtimestamp(edited/1000, dt.timezone.utc).isoformat() if edited else None
    limitations = ['City public water service-material inventory only; County service materials are not connected.',
        'Source point locations are not pipe paths, parcel boundaries, or evidence of a particular parcel connection.',
        'Right-of-way and building-side material, status and evidence remain separate. Unknown does not mean non-lead.',
        'Material inventory is not household water-quality testing, pressure, spare capacity, condition, or an engineering determination.',
        'Overview counts cover source grid cells intersecting the map; zoom in for exact viewport points.',
        'The City disclaims dataset accuracy/completeness and may update or discontinue publication. No fixed update cadence is supplied.']
    source = {'id': SOURCE_ID, 'name': 'City of St. Louis — Public water service-line material inventory',
        'url': URL, 'queryUrl': URL+'/query', 'viewerUrl': VIEWER, 'catalogUrl': CATALOG, 'termsUrl': TERMS,
        'retrievedAt': snapshot['retrievedAt'], 'sourceDataEditedAt': edited_date,
        'reuse': {'basis': 'City public dataset terms; public read-only view intentionally linked by Water Division',
                 'termsUrl': TERMS, 'termsReviewedAt': '2026-09-12', 'licenseIdentifier': None,
                 'note': 'No Creative Commons or public-domain license is asserted. Preserve attribution, source dates and City accuracy disclaimer.'},
        'coordinateMethod': 'Official source points requested in EPSG:4326', 'recordIdentity': 'Exact OBJECTID; source GlobalID preserved',
        'sourceObjectIdsSha256': found_hash,
        'semanticRecordsSha256': semantic_records_hash(records),
        'semanticRecordsHashBasis': 'SHA-256 of UTF-8 compact JSON, keys sorted, Unicode literal, all normalized records sorted lexically by id; excludes retrievedAt/sourceRetrievedAt and enclosing tile/manifest metadata.',
        'limitations': limitations}
    manifest = {'schema': 'property-utilities-manifest-v1', 'layerId': 'water-materials', 'source': source,
        'retrievedAt': snapshot['retrievedAt'], 'recordCount': len(records), 'mappedCount': len(records)-len(unlocated),
        'unlocatedCount': len(unlocated), 'gridDegrees': GRID, 'statusCounts': dict(collections.Counter(r['status'] for r in records)),
        'domains': code_domains, 'tiles': tiles, 'coverage': 'City public water service-line inventory; County not connected.',
        'unlocatedUrl': '/st-louis/utilities/city-water/unlocated.json', 'unlocatedFile': unlocated_stats,
        'searchIndex': {'url': '/st-louis/utilities/city-water/search-index.json', 'count': len(records), **search_stats},
        'directoryUrl': '/st-louis/utilities/directory.json', 'totalTileBytes': sum(t['bytes'] for t in tiles),
        'largestTileBytes': max((t['bytes'] for t in tiles), default=0), 'limitations': limitations}
    write_json(stage/'manifest.json', manifest)
    write_json(stage/'directory.json', {'schema': 'property-utility-directory-v1', 'checkedAt': '2026-09-12', 'entries': [
        {'id':'fcc-broadband','label':'Check broadband providers, cable/fiber technology and advertised speeds',
         'url':'https://broadbandmap.fcc.gov/home','access':'source-link','geography':'United States',
         'detail':'Use the official address search or Area Summary. No address/coordinate deep-link parameter is asserted.',
         'documentationUrl':'https://help.bdc.fcc.gov/hc/en-us/articles/10467446103579-How-to-Use-the-FCC-s-National-Broadband-Map'},
        {'id':'psc-locator','label':'Find published electric, gas and water providers','url':'https://psc.mo.gov/UtilityLocator.aspx',
         'access':'source-link','geography':'Missouri','detail':'Municipal reference only; exact property service must be confirmed.'},
        {'id':'psc-dockets','label':'Read public utility cases, tariffs and filings','url':'https://www.efis.psc.mo.gov/Case',
         'access':'source-link','geography':'Missouri','detail':'Public filings are source documents, not proof of construction or nearby capacity.'},
        {'id':'msd-projects','label':'MSD sewer and stormwater projects','url':'https://msdprojectclear.org/',
         'access':'source-link','geography':'MSD service area','termsUrl':'https://msdprojectclear.org/terms-of-use/',
         'detail':'Open System Improvements and check the fiscal year. Proprietary map/feed data are not copied.'},
        {'id':'ameren','label':'Ameren electricity outages and announced upgrades','url':'https://www.ameren.com/',
         'access':'source-link','geography':'Ameren service area','termsUrl':'https://www.ameren.com/terms',
         'detail':'Use Outage Map or Reliability. No outage history or network routes are connected here.'},
        {'id':'american-water','label':'American Water advisory, project and service-line maps','url':'https://www.amwater.com/',
         'access':'source-link','geography':'American Water service area','termsUrl':'https://www.amwater.com/corp/terms-of-use',
         'detail':'Choose Missouri, then Public Maps or Water Quality. Homepage link only; restricted feeds are not mirrored.'},
        {'id':'modot','label':'MoDOT public road work and project information','url':'https://www.modot.org/stlouis',
         'access':'source-link','geography':'MoDOT St. Louis district','detail':'Road-work information is not a complete utility-permit inventory.'}
    ]})
    # Publish only after all data and hashes reconcile; preserve previous assets on acquisition errors.
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    backup = RESEARCH/'previous-public'
    if backup.exists():
        shutil.rmtree(backup)
    if OUTPUT.exists():
        OUTPUT.rename(backup)
    try:
        stage.rename(OUTPUT)
    except Exception:
        if backup.exists():
            backup.rename(OUTPUT)
        raise
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cached', action='store_true')
    args = parser.parse_args()
    RESEARCH.mkdir(parents=True, exist_ok=True)
    started = stamp()
    previous = json.loads((OUTPUT/'manifest.json').read_text()) if (OUTPUT/'manifest.json').exists() else {}
    health = {'sourceId': SOURCE_ID, 'startedAt': started, 'lastSuccessfulRetrievedAt': previous.get('retrievedAt')}
    try:
        snapshot = json.loads((RESEARCH/'city-water-verified.json').read_text()) if args.cached else fetch_source()
        manifest = build(snapshot)
        health.update(status='success', mode='cached-rebuild' if args.cached else 'fresh', finishedAt=stamp(),
            lastSuccessfulRetrievedAt=manifest['retrievedAt'], recordCount=manifest['recordCount'],
            sourceDataEditedAt=manifest['source']['sourceDataEditedAt'])
        (RESEARCH/'health.json').write_bytes(encode(health))
        print(json.dumps({k: manifest[k] for k in ['recordCount','mappedCount','unlocatedCount','statusCounts','totalTileBytes','largestTileBytes']}))
    except Exception as error:
        health.update(status='failed', finishedAt=stamp(), error=str(error)[:500])
        (RESEARCH/'health.json').write_bytes(encode(health))
        raise
