"""Execute the three complete implementations concurrently and audit agreement.

This runner checks the published fixture hash, matched metric coverage, finite
outputs, cross-language parity, analytic results, and deliberate failure cases.
It does not treat numerical agreement as proof of every econometric assumption.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import csv
import hashlib
import json
import os
import shutil
import subprocess
import sys
import numpy as np

ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/'data/innovations-manifest.json').read_text())
assert hashlib.sha256((ROOT/'data/innovations.csv').read_bytes()).hexdigest()==manifest['sha256']
commands={'python':[sys.executable,'course.py'],'r':['Rscript','course.R'],'julia':['julia','--startup-file=no','course.jl']}
for command in commands.values():
    if not shutil.which(command[0]):raise SystemExit(f'Missing runtime: {command[0]}')

def execute(item):
    language,command=item;environment=os.environ.copy()
    if language=='julia':
        depot=str(ROOT/'.julia-depot')+os.pathsep+str(Path.home()/'.julia')
        environment.setdefault('JULIA_DEPOT_PATH',depot)
    process=subprocess.run(command,cwd=ROOT,env=environment,text=True,capture_output=True,timeout=180)
    if process.returncode:raise RuntimeError(f'{language}: {process.stderr}\n{process.stdout}')
    with (ROOT/'results'/f'{language}.csv').open() as file:
        values={row['metric']:float(row['value']) for row in csv.DictReader(file)}
    return language,values

with ThreadPoolExecutor(max_workers=3) as pool:results=dict(pool.map(execute,commands.items()))
reference=results['python'];maximum={}
for language,values in results.items():
    assert values.keys()==reference.keys(),f'Coverage mismatch: {language}'
    differences=[abs(values[key]-reference[key]) for key in reference]
    assert np.all(np.isfinite(list(values.values())))
    assert np.allclose(list(values.values()),[reference[key] for key in values],atol=1e-9,rtol=1e-9)
    maximum[language]=max(differences)

analytic={'01_weighted_temperature':60,'01_degree_days_before_aggregation':12.5,'01_degree_days_after_aggregation':5,'01_latest_available_period':6,'02_population_mean':2,'02_population_variance':1/(1-.7**2),'02_variance_h4':(1-.7**8)/(1-.7**2),'03_theoretical_ma1_acf':.4/(1+.4**2),'03_invertible_ma_equivalent':0,'04_asymmetric_optimal_quantile':.75,'05_one_sided_future_sensitivity':0,'05_centered_future_sensitivity':40,'06_random_walk_h12_variance':12,'08_filter_future_sensitivity':0,'10_reverse_order_impact21':0,'10_covariance_reconstruction_error':0,'12_unconditional_variance':1,'12_unit_scaling_error':0,'12_invalid_parameter_rejected':1,'14_continuation_observations':80,'15_forecast_rescaled_error':0,'15_future_mutation_forecast_error':0,'15_rank_failure_detected':1}
for key,target in analytic.items():assert np.isclose(reference[key],target,atol=1e-9,rtol=1e-9),(key,target,reference[key])
assert reference['08_missing_filtered_variance']>reference['08_previous_filtered_variance']
assert abs(reference['08_smoother_future_sensitivity'])>1
assert reference['08_minimum_smoothing_variance']>=0
assert reference['09_spectral_radius']<1
assert reference['10_first_order_impact21']>0
assert reference['11_error_correction_alpha']<0
assert reference['12_alpha_grid']+reference['12_beta_grid']<1
assert reference['13_early_fitted_phi']>0 and reference['13_late_fitted_phi']<0
assert abs(reference['06_df_adf_zero_lag_error'])<1e-9
assert reference['09_forecast_covariance_h4_trace']>0
assert reference['09_forecast_sum_variance_h4']>0
assert reference['13_hac_standard_error']>0
assert len(reference)==112 and {key[:2] for key in reference}=={f'{i:02d}' for i in range(1,16)}

project_commands={'python':[sys.executable,'projects.py'],'r':['Rscript','projects.R'],'julia':['julia','--startup-file=no','projects.jl']}
def execute_project(item):
    language,command=item;environment=os.environ.copy()
    environment.setdefault('JULIA_DEPOT_PATH',str(ROOT/'.julia-depot')+os.pathsep+str(Path.home()/'.julia'))
    p=subprocess.run(command,cwd=ROOT,env=environment,text=True,capture_output=True,timeout=180)
    if p.returncode:raise RuntimeError(f'{language} projects: {p.stderr}\n{p.stdout}')
    with (ROOT/'results'/f'projects-{language}.csv').open() as file:values={r['metric']:float(r['value']) for r in csv.DictReader(file)}
    with (ROOT/'results'/f'project-forecasts-{language}.csv').open() as file:forecasts=list(csv.DictReader(file))
    return language,(values,forecasts)
with ThreadPoolExecutor(max_workers=3) as pool:projects=dict(pool.map(execute_project,project_commands.items()))
project_reference,forecast_reference=projects['python'];project_maximum={}
for language,(values,forecasts) in projects.items():
    assert values.keys()==project_reference.keys() and len(forecasts)==len(forecast_reference)==276
    assert np.allclose(list(values.values()),[project_reference[key] for key in values],atol=1e-8,rtol=1e-8)
    project_maximum[language]=max(abs(values[key]-project_reference[key]) for key in values)
    for row,reference_row in zip(forecasts,forecast_reference):
        for key in ['origin','target','latest_available','method','phase','fallback']:assert row[key]==reference_row[key]
        for key in ['actual_million_mwh','forecast_million_mwh','error']:assert np.isclose(float(row[key]),float(reference_row[key]),atol=1e-8,rtol=1e-8)
        assert row['latest_available']<row['origin']<row['target']
assert project_reference['p2_leaky_future_sensitivity']==40
assert project_reference['p3_future_mutation_error']==0
assert project_reference['p3_naive_rmse']<project_reference['p3_revised_rmse']<project_reference['p3_original_rmse']
texas_manifest=json.loads((ROOT/'data/texas-manifest.json').read_text())
assert hashlib.sha256((ROOT/'data/texas-electricity.csv').read_bytes()).hexdigest()==texas_manifest['output_sha256']
report={'passed':True,'languages':list(results),'metrics':len(reference),'lectures':15,'project_metrics':len(project_reference),'matched_project_forecasts':len(forecast_reference),'analytic_checks':len(analytic),'absolute_tolerance':1e-9,'relative_tolerance':1e-9,'project_tolerance':1e-8,'maximum_absolute_difference':maximum,'project_maximum_absolute_difference':project_maximum,'fixture_sha256':manifest['sha256'],'texas_sha256':texas_manifest['output_sha256'],'assessment_keys_included':False}
(ROOT/'results/verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
