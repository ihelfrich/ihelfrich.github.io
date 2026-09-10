#!/usr/bin/env python3
"""Refresh the anonymous official LRA Available snapshot; preserve old output on failure.

Uses Python standard library and the site's Node normalizer. No credentials,
assessment-derived asking prices, or browser cross-origin access are involved.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request

REPO = Path(__file__).resolve().parents[2]
SERVICE = 'https://maps8.stlouis-mo.gov/arcgis/rest/services/SLDC/SLDC_Real_Estate/MapServer/0/query'
WHERE = "LRA='YES' AND Case_Status='Available' AND Status='Available'"
FIELDS = 'OBJECTID,Handle,ParcelId,Address,LRA,Case_Status,Status,Usage,PropertyType,SQFT,BuildingCount'
MAX_BYTES = 8_000_000


def query(parameters):
    url = SERVICE + '?' + urllib.parse.urlencode({'f': 'json', 'where': WHERE, **parameters})
    for attempt in range(2):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'StLouisPublicPropertySnapshot/1.0'})
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ValueError('Official response exceeds the bounded request size.')
            data = json.loads(body)
            if 'error' in data:
                raise ValueError('Official LRA service returned an error.')
            return data
        except urllib.error.HTTPError:
            raise
        except (TimeoutError, urllib.error.URLError):
            if attempt:
                raise
    raise RuntimeError('Official LRA request failed.')


def fetch_batch(ids):
    payload = query({'objectIds': ','.join(map(str, ids)), 'outFields': FIELDS,
                     'returnGeometry': 'true', 'outSR': '4326'})
    if payload.get('exceededTransferLimit') or not isinstance(payload.get('features'), list):
        raise ValueError('Incomplete LRA batch; previous snapshot retained.')
    sr = payload.get('spatialReference', {})
    if (sr.get('latestWkid') or sr.get('wkid')) != 4326:
        raise ValueError('LRA batch did not return the requested WGS84 geometry.')
    features = payload['features']
    returned = [f.get('attributes', {}).get('OBJECTID') for f in features]
    if len(set(returned)) != len(returned) or set(returned) != set(ids):
        raise ValueError('LRA inventory changed or a batch is incomplete; retry later.')
    return features


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=REPO / 'public/st-louis/public-listings/latest.json')
    parser.add_argument('--ids-file', type=Path, help='Reuse a verified ID response from this refresh (validation only).')
    parser.add_argument('--raw-out', type=Path, help='Optional local audit copy of returned source features.')
    parser.add_argument('--source-file', type=Path, help='Normalize a previously retrieved local audit copy without refetching.')
    parser.add_argument('--max-records', type=int, default=12000)
    args = parser.parse_args()
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    saved_source = json.loads(args.source_file.read_text()) if args.source_file else None
    ids_payload = json.loads(args.ids_file.read_text()) if args.ids_file else ({'objectIds': [f['attributes']['OBJECTID'] for f in saved_source['features']]} if saved_source else query({'returnIdsOnly': 'true'}))
    ids = ids_payload.get('objectIds')
    if not isinstance(ids, list) or not all(type(i) is int and i >= 0 for i in ids):
        raise ValueError('Invalid official LRA ID response.')
    if len(set(ids)) != len(ids) or len(ids) > args.max_records:
        raise ValueError('Duplicate IDs or inventory exceeds the configured safety bound.')
    ids.sort()
    batches = [ids[i:i + 500] for i in range(0, len(ids), 500)]
    if saved_source:
        payload = saved_source
        features = payload['features']
        returned = [f.get('attributes', {}).get('OBJECTID') for f in features]
        if len(set(returned)) != len(returned) or set(returned) != set(ids):
            raise ValueError('Audit source and requested IDs disagree.')
        retrieved = payload.get('retrievedAt') or dt.datetime.fromtimestamp(args.source_file.stat().st_mtime, dt.timezone.utc).isoformat()
        started = retrieved
    else:
        features = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            for i, chunk in enumerate(executor.map(fetch_batch, batches), 1):
                features.extend(chunk)
                print(f'LRA batch {i}/{len(batches)}: {len(features)} records', flush=True)
        retrieved = dt.datetime.now(dt.timezone.utc).isoformat()
        payload = {'features': features, 'spatialReference': {'wkid': 4326}, 'retrievedAt': retrieved}
    if args.raw_out:
        args.raw_out.parent.mkdir(parents=True, exist_ok=True)
        args.raw_out.write_text(json.dumps(payload, separators=(',', ':')))
    # The same pure module serves tests and the browser; financial/coordinate
    # transformations are not duplicated in the fetcher.
    code = """
      import fs from 'node:fs';
      import {createPublicListingsSnapshot} from './src/lib/city-public-listings.mjs';
      const input=JSON.parse(fs.readFileSync(0,'utf8'));
      const snapshot=createPublicListingsSnapshot(input.payload,{retrievedAt:input.retrievedAt});
      if(snapshot.counts.excluded)throw new Error('Unexpected unavailable record in filtered source batch');
      snapshot.source.captureStartedAt=input.started;
      snapshot.source.expectedSourceRecords=input.expected;
      process.stdout.write(JSON.stringify(snapshot));
    """
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=args.output.parent, suffix='.tmp', delete=False) as output:
            temporary = Path(output.name)
            subprocess.run(['node', '--input-type=module', '-e', code], cwd=REPO,
                           input=json.dumps({'payload': payload, 'retrievedAt': retrieved,
                                             'started': started, 'expected': len(ids)}).encode(),
                           stdout=output, check=True, timeout=60)
        result = json.loads(temporary.read_text())
        if result['counts']['listings'] != len(ids):
            raise ValueError('Normalized inventory count mismatch; previous snapshot retained.')
        os.replace(temporary, args.output)
        print(json.dumps({'output': str(args.output), 'bytes': args.output.stat().st_size,
                          'retrievedAt': retrieved, 'sourceUpdatedAt': None,
                          'counts': result['counts']}), flush=True)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


if __name__ == '__main__':
    main()
