"""Execute three independent enumerations; check identities, targets and units."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import csv, hashlib, io, json, math, platform, subprocess, sys

ROOT=Path(__file__).resolve().parent
commands={'Python':[sys.executable,str(ROOT/'alert-worlds.py')],
          'Julia':['julia','--startup-file=no',str(ROOT/'alert-worlds.jl')],
          'R':['Rscript',str(ROOT/'alert-worlds.R')]}
def execute(item):
    language,command=item
    p=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=45,check=True)
    records=list(csv.DictReader(io.StringIO(p.stdout)))
    assert len({r['metric'] for r in records})==len(records), 'duplicate output metric'
    return language,{r['metric']:float(r['value']) for r in records}
with ThreadPoolExecutor(max_workers=3) as pool:
    values=dict(pool.map(execute,commands.items()))
ref=values['Python']; maximum={}
for lang,v in values.items():
    assert v.keys()==ref.keys(), lang
    assert all(math.isfinite(x) for x in v.values()), lang
    assert all(math.isclose(v[k],ref[k],rel_tol=1e-12,abs_tol=1e-12) for k in ref), lang
    maximum[lang]=max(abs(v[k]-ref[k]) for k in ref)
analytic={'probability_sum':1,'heat_mean':.5,'shock_mean':0,
          'missing_heat0_alert1_probability':0,'missing_heat1_alert0_probability':0}
for b in (-2,-1,0,1,2):
    targets={'observed_mean':11,'conditional0':10,'conditional1':12,'observed_difference':2,
        'forecast_mse':2/3,'constant_mse':5/3,'poor_forecast_mse':5/3,
        'do0_mean':11-b/2,'do1_mean':11+b/2,'paired_effect':b,
        'randomized0':11-b/2,'randomized1':11+b/2,'randomized_difference':b,
        'net_benefit':-1000*b-500,'mse_kw2':2_000_000/3,'effect_kw':1000*b,
        'observational_invariance_error':0}
    analytic.update({f'b{b}_{k}':v for k,v in targets.items()})
for k,target in analytic.items():
    assert math.isclose(ref[k],target,rel_tol=1e-12,abs_tol=1e-12),(k,ref[k],target)
row_checks=0
for b in (-2,-1,0,1,2):
    assert ref[f'b{b}_minimum_intervention_load']>=7
    for i,(heat,shock) in enumerate([(u,v) for u in (0,1) for v in (-1,0,1)],1):
        assert ref[f'b{b}_observed_state{i}']==10+2*heat+shock
        assert ref[f'b{b}_do1_state{i}']-ref[f'b{b}_do0_state{i}']==b
        row_checks+=2
version_commands={'Julia':['julia','--version'],'R':['Rscript','--version']}
versions={'Python':platform.python_version()}
for lang,command in version_commands.items():
    p=subprocess.run(command,capture_output=True,text=True,timeout=15,check=True)
    versions[lang]=(p.stdout+p.stderr).strip()
fixture=ROOT/'data/alert-days.csv'
report={'passed':True,'kind':'exact finite enumeration of controlled states',
        'languages':list(values),'native_versions':versions,'matched_metrics':len(ref),
        'analytic_targets':len(analytic),'row_invariant_checks':row_checks,
        'positive_intervention_load_checks':5,'maximum_absolute_difference':maximum,
        'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),
        'probability_design':'six equal background states; twelve independent-assignment states',
        'parameters_checked':[-2,-1,0,1,2],'random_draws':0,
        'mathematical_proof_status':'handbook supplies an algebraic and probabilistic proof; no formal proof assistant used',
        'empirical_alert_effect_estimated':False,'live_assessments_included':False}
(ROOT/'results').mkdir(exist_ok=True)
(ROOT/'results/verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
