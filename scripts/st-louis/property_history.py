"""Validated observation ledger: immutable baseline/deltas/receipts, compact latest state.

No historical acquisitions are inferred. The manifest is replaced last and is the
publication commit point. Unreferenced files from interrupted runs are harmless.
"""
import argparse
import ctypes
import hashlib
import json
import math
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

SOURCE_ID = 'st-louis-county-business-name-indicators'
SOURCE_URL = 'https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0'
RULE = 'county-business-designator-v1'
FIELDS = ['id', 'recordKey', 'parcelKey', 'parcelId', 'sourceObjectId', 'jurisdiction',
          'ownerName', 'longitude', 'latitude', 'address', 'title', 'sourceURL',
          'status', 'documentDate', 'amountUSD']
OWNERSHIP_FIELDS = ['sourceObjectId', 'parcelId', 'ownerName', 'longitude', 'latitude']
BASE = '/st-louis/history/'
SCHEMA = 'property-observation-history-v1'


def now():
    return datetime.now(timezone.utc).isoformat()


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    return json.loads(Path(path).read_bytes())


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('A source observation requires a dated UTC/offset timestamp.')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('A source observation requires a timezone.')
    return parsed.astimezone(timezone.utc).isoformat()


def source_id(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-z][a-z0-9-]{2,99}', value):
        raise ValueError('Unsafe source identity.')
    return value


def safe_text(value, maximum=500, required=False):
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value.strip() or len(value) > maximum or re.search(r'[\x00-\x1f\x7f]', value):
        raise ValueError('Invalid source text.')
    return value


def safe_url(value):
    safe_text(value, 2000, True)
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('A source citation must be an HTTPS URL without credentials.')
    return value


