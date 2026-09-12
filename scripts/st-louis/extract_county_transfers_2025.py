"""Fetch only the official 2025 sales ZIP member and publish study-matched fields.

uv run --no-project python scripts/st-louis/extract_county_transfers_2025.py \
  --cache ../research/county-records-2026/transfers-2025-range \
  --study public/st-louis/county-current/index.json \
  --output public/st-louis/county-transfers-2025

Uses ordinary HTTP byte ranges, requires 206 and exact Content-Range, never an
authenticated browser replay. Public output excludes NOTES and all owner/contact
fields. Raw member bytes are decompressed only in memory. Existing output is refused.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import subprocess
import zipfile
import zlib

from extract_county_history import encoded, transform, source_date, text, SALE_VALIDITY, MARKET_VALIDITY

URL = 'https://revenue.stlouisco.com/pdfs/2025/STLCOMO_ASMTROLL_REAL_BILLING_2025.zip'
MEMBER = 'STLCOMO_ASMTROLL_BILLING_2025/sales.txt'
SOURCE_ID = 'stlco-real-billing-2025-sales'
EXPECTED_COLUMNS = ['PARID','SALEDT','PRICE','TRANSNO','TRANSDT','BOOK','PAGE','SOURCE','SALETYPE','SALEVAL','INSTRUNO','INSTRTYP','NOTES','MKTVALID']


def sha(data): return hashlib.sha256(data).hexdigest()


def fetch_range(cache, name, value, maximum):
    target, headers = cache / (name + '.bin'), cache / (name + '.headers')
    command = ['curl', '--max-time', '90', '--max-filesize', str(maximum), '--range', value,
               '-sS', '-D', str(headers), '-o', str(target), URL]
    subprocess.run(command, check=True, timeout=95, capture_output=True)
    header_text = headers.read_text()
    statuses = re.findall(r'^HTTP/\S+\s+(\d+)', header_text, re.M)
    content_range = re.search(r'^content-range:\s*bytes (\d+)-(\d+)/(\d+)', header_text, re.I | re.M)
    if not statuses or statuses[-1] != '206' or not content_range:
        raise ValueError('Ordinary byte-range access not granted; stop without auth or challenge bypass.')
    start, end, total = map(int, content_range.groups())
    data = target.read_bytes()
    if len(data) != end - start + 1 or len(data) > maximum:
        raise ValueError('Range response length differs from declared bytes.')
    if value.startswith('-'):
        if end != total - 1 or len(data) != min(total, int(value[1:])): raise ValueError('Suffix range mismatch.')
    elif (start, end) != tuple(map(int, value.split('-'))):
        raise ValueError('Requested and received byte ranges differ.')
    modified = re.search(r'^last-modified:\s*(.+)', header_text, re.I | re.M)
    return data, {'requestedRange': value, 'start': start, 'end': end, 'archiveBytes': total, 'bytes': len(data),
                  'sha256': sha(data), 'archiveLastModified': modified.group(1).strip() if modified else None}


def acquire(cache):
    cache.mkdir(parents=True, exist_ok=True)
    tail, tail_meta = fetch_range(cache, 'central-directory', '-65536', 65536)
    with zipfile.ZipFile(io.BytesIO(tail)) as archive:
        info = archive.getinfo(MEMBER)
        local_offset = tail_meta['start'] + info.header_offset
    if info.date_time != (2025, 11, 17, 9, 16, 38) or info.compress_type != 8:
        raise ValueError('Source member vintage or compression changed; review before publishing.')
    header, header_meta = fetch_range(cache, 'sales-local-header', f'{local_offset}-{local_offset+29}', 30)
    values = struct.unpack('<4s5H3I2H', header)
    if values[0] != b'PK\x03\x04': raise ValueError('Invalid local ZIP header.')
    filename_len, extra_len = values[-2:]
    data_offset = local_offset + 30 + filename_len + extra_len
    local_name, name_meta = fetch_range(cache, 'sales-name', f'{local_offset+30}-{data_offset-1}', filename_len + extra_len)
    if local_name[:filename_len].decode('utf-8') != MEMBER: raise ValueError('Member name differs from reviewed target.')
    compressed, compressed_meta = fetch_range(cache, 'sales-compressed', f'{data_offset}-{data_offset+info.compress_size-1}', info.compress_size)
    if len({m['archiveBytes'] for m in [tail_meta,header_meta,name_meta,compressed_meta]}) != 1:
        raise ValueError('Archive length changed during range acquisition.')
    raw = zlib.decompress(compressed, -15)
    if len(raw) != info.file_size or zlib.crc32(raw) != info.CRC: raise ValueError('Member length or CRC32 validation failed.')
    metadata = {'url': URL, 'member': MEMBER, 'archiveBytes': tail_meta['archiveBytes'],
                'archiveLastModified': compressed_meta['archiveLastModified'], 'archiveEntryTimestamp': datetime(*info.date_time).isoformat(),
                'timestampTimezone': 'unspecified ZIP timestamp', 'memberBytes': len(raw), 'memberSha256': sha(raw),
                'memberCompressedBytes': len(compressed), 'memberCompressedSha256': sha(compressed), 'memberCrc32': f'{info.CRC:08x}',
                'ranges': [tail_meta,header_meta,name_meta,compressed_meta], 'retrievedAt': datetime.now(timezone.utc).isoformat(),
                'extractionMethod': 'Ordinary HTTP 206 byte ranges: ZIP central directory, exact local header/name, and sales member only; DEFLATE, length and CRC32 checked.',
                'archiveSha256': None, 'archiveHashStatus': 'Whole archive not downloaded; hashes cover the retrieved ranges and exact sales member.'}
    (cache / 'acquisition.json').write_bytes(encoded(metadata))
    return raw, metadata


def publish(raw, metadata, study_path, output):
    if output.exists(): raise ValueError('Use a new output directory; prior snapshots cannot be silently overwritten.')
    study_bytes = study_path.read_bytes()
    locators = [r['parcelId'] for r in json.loads(study_bytes)['records']]
    if len(set(locators)) != len(locators) or not all(re.fullmatch(r'[A-Z0-9]{7}\d{2}', p) for p in locators):
        raise ValueError('Expected unique exact county locators with numeric two-character suffixes.')
    records = {p: {'parcelId': p, 'sales': []} for p in sorted(locators)}
    reader = csv.DictReader(io.TextIOWrapper(io.BytesIO(raw), encoding='latin-1', newline=''), delimiter='|')
    if reader.fieldnames != EXPECTED_COLUMNS: raise ValueError(f'Source column schema changed: {reader.fieldnames}')
    total = 0
    source_max_iso = None
    source_max_raw = None
    for source_row, row in enumerate(reader, start=2):
        total += 1
        date_raw, iso, _ = source_date(row.get('SALEDT'), 2025)
        if iso and (source_max_iso is None or iso > source_max_iso): source_max_iso, source_max_raw = iso, date_raw
        locator = text(row.get('PARID'))
        if locator not in records: continue
        if None in row: raise ValueError(f'Unexpected columns at source record {source_row}.')
        records[locator]['sales'].append(transform('sales', row, source_row, 2025))
    rows = [row for record in records.values() for row in record['sales']]
    dates = sorted(row['saleDateISO'] for row in rows if row['saleDateISO'])
    max_iso = dates[-1] if dates else None
    max_raw = sorted({r['saleDate'] for r in rows if r['saleDateISO'] == max_iso})
    stats = {'sourceRowsScanned': total, 'retainedRows': len(rows), 'matchedLocators': sum(bool(r['sales']) for r in records.values()),
             'unmatchedLocators': sum(not r['sales'] for r in records.values()),
             'locatorsWithMultipleRows': sum(len(r['sales']) > 1 for r in records.values()),
             'priceStatuses': dict(sorted(Counter(r['priceStatus'] for r in rows).items())),
             'sourceValidityCodes': dict(sorted(Counter(r['validityCode'] or '(not supplied)' for r in rows).items())),
             'interpretedDateRange': [dates[0], dates[-1]] if dates else None,
             'maxObservedSaleDateISO': max_iso, 'maxObservedSaleDateRaw': max_raw,
             'maxObservedSaleDateScope': 'Retained rows matching current study locators',
             'wholeArchiveMaxObservedSaleDateISO': source_max_iso, 'wholeArchiveMaxObservedSaleDateRaw': source_max_raw,
             'twoDigitCenturyInterpretations': sum(r['saleDateCenturyInferred'] for r in rows),
             'unparsedNonemptySaleDates': sum(bool(r['saleDate']) and r['saleDateISO'] is None for r in rows)}
    buckets = {f'{n:02d}': {} for n in range(100)}
    for locator, record in records.items(): buckets[locator[-2:]][locator] = record
    (output / 'tiles').mkdir(parents=True)
    tiles = []
    for key, bucket in buckets.items():
        data = encoded({'schema': 'county-transfers-v1', 'sourceId': SOURCE_ID, 'records': bucket})
        (output / 'tiles' / f'{key}.json').write_bytes(data)
        tiles.append({'id': key, 'url': f'/st-louis/county-transfers-2025/tiles/{key}.json', 'locatorCount': len(bucket), 'bytes': len(data), 'sha256': sha(data)})
    source = {k: v for k, v in metadata.items() if k != 'ranges'}
    source.update(id=SOURCE_ID, name='St. Louis County 2025 billing extract — sales history', archiveUrl=URL,
                  catalogUrl='https://revenue.stlouisco.com/pdfs/2025/',
                  components={'sales': {'file': MEMBER, 'archiveEntryTimestamp': metadata['archiveEntryTimestamp'], 'timestampTimezone': metadata['timestampTimezone'], 'bytes': metadata['memberBytes'], 'sha256': metadata['memberSha256']}})
    manifest = {'schema': 'county-transfers-manifest-v1', 'historical': True, 'source': source,
                'currentStudyIndexSha256': sha(study_bytes), 'studyLocatorCount': len(records),
                'locatorsWithAnyHistory': stats['matchedLocators'], 'counts': {'sales': stats}, 'tiles': tiles,
                'tileKeyRule': 'Last two characters of the exact nine-character County parcel locator.',
                'sourceRowRule': 'One-based logical delimited record number, including the header as record 1. Duplicate source rows are retained. Byte-preserving Latin-1 decode.',
                'dateRule': 'Raw source dates are retained. Two-digit years are interpreted in the 1926–2025 window defined by the 2025 member timestamp, with every interpretation flagged; ISO dates are not independent verification.',
                'priceRule': 'Zero, missing and negative amounts remain distinct. Positive recorded amounts at or below USD 100 are flagged for review, not declared arm-length market prices.',
                'codeLabels': {'saleValidity': SALE_VALIDITY, 'marketValidity': MARKET_VALIDITY, 'saleType': {'1':'Land','2':'Land and building','3':'Building'}},
                'limitations': ['Sales member extracted November 17, 2025; this is a dated administrative history, not a live current-ownership registry.',
                                'Source-coded transfers include duplicate, zero-price and nonmarket records; they are not independently verified comparable sales.',
                                'Exact locator matching does not independently certify parcel boundary or identity continuity across years.',
                                'NOTES and all owner/contact fields are omitted. No payments, balances or tax charges are in this transfer dataset.']}
    (output / 'manifest.json').write_bytes(encoded(manifest))
    print(json.dumps({'output': str(output), 'studyLocators': len(records), 'tiles': len(tiles), 'sales': stats, 'totalTileBytes': sum(t['bytes'] for t in tiles)}), flush=True)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['cache','study','output']: parser.add_argument('--' + key, type=Path, required=True)
    parser.add_argument('--reuse-cache', action='store_true', help='Reuse previously acquired exact member after rechecking hashes and CRC; no network.')
    args = parser.parse_args()
    if args.output.exists(): raise ValueError('Output already exists; use a new directory.')
    if args.reuse_cache:
        metadata = json.loads((args.cache / 'acquisition.json').read_text())
        compressed = (args.cache / 'sales-compressed.bin').read_bytes()
        if metadata['url'] != URL or metadata['member'] != MEMBER or sha(compressed) != metadata['memberCompressedSha256']:
            raise ValueError('Cached source identity or compressed member hash differs.')
        raw = zlib.decompress(compressed, -15)
        if sha(raw) != metadata['memberSha256'] or len(raw) != metadata['memberBytes'] or f'{zlib.crc32(raw):08x}' != metadata['memberCrc32']:
            raise ValueError('Cached uncompressed member validation failed.')
    else:
        raw, metadata = acquire(args.cache)
    publish(raw, metadata, args.study, args.output)


if __name__ == '__main__': main()
