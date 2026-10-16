# /// script
# requires-python = ">=3.12"
# dependencies = ["openpyxl==3.1.5"]
# ///
"""Build the public NMTC atlas. Exact cents, explicit representative geography.

Run with uv run scripts/spatial-economics/build_national.py. Cached source files
are immutable inputs; this script never silently downloads or changes vintages.
"""
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from zipfile import ZipFile
import csv
import hashlib
import io
import json
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.geospatial-cache'
OUT = ROOT / 'public/spatial-economics/national'
WORKBOOK = 'NMTC_FY2003_FY2023_2026-08.xlsx'
GAZETTEER = '2020_Gaz_tracts_national.zip'
SOURCES = [
    (WORKBOOK, 'https://www.cdfifund.gov/system/files?file=2026-08%2FNMTC_Public_Data_Release_includes_FY2003_FY_2023_Data_Final_08062026.xlsx'),
    (GAZETTEER, 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_tracts_national.zip'),
]

def cents(value):
    result = int((Decimal(str(value)) * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    if result < 0:
        raise ValueError('Negative reported financing or cost requires review')
    return result

def main():
    expected='640c57ff8b639a82ede020d2b96c4d09877c5bed50b72c794d5f5a9ca666d1a4'
    assert hashlib.sha256((CACHE/WORKBOOK).read_bytes()).hexdigest()==expected, 'Unexpected workbook vintage; review the new release before building'
    with ZipFile(CACHE / GAZETTEER) as archive:
        rows = csv.DictReader(io.StringIO(archive.read('2020_Gaz_tracts_national.txt').decode()), delimiter='\t')
        gaz = {r['GEOID']: {k.strip():v.strip() for k,v in r.items()} for r in rows}
    book = load_workbook(CACHE / WORKBOOK, read_only=True, data_only=True)
    transactions = list(book.worksheets[0].values)[1:]
    project_rows = list(book.worksheets[1].values)[1:]
    flows = defaultdict(lambda: defaultdict(int))
    tx_counts = Counter()
    tx_keys = set()
    for r in transactions:
        key = (r[0], r[1], r[2])
        assert key not in tx_keys, f'Duplicate transaction identity {key}'
        tx_keys.add(key)
        flows[r[0]][int(r[5])] += cents(r[7])
        tx_counts[r[0]] += 1
    projects = []
    seen = set()
    for r in project_rows:
        pid, tract = str(r[0]), str(r[1]).zfill(11)
        assert pid not in seen and len(tract) == 11 and tract.isdigit()
        seen.add(pid)
        reported = cents(r[5])
        assert reported == sum(flows[pid].values()), f'Project {pid} does not reconcile'
        point = gaz.get(tract)
        if point:
            assert point['USPS'] == r[8], f'Geographic state mismatch for {pid}'
        projects.append({
            'id':pid, 'tract':tract, 'state':r[8], 'city':r[7],
            'metro':r[2], 'projectYear':int(r[3]), 'type':r[10],
            'financingCents':reported, 'estimatedCostCents':cents(r[6]),
            'multiCde':r[11] == 'YES', 'multiTract':r[12] == 'YES',
            'transactions':tx_counts[pid],
            'flows':sorted([year, value] for year,value in flows[pid].items()),
            'point':[float(point['INTPTLONG']),float(point['INTPTLAT'])] if point else None,
        })
    assert set(flows) == seen, 'Transaction and project identities differ'
    assert len(projects) == 8439 and len(transactions) == 21202
    total = sum(p['financingCents'] for p in projects)
    assert total == 7101879285855, 'Published source vintage has changed'
    missing = [p for p in projects if p['point'] is None]
    coverage = {
        'projects':len(projects), 'transactions':len(transactions), 'financingCents':total,
        'mappedProjects':len(projects)-len(missing),
        'unmappedFinancingCents':sum(p['financingCents'] for p in missing),
        'unmappedProjects':[p['id'] for p in missing],
        'statesAndTerritories':len({p['state'] for p in projects}),
        'multiYearProjects':sum(len(p['flows'])>1 for p in projects),
        'multiTractProjects':sum(p['multiTract'] for p in projects),
        'projectReconciliationFailures':0,
    }
    manifest = {
        'schemaVersion':1, 'release':'FY 2025 NMTC public data release, FY 2003–2023',
        'releaseUpdated':'2026-08-07', 'retrieved':'2026-10-16',
        'originationYears':[min(y for f in flows.values() for y in f),max(y for f in flows.values() for y in f)],
        'sources':[{'file':name,'url':url,'bytes':(CACHE/name).stat().st_size,'sha256':hashlib.sha256((CACHE/name).read_bytes()).hexdigest()} for name,url in SOURCES],
        'coverage':coverage,
        'method':{
            'unit':'Unique project; financing flows grouped by transaction origination year.',
            'amounts':'Integer US cents. Nominal reported QLICI financing, not inflation-adjusted, tax expenditure, additional investment or causal effects.',
            'geography':'2020 Census tract internal points, not project coordinates. All flows assigned to the project sheet representative tract, state and metro classification. Multi-tract projects may finance activity elsewhere.',
            'missing':'Five projects in AS, GU and VI have no match in the national Gazetteer. Retained in all relevant totals and tables; no invented map positions.',
            'time':'Filter transaction origination years; a project may appear in several years, counted once within a selected interval. Project-level characteristics are held fixed. Years 2001 and 2002 occur in the published workbook despite the release title.',
            'metro':'Project-sheet classification using 2020 tracts and March 2020 OMB definitions, not current rural eligibility.',
            'cost':'Estimated total project cost is retained for source inspection, not interpreted as private capital or multiplied by financing.',
            'research':'Separate descriptive atlas. The NMTC paper retains its 2001–2022 dataset and original estimates.',
        },
        'build':'scripts/spatial-economics/build_national.py',
    }
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'projects.json').write_text(json.dumps({'schemaVersion':1,'projects':projects},separators=(',',':'))+'\n')
    (OUT/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(coverage,indent=2))

if __name__ == '__main__':
    main()
