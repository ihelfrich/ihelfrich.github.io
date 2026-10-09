"""Exact conditioning checks for degenerate and one-observation state models."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
programs = {
    'python': [sys.executable, '-c', '''import numpy as np
from course import kalman
for y in ([1.,np.nan,3.],[np.nan]):
    assert all(np.all(a==0) for a in kalman(y,q=0))
m,P,s,S=kalman([3.],phi=0,q=.4,r=2)
assert np.allclose([m[0],P[0],s[0],S[0]],[.5,1/3,.5,1/3])
m,P,s,S=kalman([np.nan],phi=0,q=.4,r=2)
assert np.allclose([m[0],P[0],s[0],S[0]],[0,.4,0,.4])
for y,kwargs in [([],{}),([1.],{'q':float('inf')}),([1.],{'r':float('nan')})]:
    try: kalman(y,**kwargs)
    except ValueError: pass
    else: raise AssertionError('invalid input accepted')
print('PASS')'''],
    'r': ['Rscript', '-e', '''source('course.R')
for(y in list(c(1,NA,3),c(NA)))stopifnot(all(unlist(kalman(y,q=0))==0))
stopifnot(isTRUE(all.equal(unname(unlist(kalman(c(3),phi=0,q=.4,r=2))),c(.5,1/3,.5,1/3))))
stopifnot(isTRUE(all.equal(unname(unlist(kalman(c(NA),phi=0,q=.4,r=2))),c(0,.4,0,.4))))
for(args in list(list(y=numeric()),list(y=c(1),q=Inf),list(y=c(1),r=NaN))) {
  rejected<-tryCatch({do.call(kalman,args);FALSE},error=function(e)TRUE)
  stopifnot(rejected)
}
cat('PASS')'''],
    'julia': ['julia', '--startup-file=no', '-e', '''include("course.jl")
for y in ([1.,NaN,3.],[NaN]);@assert all(a->all(iszero,a),values(kalman(y,.8,0.,1.)));end
K=kalman([3.],0.,.4,2.);@assert all(isapprox.(vcat(K.m,K.P,K.s,K.S),[.5,1/3,.5,1/3]))
K=kalman([NaN],0.,.4,2.);@assert all(isapprox.(vcat(K.m,K.P,K.s,K.S),[0.,.4,0.,.4]))
for args in ((Float64[],.8,.25,1.),([1.],.8,Inf,1.),([1.],.8,.25,NaN))
    rejected=try;kalman(args...);false;catch;true;end
    @assert rejected
end
println("PASS")''']
}

def check(item):
    name, command = item
    result = subprocess.run(command, cwd=ROOT, env=os.environ.copy(), text=True,
                            capture_output=True, timeout=90)
    if result.returncode or result.stdout.strip() != 'PASS':
        raise RuntimeError(f'{name}: {result.stdout}\n{result.stderr}')
    return name

with ThreadPoolExecutor(max_workers=3) as pool:
    languages = list(pool.map(check, programs.items()))
report = {'passed': True, 'languages': languages, 'checks_per_language': 7,
          'benchmarks': ['deterministic_zero_state', 'single_observation_gaussian_conditioning',
                         'single_missing_observation', 'empty_and_nonfinite_parameters_rejected']}
(ROOT/'results'/'boundary-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
