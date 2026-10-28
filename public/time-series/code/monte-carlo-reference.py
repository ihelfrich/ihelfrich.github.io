"""Large-sample reference for the Lecture 6 Monte Carlo, using NumPy's generator.

The course laboratory uses its own Park-Miller stream so that Python, R, and
Julia reproduce identical draws. This separate check repeats the same designs
with 200,000 replications from an unrelated generator. Agreement within Monte
Carlo error is evidence that the course stream behaves like independent normals.
Run: uv run python monte-carlo-reference.py (well under a minute).
"""
from pathlib import Path
import json
import math
import numpy as np

ROOT = Path(__file__).resolve().parent
REPLICATIONS, CHUNK, SEED = 200_000, 20_000, 20261028


def slope_t(z, x):
    """Row-wise OLS slope t statistic of z on [1, x], residual degrees of freedom n-2."""
    n = z.shape[1]
    xm = x - x.mean(1, keepdims=True); zm = z - z.mean(1, keepdims=True)
    sxx = (xm*xm).sum(1); sxz = (xm*zm).sum(1); szz = (zm*zm).sum(1)
    b = sxz/sxx
    return b/np.sqrt((szz - b*sxz)/(n - 2)/sxx)


rng = np.random.default_rng(SEED)
report = {'generator': 'numpy.random.default_rng', 'seed': SEED, 'replications': REPLICATIONS, 'results': {}}
for n in [80, 240, 720]:
    hits = {'df': 0, 'spurious': 0, 'differenced': 0}
    for _ in range(REPLICATIONS//CHUNK):
        y = np.cumsum(rng.standard_normal((CHUNK, n)), 1)
        hits['df'] += int(np.sum(slope_t(np.diff(y, axis=1), y[:, :-1]) < -2.86))
        x = np.cumsum(rng.standard_normal((CHUNK, n)), 1)
        hits['spurious'] += int(np.sum(abs(slope_t(y, x)) > 1.96))
        hits['differenced'] += int(np.sum(abs(slope_t(np.diff(y, axis=1), np.diff(x, axis=1))) > 1.96))
    for name, count in hits.items():
        p = count/REPLICATIONS
        report['results'][f'{name}_rejection_n{n}'] = p
        report['results'][f'{name}_mcse_n{n}'] = math.sqrt(p*(1-p)/REPLICATIONS)
(ROOT/'results'/'monte-carlo-reference.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
