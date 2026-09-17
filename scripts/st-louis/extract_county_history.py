"""Extract only public, allowlisted historical records for exact current locators.

uv run --no-project python scripts/st-louis/extract_county_history.py \
  --archive ../research/county-records-2026/Real_Estate_Data_Extract_CERT21.zip \
  --download ../research/county-records-2026/cert21-download.json \
  --catalog ../research/county-records-2026/cert21-item.json \
  --study public/st-louis/county-current/index.json \
  --output public/st-louis/county-history

No payments, balances, owner/contact fields, or freeform notes are emitted.
Source rows, including duplicate classes and duplicate sale records, are retained.
"""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

COLLECTIONS = {'taxdata.csv': 'taxes', 'sales.csv': 'sales',
               'assessment.csv': 'assessments', 'appraisal.csv': 'appraisals'}
SALE_VALIDITY = {'1': 'Additional parcels', '2': 'Not open market / atypical motivation',
                 '3': 'Changed after sale', '4': 'Related individuals / corporation',
                 '5': 'Liquidation / foreclosure', '6': 'Financing / land contracts',
                 '7': 'Includes excess personal property / see source notes',
                 '8': 'Partial interest', 'D': 'Deleted / duplicate', 'F': 'FHA',
                 'I': 'Investor', 'P': 'Probable valid sale', 'Q': 'Query sale',
                 'R': 'Resale / to be reviewed', 'T': 'Transfer',
                 'U': 'Usable multi-parcel sale', 'V': 'COV (unverified)',
                 'X': 'Valid sale (source code)', 'Z': 'Bank owned'}
