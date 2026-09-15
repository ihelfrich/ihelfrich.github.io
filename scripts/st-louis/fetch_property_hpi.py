#!/usr/bin/env python3
"""Publish official historical St. Louis metro HPI context; no home valuation.

uv run --no-project python scripts/st-louis/fetch_property_hpi.py
--cached validates/rebuilds the prior successful observation without re-dating it.
"""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import math
import os
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT/'public/st-louis/valuation/market-context.json'
RESEARCH=ROOT.parent/'research/property-resident-valuation-2026-09-13'
URL='https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_po_metro.txt'
SOURCE_ID='fhfa-hpi-purchase-only-st-louis-metro'
SERIES_NAME='FHFA purchase-only HPI — St. Louis, MO-IL — not seasonally adjusted'
LIMITATIONS=[
 'Historical metro-wide price index, not the current or future market value of an individual house.',
 'St. Louis, MO-IL metro geography extends beyond St. Louis City and County; it is not an Overland or neighborhood index.',
 'Purchase-only repeat-sales sample reflects mortgages purchased or securitized by Fannie Mae and Freddie Mac, not all cash, jumbo, or other transactions.',
 'Index values are nominal and not seasonally adjusted. Same-quarter changes limit seasonal comparison effects but do not remove all sampling uncertainty.',
 'FHFA revises historical observations as additional transactions arrive. This download vintage is retained separately from the quarter observed.',
 'Trailing growth rates describe past index changes. They are not forecasts, guaranteed appreciation, or justified adjustments for a particular property.',
 'Property condition, improvements, contract terms, financing concessions, and other local differences are not measured by this index.'
]

def encode(value):return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def stamp():return dt.datetime.now(dt.timezone.utc).isoformat()
def ordinal(year,quarter):return year*4+quarter-1

def parse(raw):
 reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')),delimiter='\t')
 if reader.fieldnames!=['cbsa','metro_name','yr','qtr','index_nsa','index_sa']:raise ValueError('FHFA purchase-only source header changed')
 observations=[];seen=set()
 for row in reader:
  if row.get('cbsa')!='41180':continue
  if row.get('metro_name')!='St. Louis, MO-IL':raise ValueError('CBSA identity and metro name disagree')
  year=int(row['yr']);quarter=int(row['qtr']);index=float(row['index_nsa'])
  if not 1991<=year<=2100 or not 1<=quarter<=4 or not math.isfinite(index) or index<=0:raise ValueError('Invalid historical index observation')
  period=f'{year}Q{quarter}'
  if period in seen:raise ValueError('Duplicate FHFA metro quarter')
  seen.add(period);observations.append({'period':period,'year':year,'quarter':quarter,'index':index})
 observations.sort(key=lambda r:ordinal(r['year'],r['quarter']))
 if not observations or observations[0]!={'period':'1991Q1','year':1991,'quarter':1,'index':100.0}:raise ValueError('Expected St. Louis series base is missing')
 if len(observations)>500 or any(ordinal(b['year'],b['quarter'])-ordinal(a['year'],a['quarter'])!=1 for a,b in zip(observations,observations[1:])):raise ValueError('St. Louis HPI quarter coverage is incomplete')
 return observations

def changes(observations):
 latest=observations[-1];lookup={r['period']:r['index'] for r in observations}
 def rate(years):
  prior=lookup.get(f"{latest['year']-years}Q{latest['quarter']}")
  return None if prior is None else ((latest['index']/prior)**(1/years)-1)*100
 return {'oneYearPct':rate(1),'threeYearAnnualizedPct':rate(3),'fiveYearAnnualizedPct':rate(5)}

def build(raw,retrieved_at,headers=None):
 observed=dt.datetime.fromisoformat(retrieved_at.replace('Z','+00:00'))
 if observed.tzinfo is None:raise ValueError('Retrieval timestamp must have an explicit timezone')
 observed=observed.astimezone(dt.timezone.utc)
 observations=parse(raw);latest=observations[-1]
 if ordinal(latest['year'],latest['quarter'])>ordinal(observed.year,(observed.month-1)//3+1):raise ValueError('Index quarter is later than the source observation')
 headers=headers or {}
 return {'schema':'property-market-context-v1','source':{'id':SOURCE_ID,'url':URL,'catalogUrl':'https://www.fhfa.gov/data/hpi/datasets','methodologyUrl':'https://www.fhfa.gov/faqs/hpi',
  'retrievedAt':retrieved_at,'sourcePublishedAt':None,'httpLastModified':headers.get('Last-Modified'),'sourceBytes':len(raw),'sourceSha256':hashlib.sha256(raw).hexdigest(),
  'seriesName':SERIES_NAME,'cbsa':'41180','geography':'St. Louis, MO-IL metropolitan statistical area','measure':'purchase-only','seasonalAdjustment':'not-seasonally-adjusted','nominal':True,'forecast':False,
  'indexBase':{'period':'1991Q1','value':100},'sourceFields':{'year':'yr','quarter':'qtr','index':'index_nsa'},'licenseNote':'Publicly downloadable FHFA statistical index; original agency attribution retained.'},
  'observations':observations,'latest':latest,'changes':changes(observations),'limitations':LIMITATIONS}

def atomic_write(path,raw):
 path.parent.mkdir(parents=True,exist_ok=True);temporary=None
 try:
  with tempfile.NamedTemporaryFile(prefix=path.name+'.',suffix='.tmp',dir=path.parent,delete=False) as f:temporary=Path(f.name);f.write(raw);f.flush();os.fsync(f.fileno())
  os.replace(temporary,path)
 finally:
  if temporary and temporary.exists():temporary.unlink()

def fetch_source():
 for attempt in range(2):
  try:
   with urllib.request.urlopen(URL,timeout=25) as response:
    raw=response.read(2_000_001);headers={'Last-Modified':response.headers.get('Last-Modified')}
   if len(raw)>2_000_000:raise ValueError('FHFA data exceeds the download budget')
   return raw,stamp(),headers
  except Exception:
   if attempt==1:raise
   time.sleep(1)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--cached',action='store_true');args=parser.parse_args();started=stamp();RESEARCH.mkdir(parents=True,exist_ok=True)
 try:
  if args.cached:
   receipt=json.loads((RESEARCH/'hpi-verified-receipt.json').read_text());raw=(RESEARCH/'hpi_po_metro.txt').read_bytes()
   if hashlib.sha256(raw).hexdigest()!=receipt['sha256']:raise ValueError('Cached FHFA source digest differs from receipt')
   retrieved_at=receipt['retrievedAt'];headers=receipt['headers']
  else:raw,retrieved_at,headers=fetch_source()
  result=build(raw,retrieved_at,headers)
  if not args.cached:
   atomic_write(RESEARCH/'hpi_po_metro.txt',raw);atomic_write(RESEARCH/'hpi-verified-receipt.json',encode({'url':URL,'retrievedAt':retrieved_at,'headers':headers,'sha256':hashlib.sha256(raw).hexdigest()}))
  atomic_write(OUTPUT,encode(result));atomic_write(RESEARCH/'hpi-health.json',encode({'status':'ready','attemptedAt':started,'retrievedAt':retrieved_at,'latestPeriod':result['latest']['period']}))
  print(json.dumps({'status':'ready','observations':len(result['observations']),'latest':result['latest'],'changes':result['changes'],'retrievedAt':retrieved_at}))
 except Exception as error:
  atomic_write(RESEARCH/'hpi-health.json',encode({'status':'failed','attemptedAt':started,'priorDataRetained':OUTPUT.exists(),'error':str(error)[:500]}));raise

if __name__=='__main__':main()
