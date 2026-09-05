"""Reproduce the observed-worlds experiment with the Python standard library.

Run: python reproduce.py [observed-worlds-seed-2026.csv]
Without an argument, downloads the public, fixed synthetic sample.
No real student or company data are used. No packages required.
Optional second argument: a sampling-seed-*.csv exported by the browser lab.
"""
import csv
import io
import math
import sys
import urllib.request
from pathlib import Path

if len(sys.argv) > 1:
    source = Path(sys.argv[1]).read_text(encoding="utf-8")
else:
    url = "https://ihelfrich.github.io/econometrics/data/observed.csv"
    with urllib.request.urlopen(url, timeout=20) as response:
        source = response.read().decode("utf-8")
rows = list(csv.DictReader(io.StringIO(source)))
x = [float(r["x"]) for r in rows]
y = [float(r["y"]) for r in rows]
n = len(x)
mx, my = sum(x) / n, sum(y) / n
slope = sum((a-mx)*(b-my) for a,b in zip(x,y)) / sum((a-mx)**2 for a in x)
intercept = my-slope*mx
print(f"Synthetic sample: n={n}; OLS intercept={intercept:.6f}, slope={slope:.6f}")

# U=X, V=Y-X reconstruct one latent model for demonstration; this is an
# assumed structural construction, not empirical discovery of confounders.
for b in [-1, 0, .5, 1, 2]:
    errors = [abs(yi-(b*xi+(1-b)*xi+(yi-xi))) for xi,yi in zip(x,y)]
    assert max(errors) < 1e-12
    print(f"b={b:4.1f}: same observed Y; E[Y | do(X=1)]={b:4.1f}")

# A separate algebraic sensitivity exercise: four means treated as known.
dd = (62-50)-(46-40)
print("\nM  effect bounds  net-value bounds ($)")
for bound in [0, 2, 3, 4, 8]:
    effects = (dd-bound, dd+bound)
    net = tuple(100*v-300 for v in effects)
    print(bound, effects, net)
assert dd == 6

# Export a batch from the sampling experiment, then supply it here to check
# all endpoints and the realized coverage using independent code.
if len(sys.argv) > 2:
    with Path(sys.argv[2]).open(newline="") as handle:
        simulations = list(csv.DictReader(handle))
    coverage = []
    for row in simulations:
        m, count = float(row["mean"]), int(row["n"])
        width = 1.959963984540054 / math.sqrt(count)
        lo, hi = m-width, m+width
        assert abs(lo-float(row["low"])) < 1e-12
        assert abs(hi-float(row["high"])) < 1e-12
        covered = lo <= 0 <= hi
        assert covered == (row["covers"].lower() == "true")
        coverage.append(covered)
    print(f"Verified {len(coverage)} intervals; coverage={sum(coverage)/len(coverage):.3f}")
