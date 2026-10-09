"""Check independent native implementations against finite analytic targets."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import csv,io,json,math,subprocess,sys

ROOT=Path(__file__).resolve().parent
commands={'python':[sys.executable,'risk-example.py'],'r':['Rscript','risk-example.R'],'julia':['julia','--startup-file=no','risk-example.jl']}
def run(item):
    language,command=item
    result=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=45,check=True)
    return language,{r['metric']:float(r['value']) for r in csv.DictReader(io.StringIO(result.stdout))}
with ThreadPoolExecutor(max_workers=3) as pool:
    results=dict(pool.map(run,commands.items()))
reference=results['python'];maxima={}
for language,values in results.items():
    assert values.keys()==reference.keys(),language
    assert all(math.isfinite(v) for v in values.values())
    assert all(math.isclose(v,reference[k],rel_tol=1e-12,abs_tol=1e-12) for k,v in values.items()),language
    maxima[language]=max(abs(v-reference[k]) for k,v in values.items())
targets={'state_1_mean_error':0,'state_3_mean_error':0,'state_1_variance':1.25,'state_3_variance':11.25,'unconditional_variance':6.25,'opening_forecast':7,'variance_1_24':24,'response_-0.5_1':-0.5,'response_-0.5_2':0.25}
for key,value in targets.items():assert math.isclose(reference[key],value,abs_tol=1e-12),(key,reference[key])
for phi in (-0.95,-0.5,0,0.5,0.95):
    for h in (1,2,24):
        key=f'variance_{phi:g}_{h}'
        closed=(1-phi**(2*h))/(1-phi**2)
        assert math.isclose(reference[key],closed,rel_tol=1e-12,abs_tol=1e-12)
        assert reference[key]>=0
assert reference['state_1_variance']!=reference['unconditional_variance']!=reference['state_3_variance']
report={'passed':True,'kind':'exact finite enumeration and analytic boundary calculations','languages':list(results),'matched_metrics':len(reference),'analytic_targets':len(targets),'finite_sum_closed_form_checks':15,'maximum_absolute_difference':maxima,'conditional_homoskedasticity_counterexample':True,'random_draws':0,'live_assessments_included':False}
(ROOT/'results/risk-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
