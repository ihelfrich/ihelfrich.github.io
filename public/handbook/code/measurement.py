"""Exact controlled meter and denominator calculations; Python standard library."""
from pathlib import Path
import csv
import sys

ROOT = Path(__file__).resolve().parent
with (ROOT / 'data/meter-states.csv').open() as f:
    rows = [{k: float(v) for k, v in r.items()} for r in csv.DictReader(f)]
total = sum(r['weight'] for r in rows)
p = [r['weight'] / total for r in rows]
def mean(a): return sum(q * value for q, value in zip(p, a))
def cov(a, b):
    ma, mb = mean(a), mean(b)
    return sum(q * (x-ma) * (y-mb) for q, x, y in zip(p, a, b))
def line(x, y):
    slope = cov(x, y) / cov(x, x)
    intercept = mean(y) - slope * mean(x)
    return slope, intercept, mean([(b-intercept-slope*a)**2 for a, b in zip(x, y)])

out = {'probability_sum': sum(p), 'states': len(rows)}
x = [r['x_mwh'] for r in rows]
y = [30+50*a+r['epsilon_dollars'] for a, r in zip(x, rows)]
for h in (0, 2, 4):
    for name, kappa in [('classical', 0), ('compressed', -.5), ('reversed', -2)]:
        key = f'h{h}_{name}_'
        m1 = [a+kappa*(a-10)+h*r['z1'] for a, r in zip(x, rows)]
        m2 = [a+kappa*(a-10)+h*r['z2'] for a, r in zip(x, rows)]
        w = [b-a for a, b in zip(x, m1)]
        average = [(a+b)/2 for a, b in zip(m1, m2)]
        slope, intercept, risk = line(m1, y)
        avg_slope, _, avg_risk = line(average, y)
        conditional = {v: sum(q*b for q, a, b in zip(p, m1, y) if a==v) /
                       sum(q for q, a in zip(p, m1) if a==v) for v in set(m1)}
        metrics = {'mean_x': mean(x), 'mean_m': mean(m1), 'mean_y': mean(y),
            'var_x': cov(x, x), 'var_m': cov(m1, m1), 'var_w': cov(w, w),
            'cov_x_w': cov(x, w), 'cov_m_y': cov(m1, y),
            'cov_m1_m2': cov(m1, m2), 'slope': slope, 'intercept': intercept,
            'linear_mse': risk, 'conditional_mse': mean([(b-conditional[a])**2 for a,b in zip(m1,y)]),
            'twin_ratio': cov(m1, y)/cov(m1, m2), 'copied_ratio': cov(m1, y)/cov(m1, m1),
            'average_slope': avg_slope, 'average_mse': avg_risk,
            'slope_per_kwh': line([1000*a for a in m1],y)[0],
            'minimum_meter': min(m1), 'maximum_meter': max(m1)}
        out.update({key+k:v for k,v in metrics.items()})
        if h == 2 and name == 'classical':
            for i, (a, b, c) in enumerate(zip(x, m1, y), 1):
                out[f'baseline_state{i}_x'] = a
                out[f'baseline_state{i}_m'] = b
                out[f'baseline_state{i}_bill'] = c
    out[f'h{h}_reliability'] = cov(x,x)/cov([a+h*r['z1'] for a,r in zip(x,rows)], [a+h*r['z1'] for a,r in zip(x,rows)])
q = [1000, 3000]; n = [100, 200]
out.update({'aggregate_ratio':sum(q)/sum(n),'unweighted_ratio':sum(a/b for a,b in zip(q,n))/2,
            'weighted_ratio':sum((b/sum(n))*(a/b) for a,b in zip(q,n)),
            'coverage_before':3000/300,'coverage_after':3000/240,
            'coverage_growth':(3000/240)/(3000/300)-1,
            'coverage_log_growth':__import__('math').log(3000/240)-__import__('math').log(3000/300),
            'mwh_to_joule':1_000_000*3600})
writer=csv.writer(sys.stdout);writer.writerow(['metric','value'])
writer.writerows(sorted(out.items()))