def atomic(path, raw, immutable=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == raw:
        return
    if immutable and path.exists():
        raise ValueError('An immutable history object cannot be replaced.')
    temporary = path.with_name(path.name + f'.{os.getpid()}.tmp')
    with temporary.open('wb') as handle:
        handle.write(raw)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def object_file(root, relative, value, immutable=True):
    raw = encode(value)
    atomic(Path(root) / relative, raw, immutable)
    return {'url': BASE + relative, 'sha256': digest(raw), 'bytes': len(raw)}


def exchange_directory(staged, target):
    """Publish a complete directory or leave the old directory untouched."""
    staged, target = Path(staged), Path(target)
    if not target.exists():
        os.replace(staged, target)
        return
    libc = ctypes.CDLL(None, use_errno=True)
    if sys.platform == 'darwin':
        function = libc.renamex_np
        arguments = (os.fsencode(staged), os.fsencode(target), 2)  # RENAME_SWAP
    elif sys.platform.startswith('linux') and hasattr(libc, 'renameat2'):
        function = libc.renameat2
        arguments = (-100, os.fsencode(staged), -100, os.fsencode(target), 2)  # RENAME_EXCHANGE
    else:
        raise RuntimeError('Atomic directory exchange is unavailable; previous data retained.')
    if function(*arguments) != 0:
        raise OSError(ctypes.get_errno(), 'Atomic snapshot exchange failed; previous data retained.')


def staged_update(root, callback):
    root = Path(root)
    root.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.history-stage-', dir=root.parent) as temporary:
        stage = Path(temporary) / 'history'
        if root.exists():
            shutil.copytree(root, stage, copy_function=os.link)
        else:
            stage.mkdir()
        result = callback(stage)
        exchange_directory(stage, root)
        return result


def local_url(root, url):
    if not isinstance(url, str) or not url.startswith(BASE):
        raise ValueError('History path is outside the ledger.')
    relative = url[len(BASE):]
    if not relative or any(p in ('', '.', '..') for p in relative.split('/')) or '\\' in relative or '%' in relative:
        raise ValueError('Unsafe history object path.')
    return Path(root) / relative


def normalized_source(source):
    edited_at = source.get('sourceDataEditedAt')
    if edited_at is not None:
        edited_at = timestamp(edited_at)
    record_hash = source.get('semanticRecordsSha256')
    if record_hash is not None and (not isinstance(record_hash, str) or not re.fullmatch(r'[a-f0-9]{64}', record_hash)):
        raise ValueError('Invalid semantic source-record digest.')
    return {'id': source_id(source.get('id')), 'label': safe_text(source.get('label') or source.get('name'), 200, True),
            'url': safe_url(source.get('url')), 'retrievedAt': timestamp(source.get('retrievedAt')),
            'sourceDataEditedAt': edited_at,
            'semanticRecordsSha256': record_hash,
            'semanticRecordsHashBasis': safe_text(source.get('semanticRecordsHashBasis'), 1000),
            'recordDateMeaning': safe_text(source.get('recordDateMeaning'), 1000)}


def validate_record(record, ownership=False):
    if not isinstance(record, dict) or set(record) - (set(FIELDS) | {'sourceUpdatedAt'}):
        raise ValueError('Unexpected record fields; personal/contact metadata is not accepted.')
    row = {key: record.get(key) for key in FIELDS}
    safe_text(row['id'], 220, True)
    for key in ['recordKey', 'parcelKey', 'parcelId', 'address', 'title', 'status', 'jurisdiction']:
        safe_text(row[key], 500)
    if row['ownerName'] is not None and (not isinstance(row['ownerName'], str) or not row['ownerName'].strip() or len(row['ownerName']) > 40 or '\x00' in row['ownerName']):
        raise ValueError('Invalid literal owner label.')
    if row['sourceURL'] is not None:
        safe_url(row['sourceURL'])
    oid = row['sourceObjectId']
    if oid is not None and (isinstance(oid, bool) or not isinstance(oid, (int, str)) or isinstance(oid, str) and (not oid or len(oid) > 120)):
        raise ValueError('Invalid source object identity.')
    if isinstance(oid, str):
        safe_text(oid, 120, True)
    x, y = row['longitude'], row['latitude']
    if (x is None) != (y is None) or (x is not None and (isinstance(x, bool) or isinstance(y, bool) or
            not isinstance(x, (int, float)) or not isinstance(y, (int, float)) or
            not math.isfinite(x) or not math.isfinite(y) or not -180 <= x <= 180 or not -90 <= y <= 90)):
        raise ValueError('Invalid paired coordinates.')
    if row['documentDate'] is not None:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', row['documentDate']):
            raise ValueError('Invalid document date.')
        datetime.strptime(row['documentDate'], '%Y-%m-%d')
    amount = row['amountUSD']
    if amount is not None and (isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0):
        raise ValueError('Invalid source amount.')
    if ownership:
        parcel = row['parcelId']
        if not isinstance(oid, int) or isinstance(oid, bool) or oid < 1 or not isinstance(parcel, str) or not re.fullmatch(r'[0-9]{2}[A-Z][0-9]{6}', parcel):
            raise ValueError('Invalid County parcel/source identity.')
        if (row['id'] != f'county-business-name:{oid}' or row['recordKey'] != f'st-louis-county-current:{parcel}:{oid}'
                or row['parcelKey'] != f'st-louis-county:{parcel}' or row['jurisdiction'] != 'st-louis-county'):
            raise ValueError('County ownership identities do not agree.')
        name = row['ownerName']
        if name is None:
            raise ValueError('Missing owner label.')
        from fetch_property_ownership import PATTERN
        if not PATTERN.search(name):
            raise ValueError('An owner label outside the published legal-designator scope was supplied.')
        if any(row[k] is not None for k in ['address', 'title', 'sourceURL', 'status', 'documentDate', 'amountUSD']):
            raise ValueError('County name observations cannot add unsupported attributes.')
    elif row['recordKey'] is not None or row['parcelKey'] is not None or row['parcelId'] is not None:
        raise ValueError('General observations cannot assert a parcel identity; resolve that separately.')
    return row


def ownership_input(directory):
    directory = Path(directory)
    manifest = read(directory / 'index.json')
    if manifest.get('schema') != 'ownership-signals-v1' or manifest.get('source', {}).get('id') != SOURCE_ID or manifest['source'].get('url') != SOURCE_URL or manifest.get('ruleVersion') != RULE:
        raise ValueError('County ownership source cannot be verified.')
    coverage = manifest['coverage']
    if coverage.get('unmatchedExactRegionIdentityCount') != 0 or coverage.get('unmatchedSourceObjectIds'):
        raise ValueError('The fresh source has unmatched regional identities; retain the previous complete snapshot.')
    records, seen_tiles = [], set()
    for meta in manifest['tiles']:
        key = meta['id']
        if not re.fullmatch(r'-?\d+_-?\d+', key) or key in seen_tiles or meta['url'] != f'/st-louis/ownership-signals/tiles/{key}.json':
            raise ValueError('Invalid ownership tile identity/path.')
        seen_tiles.add(key)
        raw = (directory / 'tiles' / f'{key}.json').read_bytes()
        if digest(raw) != meta['sha256'] or len(raw) != meta['bytes']:
            raise ValueError('Ownership tile content changed from its source hash.')
        tile = json.loads(raw)
        if tile.get('schema') != 'ownership-signals-tile-v1' or tile.get('id') != key or tile.get('sourceId') != SOURCE_ID or tile.get('jurisdiction') != 'st-louis-county' or len(tile['records']) != meta['count']:
            raise ValueError('Ownership tile source/count mismatch.')
        records.extend(tile['records'])
    if manifest.get('unlocatedCount'):
        if manifest.get('unlocatedUrl') != '/st-louis/ownership-signals/unlocated.json':
            raise ValueError('Invalid unlocated path.')
        tile = read(directory / 'unlocated.json')
        if tile.get('schema') != 'ownership-signals-tile-v1' or tile.get('id') != 'unlocated' or tile.get('sourceId') != SOURCE_ID or tile.get('jurisdiction') != 'st-louis-county' or len(tile['records']) != manifest['unlocatedCount']:
            raise ValueError('Invalid unlocated source/count.')
        if any(r['longitude'] is not None or r['latitude'] is not None for r in tile['records']):
            raise ValueError('Unlocated rows cannot contain mapped coordinates.')
        records.extend(tile['records'])
    if len(records) != manifest['recordCount'] or len(records) != coverage['publishedIndicatorCount'] or len(records) + coverage['rejectedTokenCandidates'] != coverage['candidateFeatureCount']:
        raise ValueError('Ownership snapshot does not reconcile source coverage.')
    allowed = {'id', 'recordKey', 'parcelKey', 'parcelId', 'sourceObjectId', 'jurisdiction', 'ownerName', 'longitude', 'latitude', 'indicator', 'matchedDesignator', 'ruleVersion'}
    normalized = []
    for record in records:
        if set(record) != allowed or record['ruleVersion'] != RULE or record['indicator'] != 'name_contains_legal_designator' or record['matchedDesignator'] not in record['ownerName']:
            raise ValueError('Unexpected ownership source fields or classification.')
        value = {k: record[k] for k in allowed & set(FIELDS)}
        normalized.append(validate_record(value, True))
    if len({r['id'] for r in normalized}) != len(normalized):
        raise ValueError('Duplicate ownership source identity.')
    return {'schema': 'property-observation-input-v1', 'complete': True, 'source': manifest['source'],
            'recordCount': len(normalized), 'records': normalized, 'kind': 'ownership'}


def validate_input(payload):
    if payload.get('schema') != 'property-observation-input-v1' or payload.get('complete') is not True or not isinstance(payload.get('records'), list):
        raise ValueError('Only complete validated observation inputs are accepted.')
    source = normalized_source(payload['source'])
    ownership = source['id'] == SOURCE_ID
    if ownership and source['url'] != SOURCE_URL:
        raise ValueError('County source URL does not match its identity.')
    records = [validate_record(row, ownership) for row in payload['records']]
    if len(records) > 200000 or len(records) != payload.get('recordCount') or len({row['id'] for row in records}) != len(records):
        raise ValueError('Observation count or unique identities do not reconcile.')
    records.sort(key=lambda row: row['id'])
    return source, records, 'ownership' if ownership else 'source-record'


def state_payload(source, records):
    fields = OWNERSHIP_FIELDS if source['id'] == SOURCE_ID else FIELDS
    return {'schema': 'property-observation-state-v1', 'sourceId': source['id'], 'fields': fields,
            'rows': [[row[key] for key in fields] for row in records]}


def record_identity(row, ownership=False):
    # An ArcGIS OBJECTID can be reused after a parcel/service rebuild. It cannot
    # join a prior parcel to a new parcel merely because the integer is equal.
    return row['recordKey'] if ownership else row['id']


def decode_state(state, source):
    fields = OWNERSHIP_FIELDS if source['id'] == SOURCE_ID else FIELDS
    if state.get('schema') != 'property-observation-state-v1' or state.get('sourceId') != source['id'] or state.get('fields') != fields:
        raise ValueError('Prior state identity cannot be verified.')
    result = {}
    for values in state['rows']:
        if len(values) != len(fields):
            raise ValueError('Prior state row shape cannot be verified.')
        row = dict(zip(fields, values))
        if source['id'] == SOURCE_ID:
            oid, parcel = row['sourceObjectId'], row['parcelId']
            row.update(id=f'county-business-name:{oid}', recordKey=f'st-louis-county-current:{parcel}:{oid}',
                       parcelKey=f'st-louis-county:{parcel}', jurisdiction='st-louis-county')
        row = validate_record(row, source['id'] == SOURCE_ID)
        key = record_identity(row, source['id'] == SOURCE_ID)
        if key in result:
            raise ValueError('Duplicate prior state record.')
        result[key] = row
    return result


def load_manifest(root):
    path = Path(root) / 'manifest.json'
    if not path.exists():
        return {'schema': SCHEMA, 'sources': [], 'meaning': 'Dated source observations; no inferred acquisitions or beneficial ownership.',
                'storage': 'One immutable baseline per source; latest compact state; immutable change partitions and run receipts. Baseline plus deltas reconstructs prior states.'}
    manifest = read(path)
    if manifest.get('schema') != SCHEMA or len({r['id'] for r in manifest['sources']}) != len(manifest['sources']):
        raise ValueError('History manifest cannot be verified.')
    return manifest


def _apply_observation(root, payload, attempted_at=None):
    root = Path(root)
    source, records, kind = validate_input(payload)
    observed_at = source['retrievedAt']
    attempted_at = timestamp(attempted_at or now())
    manifest = load_manifest(root)
    entry = next((r for r in manifest['sources'] if r['id'] == source['id']), None)
    if entry and entry['sourceURL'] != source['url']:
        raise ValueError('A different source URL requires an explicit provenance migration.')
    state = state_payload(source, records)
    semantic_hash = digest(encode(state))
    receipt_key = [source['id'], observed_at, semantic_hash, 'success']
    if source.get('semanticRecordsSha256'):
        receipt_key.append(source['semanticRecordsSha256'])
    receipt_id = digest(encode(receipt_key))
    if entry and any(r['id'] == receipt_id for r in entry['observations']):
        return {'status': 'duplicate', 'changes': 0, 'recordCount': len(records)}
    if entry and entry.get('lastSuccessAt') and observed_at < entry['lastSuccessAt']:
        raise ValueError('An older source observation cannot replace newer evidence.')
    if entry and observed_at == entry.get('lastSuccessAt') and entry.get('semanticSha256') != semantic_hash:
        raise ValueError('Conflicting content at the same observation timestamp requires review.')
    prior, events = {}, []
    if entry and entry.get('latestState'):
        raw = local_url(root, entry['latestState']['url']).read_bytes()
        if digest(raw) != entry['latestState']['sha256']:
            raise ValueError('Latest state no longer matches the published manifest.')
        old = json.loads(raw)
        prior = decode_state(old, source)
        current = {record_identity(row, kind == 'ownership'): row for row in records}
        for key in sorted(prior.keys() | current.keys()):
            before, after = prior.get(key), current.get(key)
            if before == after:
                continue
            change = 'added' if before is None else 'removed' if after is None else 'changed'
            location = after or before
            event_kind = ('owner-observation-' if kind == 'ownership' else 'source-record-observation-') + change
            event = {k: location[k] for k in ['recordKey', 'parcelKey', 'parcelId', 'sourceObjectId', 'longitude', 'latitude', 'address']}
            event.update(sourceId=source['id'], kind=event_kind, observedAt=observed_at, previousObservedAt=entry['lastSuccessAt'],
                         before=before, after=after, sourceURL=source['url'],
                         meaning='A changed source observation, not an acquisition, sale or proof of control.' if kind == 'ownership' else 'A changed source record; legal/project consequences require the originating evidence.')
            event['id'] = digest(encode(event))
            events.append(event)
    if entry is None:
        entry = {'id': source['id'], 'label': source['label'], 'sourceURL': source['url'], 'observations': [], 'events': [],
                 'limitations': ['The baseline starts at the first retained source observation; prior history is unknown.',
                                 'Owner-name changes and missing indicators do not establish purchases, sales, common control or beneficial ownership.']}
        manifest['sources'].append(entry)
    previous_dataset_hash = entry.get('latestDatasetSha256')
    dataset_hash = source.get('semanticRecordsSha256')
    dataset_changed = (previous_dataset_hash != dataset_hash) if previous_dataset_hash and dataset_hash else None
    baseline = not entry.get('baseline')
    if baseline:
        entry['baseline'] = {**object_file(root, f'baseline/{source["id"]}.json', state), 'recordCount': len(records), 'observedAt': observed_at}
        entry['baselineObservedAt'] = observed_at
    state_meta = object_file(root, f'state/{source["id"]}.json', state, False)
    # The caller exchanges the complete staged tree after every write succeeds.
    entry['latestState'] = {**state_meta, 'recordCount': len(records), 'observedAt': observed_at}
    if events:
        event_id = digest(encode(events))
        partition = {'schema': 'property-observation-events-v1', 'id': event_id, 'sourceId': source['id'],
                     'observedAt': observed_at, 'previousPartitionSha256': entry['events'][-1]['sha256'] if entry['events'] else None,
                     'events': events}
        entry['events'].append({**object_file(root, f'events/{observed_at[:7]}/{event_id}.json', partition),
                                'id': event_id, 'observedAt': observed_at, 'eventCount': len(events)})
    receipt = {'schema': 'property-observation-run-v1', 'id': receipt_id, 'sourceId': source['id'], 'status': 'success',
               'attemptedAt': attempted_at, 'observedAt': observed_at, 'source': source, 'semanticSha256': semantic_hash,
               'recordCount': len(records), 'eventCount': len(events), 'baseline': baseline,
               'datasetSha256': dataset_hash, 'previousDatasetSha256': previous_dataset_hash,
               'datasetChanged': dataset_changed,
               'changed': bool(events), 'meaning': 'Baseline observation, not historical change.' if baseline else 'Complete source observation.'}
    entry['observations'].append({**object_file(root, f'runs/{observed_at[:7]}/{receipt_id}.json', receipt),
                                  'id': receipt_id, 'observedAt': observed_at, 'status': 'success', 'eventCount': len(events), 'baseline': baseline,
                                  'datasetChanged': dataset_changed})
    entry.update(status='healthy', label=source['label'], sourceURL=source['url'], lastAttemptAt=attempted_at,
                 lastSuccessAt=observed_at, recordCount=len(records), semanticSha256=semantic_hash, lastError=None)
    if dataset_hash:
        entry.update(latestDatasetSha256=dataset_hash, datasetHashBasis=source['semanticRecordsHashBasis'])
        if dataset_changed:
            entry['lastDatasetChangeObservedAt'] = observed_at
    manifest['updatedAt'] = attempted_at
    manifest['sources'].sort(key=lambda r: r['id'])
    atomic(root / 'manifest.json', encode(manifest))
    return {'status': 'baseline' if baseline else 'changed' if events else 'dataset-changed' if dataset_changed else 'unchanged', 'changes': len(events), 'recordCount': len(records)}


def apply_observation(root, payload, attempted_at=None):
    # Validate before touching staging or any published object.
    validate_input(payload)
    return staged_update(root, lambda stage: _apply_observation(stage, payload, attempted_at))


def record_failure(root, source, reason, attempted_at=None):
    root = Path(root)
    sid, url = source_id(source['id']), safe_url(source['url'])
    label = safe_text(source.get('label') or source.get('name'), 200, True)
    attempted_at = timestamp(attempted_at or now())
    # Error categories are controlled by callers; never serialize raw server output.
    if reason not in {'source-unavailable', 'source-timeout', 'snapshot-invalid', 'collector-failed'}:
        raise ValueError('Unknown safe error category.')
    manifest = load_manifest(root)
    entry = next((r for r in manifest['sources'] if r['id'] == sid), None)
    if entry and entry['sourceURL'] != url:
        raise ValueError('Failure source URL does not match existing source identity.')
    if entry is None:
        entry = {'id': sid, 'label': label, 'sourceURL': url, 'observations': [], 'events': [], 'baselineObservedAt': None,
                 'lastSuccessAt': None, 'latestState': None, 'recordCount': None, 'limitations': ['No successful retained source observation.']}
        manifest['sources'].append(entry)
    receipt_id = digest(encode([sid, attempted_at, reason]))
    if any(r['id'] == receipt_id for r in entry['observations']):
        return {'status': 'duplicate-failure'}
    receipt = {'schema': 'property-observation-run-v1', 'id': receipt_id, 'sourceId': sid, 'status': 'unavailable',
               'attemptedAt': attempted_at, 'observedAt': None, 'error': reason, 'retainedLastSuccessAt': entry.get('lastSuccessAt'),
               'meaning': 'Source retrieval failed; previous evidence retained. No absence or ownership change is inferred.'}
    entry['observations'].append({**object_file(root, f'runs/{attempted_at[:7]}/{receipt_id}.json', receipt),
                                  'id': receipt_id, 'observedAt': attempted_at, 'status': 'unavailable', 'eventCount': 0})
    entry.update(status='unavailable', lastAttemptAt=attempted_at, lastError=reason)
    manifest['updatedAt'] = attempted_at
    manifest['sources'].sort(key=lambda r: r['id'])
    atomic(root / 'manifest.json', encode(manifest))
    return {'status': 'unavailable', 'retainedLastSuccessAt': entry.get('lastSuccessAt')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--history', type=Path, default=Path('public/st-louis/history'))
    parser.add_argument('--ownership', type=Path)
    parser.add_argument('--input', type=Path)
    args = parser.parse_args()
    if bool(args.ownership) == bool(args.input):
        parser.error('Choose exactly one validated ownership snapshot or normalized input.')
    payload = ownership_input(args.ownership) if args.ownership else read(args.input)
    print(json.dumps(apply_observation(args.history, payload)))


if __name__ == '__main__':
    main()