MARKET_VALIDITY = {'0': 'Valid sale (source code)', '1': 'Multiple parcels',
                   '2': 'Not open market', '3': 'Property changed after sale',
                   '4': 'Related individuals or corporation',
                   '5': 'Liquidation / foreclosure', '6': 'Land contract / unusual financing',
                   '7': 'Excess personal property / not arms length',
                   '8': 'Not validated', '9': 'Invalid sale date', 'A': 'Outlier (source code)'}


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def digest_file(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def text(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def number(value):
    value = text(value)
    if value is None:
        return None
    try:
        parsed = Decimal(value)
    except InvalidOperation as error:
        raise ValueError('Unexpected numeric source field') from error
    if not parsed.is_finite():
        raise ValueError('Nonfinite numeric source field')
    return int(parsed) if parsed == parsed.to_integral_value() else float(parsed)


def source_date(value, archive_year):
    """Keep the source string and flag every two-digit-century interpretation."""
    raw = text(value)
    if not raw:
        return None, None, False
    match = re.fullmatch(r'(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})', raw)
    if not match:
        return raw, None, False
    day, month, year = match.groups()
    inferred = len(year) == 2
    full_year = int(year)
    if inferred:
        full_year += 2000 if full_year <= archive_year % 100 else 1900
    try:
        iso = datetime.strptime(f'{day}-{month}-{full_year}', '%d-%b-%Y').date().isoformat()
    except ValueError:
        iso = None
    return raw, iso, inferred


def transform(collection, row, source_row, archive_year):
    out = {'sourceRow': source_row}
    if collection == 'taxes':
        out.update(taxYear=number(row.get('TAXYR')), rollType=text(row.get('ROLLTYPE')),
                   assessmentClass=text(row.get('VALCLASS')),
                   taxAmountUSD=number(row.get('TAXAMOUNT')),
                   otherFeesUSD=number(row.get('OTHERTAX')))
    elif collection == 'sales':
        price = number(row.get('PRICE'))
        out.update(priceUSD=price, priceStatus='missing' if price is None else
                   'negative-recorded' if price < 0 else 'zero-recorded' if price == 0 else
                   'low-recorded-amount' if price <= 100 else 'recorded')
        for source, target in [('SALEDT', 'saleDate'), ('TRANSDT', 'transactionDate')]:
            raw, iso, inferred = source_date(row.get(source), archive_year)
            out[target], out[target + 'ISO'], out[target + 'CenturyInferred'] = raw, iso, inferred
        for source, target in [('TRANSNO', 'transferNumber'), ('BOOK', 'book'), ('PAGE', 'page'),
                               ('SOURCE', 'sourceCode'), ('SALETYPE', 'saleTypeCode'),
                               ('SALEVAL', 'validityCode'), ('INSTRUNO', 'instrumentNumber'),
                               ('INSTRTYP', 'instrumentTypeCode'), ('MKTVALID', 'marketValidityCode')]:
            out[target] = text(row.get(source))
        out['flags'] = []
        if out['validityCode'] == '2' or out['marketValidityCode'] == '2':
            out['flags'].append('source-not-open-market')
        if out['validityCode'] == '4' or out['marketValidityCode'] == '4':
            out['flags'].append('source-related-parties')
        if out['validityCode'] == 'D':
            out['flags'].append('source-deleted-or-duplicate')
        if out['validityCode'] is None and out['marketValidityCode'] is None:
            out['flags'].append('validity-not-supplied')
    else:
        out['taxYear'] = number(row.get('TAXYR'))
        out['reasonCode'] = text(row.get('REASCD'))
        amount_fields = {'APRLAND': 'appraisedLandUSD', 'APRBLDG': 'appraisedBuildingUSD',
                         'APRTOT': 'appraisedTotalUSD'}
        if collection == 'assessments':
            for source, target in [('VALCLASS', 'assessmentClass'), ('CLASS', 'classification'),
                                   ('LUC', 'landUseCode'), ('TAXCODE', 'taxCode')]:
                out[target] = text(row.get(source))
            amount_fields.update(ASMLAND='assessedLandUSD', ASMBLDG='assessedBuildingUSD',
                                 ASMTOT='assessedTotalUSD', TAXTOT='taxableAssessedUSD',
                                 EXLAND='exemptAssessedLandUSD', EXBLDG='exemptAssessedBuildingUSD',
                                 EXTOT='exemptAssessedTotalUSD')
        else:
            out['rollType'] = text(row.get('ROLLTYPE'))
            amount_fields.update(COSTVAL='costValueUSD', MKTVAL='sourceMarketValueUSD',
                                 ASSMKT='sourceAssessedValueUSD')
        for source, target in amount_fields.items():
            out[target] = number(row.get(source))
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['archive', 'download', 'catalog', 'study', 'output']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Use a new output directory; published snapshots cannot be silently overwritten.')
    download, catalog = json.loads(args.download.read_text()), json.loads(args.catalog.read_text())
    if catalog.get('id') != '3ad7bec2310d4a4ab36f7668d4bca6e5':
        raise ValueError('This extractor is scoped to the documented CERT21 source item.')
    archive_sha = digest_file(args.archive)
    if archive_sha != download['sha256'] or args.archive.stat().st_size != download['bytes']:
        raise ValueError('Downloaded archive does not match the recorded SHA-256 and length.')
    study_bytes = args.study.read_bytes()
    study = json.loads(study_bytes)
    locators = [row['parcelId'] for row in study['records']]
    if len(locators) != len(set(locators)) or not all(re.fullmatch(r'[A-Z0-9]{9}', locator) for locator in locators):
        raise ValueError('The current study must contain unique exact County locators.')
    records = {locator: {'parcelId': locator, **{key: [] for key in COLLECTIONS.values()}}
               for locator in sorted(locators)}
    sources, stats = {}, {}
    with zipfile.ZipFile(args.archive) as archive:
        for filename, collection in COLLECTIONS.items():
            info = archive.getinfo(filename)
            if info.date_time[:3] != (2021, 7, 6):
                raise ValueError('Archive vintage changed; review the extraction and date interpretation rules first.')
            stamp = datetime(*info.date_time).isoformat()
            archive_year = info.date_time[0]
            with archive.open(filename) as stream:
                component_sha = hashlib.file_digest(stream, 'sha256').hexdigest()
            sources[collection] = {'file': filename, 'archiveEntryTimestamp': stamp,
                                   'timestampTimezone': 'unspecified ZIP timestamp',
                                   'bytes': info.file_size, 'sha256': component_sha}
            total, selected, years = 0, 0, Counter()
            # The 2021 exports contain legacy single-byte text (e.g. 0xA0),
            # including in discarded notes. Preserve bytes instead of replacing
            # undecodable characters; emitted numeric/identifier/code fields are ASCII.
            with io.TextIOWrapper(archive.open(filename), encoding='latin-1', newline='') as stream:
                reader = csv.DictReader(stream, delimiter='|')
                if 'PARID' not in reader.fieldnames:
                    raise ValueError(f'{filename} has no exact parcel identifier.')
                for source_row, row in enumerate(reader, start=2):
                    total += 1
                    locator = text(row.get('PARID'))
                    if locator not in records:
                        continue
                    if None in row:
                        raise ValueError(f'{filename} has unexpected columns at source record {source_row}.')
                    cleaned = transform(collection, row, source_row, archive_year)
                    records[locator][collection].append(cleaned)
                    selected += 1
                    if collection != 'sales':
                        years[str(cleaned['taxYear'])] += 1
            matched = sum(bool(record[collection]) for record in records.values())
            stats[collection] = {'sourceRowsScanned': total, 'retainedRows': selected,
                                 'matchedLocators': matched, 'unmatchedLocators': len(records) - matched,
                                 'locatorsWithMultipleRows': sum(len(r[collection]) > 1 for r in records.values()),
                                 'taxYears': dict(sorted(years.items()))}
            print(json.dumps({'collection': collection, **stats[collection]}), flush=True)
    sale_rows = [sale for record in records.values() for sale in record['sales']]
    stats['sales']['priceStatuses'] = dict(sorted(Counter(row['priceStatus'] for row in sale_rows).items()))
    stats['sales']['sourceValidityCodes'] = dict(sorted(Counter(row['validityCode'] or '(not supplied)' for row in sale_rows).items()))
    iso_dates = sorted(row['saleDateISO'] for row in sale_rows if row['saleDateISO'])
    stats['sales']['interpretedDateRange'] = [iso_dates[0], iso_dates[-1]] if iso_dates else None
    stats['sales']['twoDigitCenturyInterpretations'] = sum(row['saleDateCenturyInferred'] for row in sale_rows)
    buckets = {}
    for locator, record in records.items():
        buckets.setdefault(locator[-2:], {})[locator] = record
    args.output.mkdir(parents=True)
    (args.output / 'tiles').mkdir()
    tiles = []
    for key, bucket in sorted(buckets.items()):
        data = encoded({'schema': 'county-history-tile-v1', 'sourceId': catalog['id'], 'records': bucket})
        (args.output / 'tiles' / f'{key}.json').write_bytes(data)
        tiles.append({'id': key, 'url': f'/st-louis/county-history/tiles/{key}.json',
                      'locatorCount': len(bucket), 'bytes': len(data),
                      'sha256': hashlib.sha256(data).hexdigest()})
    manifest = {
        'schema': 'county-history-manifest-v1', 'historical': True,
        'source': {'id': catalog['id'], 'name': catalog['title'],
                   'url': download['url'], 'catalogUrl': f'https://www.arcgis.com/home/item.html?id={catalog["id"]}',
                   'retrievedAt': download['retrievedAt'], 'archiveSha256': archive_sha,
                   'archiveBytes': download['bytes'],
                   'catalogModifiedAt': datetime.fromtimestamp(catalog['modified'] / 1000, timezone.utc).isoformat(),
                   'copyright': 'Copyright 2021 St. Louis County. All rights reserved.',
                   'components': sources},
        'currentStudyIndexSha256': hashlib.sha256(study_bytes).hexdigest(),
        'studyLocatorCount': len(records),
        'locatorsWithAnyHistory': sum(any(record[c] for c in COLLECTIONS.values()) for record in records.values()),
        'counts': stats, 'tiles': tiles,
        'tileKeyRule': 'Last two characters of the exact nine-character County parcel locator.',
        'sourceRowRule': 'One-based logical CSV record number, including the header as record 1. Rows are never deduplicated or summed. Legacy CSV text uses a byte-preserving Latin-1 decode.',
        'dateRule': 'Original source dates are retained. ISO dates interpret two-digit years in the 1922–2021 window defined by the 2021 archive; every such interpretation is flagged. ISO dates are for ordering, not independent date verification.',
        'priceRule': 'Zero and negative amounts remain explicit. Positive recorded amounts of USD 100 or less are flagged low-recorded-amount for review, not declared nominal consideration or market transactions.',
        'codeLabels': {'saleValidity': SALE_VALIDITY, 'marketValidity': MARKET_VALIDITY,
                       'saleType': {'1': 'Land', '2': 'Land and building', '3': 'Building'}},
        'limitations': [
            'Historical archive components date to July 6, 2021. They do not establish current bills, ownership, debt, payment, delinquency or current sale availability.',
            'Tax charges and other fees remain separate source rows by class/roll. Duplicate or multiple-class rows are not added together or treated as a complete annual bill.',
            'Source-coded sales are historical records, including duplicates and nonmarket transfers. They are not independently verified comparable transactions.',
            'Appraisal and assessment values are dated administrative values, not current purchase prices or independent market appraisals.',
            'An exact locator match links records only; historical/current parcel extent or identity continuity is not independently certified.',
            'No owner, contact, payment, balance, reviewer identity or freeform notes are included.',
        ],
    }
    (args.output / 'manifest.json').write_bytes(encoded(manifest))
    print(json.dumps({'studyLocators': len(records), 'tiles': len(tiles),
                      'totalTileBytes': sum(t['bytes'] for t in tiles),
                      'largestTileBytes': max(t['bytes'] for t in tiles)}), flush=True)


if __name__ == '__main__':
    main()
