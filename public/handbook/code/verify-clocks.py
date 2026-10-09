"""Execute three independent implementations; check hand-specified release boundaries and proofs."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import csv,hashlib,io,json,math,platform,subprocess,sys
ROOT=Path(__file__).resolve().parent
commands={'Python':[sys.executable,str(ROOT/'clocks.py')],
          'Julia':['julia','--startup-file=no',str(ROOT/'clocks.jl')],
          'R':['Rscript',str(ROOT/'clocks.R')]}
def execute(item):
    name,command=item
    process=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=45,check=True)
    rows=list(csv.DictReader(io.StringIO(process.stdout)))
    assert len(set(r['metric'] for r in rows))==len(rows)
    return name,{r['metric']:float(r['value']) for r in rows}
with ThreadPoolExecutor(max_workers=3) as pool:values=dict(pool.map(execute,commands.items()))
ref=values['Python'];close=lambda a,b:math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-10)
for name,v in values.items():
    assert v.keys()==ref.keys(),name
    assert all(math.isfinite(x) for x in v.values()),name
    assert all(close(ref[k],v[k]) for k in ref),name
# Explicit oracle: the first row is missing at a quarter end; release boundaries are inclusive.
stages={0:[0,0,1,1,1,2,2,3,3],60:[0,0,0,1,1,1,2,2,3],3600:[0,0,0,0,1,1,2,2,3]}
growth={1:1.6,2:1.3,3:1.4};targets={}
for delay,sequence in stages.items():
    for i,stage in enumerate(sequence):
        p=f'gdp_o{i}_d{delay}_'
        targets.update({p+'stage':stage,p+'found':int(stage>0),p+'eligible_rows':stage,
            p+'append_same':1,p+'reorder_same':1,p+'future_mutation_same':1,
            p+'latest_value':1.4,p+'mutated_latest_value':1.4+(10 if stage<3 else 0)})
        if stage:targets.update({p+'growth':growth[stage],p+'mutated_growth':growth[stage]})
targets.update(revision_second_minus_advance=-.3,revision_third_minus_second=.1,
    revision_third_minus_advance=-.2,toy_before=3,toy_locked=3.5,toy_after_revision=2,
    toy_late=2,toy_mutated_locked=3.5,toy_mutated_late=502,toy_first_target=5,toy_revised_target=7,
    toy_first_squared_error=2.25,toy_revised_squared_error=12.25,toy_late_first_squared_error=9,
    toy_late_revised_squared_error=25,toy_score_cross_term=6,toy_score_revision_squared=4,
    worlds=4,probability_sum=1,no_information_mean=3,no_information_risk=5,coarse_risk=1,
    coarse_gain=4,exact_risk=0,nonadapted_pair_count=2,duplicate_rejected=1,nonfinite_rejected=1,
    negative_delay_rejected=1,empty_forecast_rejected=1,
    state1_coarse_forecast=1,state2_coarse_forecast=1,state3_coarse_forecast=5,state4_coarse_forecast=5)
for stage,g in growth.items():targets[f'stage{stage}_quarterly_percent']=100*(math.expm1(math.log1p(g/100)/4))
assert targets.keys()==ref.keys()
for k,v in targets.items():assert close(ref[k],v),(k,ref[k],v)
assert close(ref['no_information_risk']-ref['coarse_risk'],ref['coarse_gain'])
assert close(ref['toy_revised_squared_error']-ref['toy_first_squared_error'],ref['toy_score_cross_term']+ref['toy_score_revision_squared'])
with (ROOT/'data/gdp-release-ledger.csv').open() as f:extract=list(csv.DictReader(f))
receipts=json.loads((ROOT/'data/gdp-source-receipts.json').read_text())['receipts']
assert len(extract)==len(receipts)==3
for r,source in zip(extract,receipts):
    utc=datetime.fromisoformat(r['release_utc']);local=utc.astimezone(ZoneInfo('America/New_York'))
    assert (local.hour,local.minute)==(8,30) and local.utcoffset().total_seconds()==-4*3600
    assert float(r['value_percent'])==source['headline_percent_annualized']
versions={'Python':platform.python_version()}
for name,command in {'Julia':['julia','--version'],'R':['Rscript','--version']}.items():
    p=subprocess.run(command,capture_output=True,text=True,timeout=15,check=True)
    versions[name]=(p.stdout+p.stderr).strip()
names=['gdp-release-ledger.csv','clock-origins.csv','controlled-release-ledger.csv','information-worlds.csv']
report={'passed':True,'matched_metrics':len(ref),'explicit_targets':len(targets),
 'native_versions':versions,'maximum_absolute_difference':{name:max(abs(v[k]-ref[k]) for k in ref) for name,v in values.items()},
 'relative_tolerance':1e-12,'absolute_tolerance':1e-10,'origin_count':9,'collection_delays_seconds':[0,60,3600],
 'inclusive_availability_rule':True,'future_mutation_and_append_grid_checks':54,
 'reorder_grid_checks':27,'domain_rejections_per_language':4,'score_and_information_gain_identities':2,
 'source_header_time_and_headline_checks':3,'fixture_sha256':{n:hashlib.sha256((ROOT/'data'/n).read_bytes()).hexdigest() for n in names},
 'empirical_scope':'Three archived BEA headline GDP estimates for 2024 Q1; no nowcast fitted or predictive performance inferred.',
 'controlled_scope':'Six authored monthly-index releases and four equally weighted information states.',
 'random_draws':0,'timestamp_assumption':'Provider release clock plus declared constant collection delay; no historical ingestion evidence is claimed.'}
(ROOT/'results/clocks-verification.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'results/clocks-reference.json').write_text(json.dumps(ref,indent=2,sort_keys=True)+'\n')
print(json.dumps(report,indent=2))
