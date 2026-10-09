"""Chapter 1: enumerate a declared finite economy; no sampled utility data."""
from pathlib import Path
import csv
import sys

ROOT = Path(__file__).resolve().parent
with (ROOT / 'data/alert-days.csv').open(newline='') as f:
    rows = list(csv.DictReader(f))
u = [int(r['u']) for r in rows]
v = [int(r['v_mw']) for r in rows]
w = [int(r['weight']) for r in rows]
total = sum(w)
def average(values, indices=None):
    indices = list(range(len(rows))) if indices is None else list(indices)
    return sum(w[i] * values[i] for i in indices) / sum(w[i] for i in indices)

out = {'probability_sum': sum(x / total for x in w),
       'heat_mean': average(u), 'shock_mean': average(v),
       'missing_heat0_alert1_probability': 0.0,
       'missing_heat1_alert0_probability': 0.0}
for b in (-2, -1, 0, 1, 2):
    prefix = f'b{b}_'
    observed = [10 + b*a + (2-b)*heat + shock for a,heat,shock in zip(u,u,v)]
    baseline = [10 + 2*heat + shock for heat,shock in zip(u,v)]
    forecast = [10 + 2*a for a in u]
    do0 = [10 + (2-b)*heat + shock for heat,shock in zip(u,v)]
    do1 = [10 + b + (2-b)*heat + shock for heat,shock in zip(u,v)]
    observed_means = [average(observed, (i for i,a in enumerate(u) if a==k)) for k in (0,1)]
    # The randomized design independently crosses each background day with A=0,1.
    randomized = [(a, heat, shock, weight) for a in (0,1) for heat,shock,weight in zip(u,v,w)]
    randomized_means = []
    for a in (0,1):
        states = [r for r in randomized if r[0]==a]
        randomized_means.append(sum(weight*(10+b*alert+(2-b)*heat+shock)
                                    for alert,heat,shock,weight in states) / sum(r[3] for r in states))
    metrics = {
        'observed_mean': average(observed),
        'conditional0': observed_means[0], 'conditional1': observed_means[1],
        'observed_difference': observed_means[1]-observed_means[0],
        'forecast_mse': average([(y-m)**2 for y,m in zip(observed,forecast)]),
        'constant_mse': average([(y-11)**2 for y in observed]),
        'poor_forecast_mse': average([(y-(9+4*a))**2 for y,a in zip(observed,u)]),
        'do0_mean': average(do0), 'do1_mean': average(do1),
        'paired_effect': average([y1-y0 for y1,y0 in zip(do1,do0)]),
        'randomized0': randomized_means[0], 'randomized1': randomized_means[1],
        'randomized_difference': randomized_means[1]-randomized_means[0],
        'net_benefit': 1000*(average(do0)-average(do1))-500,
        'mse_kw2': average([(1000*y-1000*m)**2 for y,m in zip(observed,forecast)]),
        'effect_kw': average([1000*y1-1000*y0 for y1,y0 in zip(do1,do0)]),
        'observational_invariance_error': max(abs(y-z) for y,z in zip(observed,baseline)),
        'minimum_intervention_load': min(do0+do1),
    }
    for i in range(len(rows)):
        metrics[f'observed_state{i+1}'] = observed[i]
        metrics[f'do0_state{i+1}'] = do0[i]
        metrics[f'do1_state{i+1}'] = do1[i]
    out.update({prefix+k: value for k,value in metrics.items()})
writer = csv.writer(sys.stdout, lineterminator='\n')
writer.writerow(('metric','value'))
writer.writerows((k,format(out[k],'.17g')) for k in sorted(out))
