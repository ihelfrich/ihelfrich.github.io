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
# Training is D, as in chapter 1. Files exported before October 2026 name its column x.
training = "d" if "d" in rows[0] else "x"
d = [float(r[training]) for r in rows]
y = [float(r["y"]) for r in rows]
n = len(d)
md, my = sum(d) / n, sum(y) / n
slope = sum((a-md)*(b-my) for a,b in zip(d,y)) / sum((a-md)**2 for a in d)
intercept = my-slope*md
print(f"Synthetic sample: n={n}; OLS intercept={intercept:.6f}, slope={slope:.6f}")

# U=D and V=Y-D reconstruct one latent model for demonstration; this is an
# assumed structural construction, not empirical discovery of confounders.
u = d
v = [yi-di for di, yi in zip(d, y)]
for b in [-1, 0, .5, 1, 2]:
    # Observational equivalence: every b reproduces the observed outcomes. The
    # check holds by construction for any data; it restates the identity.
    errors = [abs(yi-(b*di+(1-b)*ui+vi)) for di, yi, ui, vi in zip(d, y, u, v)]
    assert max(errors) < 1e-12
    # Under do(D=1), U and V keep their values. The population mean is b; the
    # sample analogue differs from b by the sampling error in the means of U and V.
    sample_mean = sum(b+(1-b)*ui+vi for ui, vi in zip(u, v)) / n
    print(f"b={b:4.1f}: same observed Y; E[Y | do(D=1)]={b:4.1f} in the model, "
          f"{sample_mean:.4f} in this sample")

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
