"""Execute independent implementations and check analytic, unit and row identities."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import csv, hashlib, io, json, math, platform, subprocess, sys
ROOT=Path(__file__).resolve().parent
commands={'Python':[sys.executable,str(ROOT/'measurement.py')],
          'Julia':['julia','--startup-file=no',str(ROOT/'measurement.jl')],
          'R':['Rscript',str(ROOT/'measurement.R')]}
def execute(item):
    language,command=item
    run=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=45,check=True)
    records=list(csv.DictReader(io.StringIO(run.stdout)))
    assert len({r['metric'] for r in records})==len(records)
    return language,{r['metric']:float(r['value']) for r in records}
with ThreadPoolExecutor(max_workers=3) as pool:values=dict(pool.map(execute,commands.items()))
ref=values['Python'];maximum={}
close=lambda a,b:math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-10)
for language,v in values.items():
    assert v.keys()==ref.keys(),language
    assert all(math.isfinite(a) for a in v.values()),language
    assert all(close(v[k],ref[k]) for k in ref),language
    maximum[language]=max(abs(v[k]-ref[k]) for k in ref)
analytic={'probability_sum':1,'states':36,'aggregate_ratio':40/3,'weighted_ratio':40/3,
          'unweighted_ratio':12.5,'coverage_before':10,'coverage_after':12.5,
          'coverage_growth':.25,'coverage_log_growth':math.log(1.25),'mwh_to_joule':3.6e9}
for h in (0,2,4):
    analytic[f'h{h}_reliability']=4/(4+2*h*h/3)
    for name,kappa in [('classical',0),('compressed',-.5),('reversed',-2)]:
        scale=1+kappa;variance=4*scale*scale+2*h*h/3
        slope=200*scale/variance;avvar=4*scale*scale+h*h/3
        targets={'mean_x':10,'mean_m':10,'mean_y':530,'var_x':4,'var_m':variance,
            'var_w':4*kappa*kappa+2*h*h/3,'cov_x_w':4*kappa,'cov_m_y':200*scale,
            'cov_m1_m2':4*scale*scale,'slope':slope,'intercept':530-10*slope,
            'linear_mse':10400-(200*scale)**2/variance,'twin_ratio':50/scale,
            'copied_ratio':slope,'average_slope':200*scale/avvar,
            'average_mse':10400-(200*scale)**2/avvar,'slope_per_kwh':slope/1000,
            'minimum_meter':10-2*abs(scale)-h,'maximum_meter':10+2*abs(scale)+h}
        if h==0:targets['conditional_mse']=400
        if name=='classical' and h==2:targets['conditional_mse']=11200/3
        if name=='classical' and h==4:targets['conditional_mse']=21200/3
        analytic.update({f'h{h}_{name}_{k}':v for k,v in targets.items()})
for key,target in analytic.items():assert close(ref[key],target),(key,ref[key],target)
row_checks=0
with (ROOT/'data/meter-states.csv').open() as f:
    for r in csv.DictReader(f):
        i=int(r['state']);x=int(r['x_mwh'])
        assert ref[f'baseline_state{i}_x']==x
        assert ref[f'baseline_state{i}_m']==x+2*int(r['z1'])
        assert ref[f'baseline_state{i}_bill']==30+50*x+int(r['epsilon_dollars'])
        row_checks+=3
versions={'Python':platform.python_version()}
for name,cmd in {'Julia':['julia','--version'],'R':['Rscript','--version']}.items():
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=15,check=True)
    versions[name]=(p.stdout+p.stderr).strip()
report={'passed':True,'kind':'exact controlled measurement experiment','matched_metrics':len(ref),
    'analytic_targets':len(analytic),'row_identity_checks':row_checks,
    'native_versions':versions,'maximum_absolute_difference':maximum,
    'fixture_sha256':hashlib.sha256((ROOT/'data/meter-states.csv').read_bytes()).hexdigest(),
    'states':36,'noise_amplitudes_mwh':[0,2,4],'calibration_kappa':[0,-.5,-2],
    'random_draws':0,'empirical_tariff_or_meter_accuracy_estimated':False,
    'warning':'Population projection identities; no finite-sample unbiasedness or causal identification is claimed.'}
(ROOT/'results').mkdir(exist_ok=True)
(ROOT/'results/measurement-verification.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'results/measurement-reference.json').write_text(json.dumps(ref,indent=2,sort_keys=True)+'\n')
print(json.dumps(report,indent=2))
