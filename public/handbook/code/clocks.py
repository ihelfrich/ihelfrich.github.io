"""Independent UTC vintage selection and finite information proofs; standard library only."""
from pathlib import Path
from datetime import datetime,timedelta
import csv,math
ROOT=Path(__file__).resolve().parent
def rows(name):
    with (ROOT/'data'/name).open() as f:return list(csv.DictReader(f))
def timestamp(s):
    if len(s)!=20 or not s.endswith('Z'):raise ValueError('Use second-resolution UTC timestamps ending Z.')
    return datetime.strptime(s,'%Y-%m-%dT%H:%M:%SZ')
def ledger(name,field):
    return [dict(r,stage=int(r['stage']),value=float(r[field])) for r in rows(name)]
def validate(records):
    keys=[(r['period'],r['release_utc']) for r in records]
    if len(set(keys))!=len(keys):raise ValueError('Ambiguous period/release key.')
    for r in records:
        datetime.strptime(r['period'],'%Y-%m-%d');timestamp(r['release_utc'])
        if not math.isfinite(r['value']):raise ValueError('Nonfinite value.')
def latest(records):
    result={}
    for r in records:
        p=r['period']
        if p not in result or timestamp(r['release_utc'])>timestamp(result[p]['release_utc']):result[p]=r
    return result
def asof(records,origin,delay=0):
    validate(records)
    if delay<0:raise ValueError('Negative collection delay.')
    return latest([r for r in records if timestamp(r['release_utc'])+timedelta(seconds=delay)<=timestamp(origin)])
def forecast(snapshot,target='2024-03-01'):
    values=[r['value'] for p,r in snapshot.items() if p<target]
    if not values:raise ValueError('No released training value; no zero imputation.')
    return sum(values)/len(values)
out={}
gdp=ledger('gdp-release-ledger.csv','value_percent')
for origin in rows('clock-origins.csv'):
    for delay in (0,60,3600):
        prefix=f"gdp_o{origin['origin_id']}_d{delay}_";cut=origin['origin_utc']
        safe=asof(gdp,cut,delay);selected=safe.get('2024-01-01')
        future=lambda r:timestamp(r['release_utc'])+timedelta(seconds=delay)>timestamp(cut)
        changed=[dict(r,value=r['value']+10 if future(r) else r['value']) for r in gdp]
        mutated=asof(changed,cut,delay).get('2024-01-01')
        appended=gdp+[dict(gdp[-1],record_id='authored-future',release_utc='2024-08-01T12:30:00Z',stage=4,value=777)]
        added=asof(appended,cut,delay).get('2024-01-01')
        reverse=asof(list(reversed(gdp)),cut,delay).get('2024-01-01')
        values={'stage':selected['stage'] if selected else 0,'found':int(selected is not None),
                'eligible_rows':sum(not future(r) for r in gdp),
                'latest_value':latest(gdp)['2024-01-01']['value'],
                'mutated_latest_value':latest(changed)['2024-01-01']['value'],
                'append_same':int(added==selected),'reorder_same':int(reverse==selected),
                'future_mutation_same':int(mutated==selected)}
        if selected:values.update(growth=selected['value'],mutated_growth=mutated['value'])
        out.update({prefix+k:v for k,v in values.items()})
for r in gdp:out[f"stage{r['stage']}_quarterly_percent"]=100*((1+r['value']/100)**.25-1)
out.update(revision_second_minus_advance=gdp[1]['value']-gdp[0]['value'],
           revision_third_minus_second=gdp[2]['value']-gdp[1]['value'],
           revision_third_minus_advance=gdp[2]['value']-gdp[0]['value'])
toy=ledger('controlled-release-ledger.csv','value')
origin='2024-03-06T09:00:00Z'
locked=forecast(asof(toy,origin));late=forecast(latest(toy))
mutated=[dict(r,value=r['value']+1000 if timestamp(r['release_utc'])>timestamp(origin) else r['value']) for r in toy]
out.update(toy_before=forecast(asof(toy,'2024-03-04T09:00:00Z')),
           toy_locked=locked,toy_after_revision=forecast(asof(toy,'2024-03-15T09:00:00Z')),
           toy_late=late,toy_mutated_locked=forecast(asof(mutated,origin)),
           toy_mutated_late=forecast(latest(mutated)),toy_first_target=5,toy_revised_target=7,
           toy_first_squared_error=(5-locked)**2,toy_revised_squared_error=(7-locked)**2,
           toy_late_first_squared_error=(5-late)**2,toy_late_revised_squared_error=(7-late)**2,
           toy_score_cross_term=2*(5-locked)*(7-5),toy_score_revision_squared=(7-5)**2)
worlds=rows('information-worlds.csv');y=[float(r['y']) for r in worlds]
p=[float(r['weight'])/sum(float(s['weight']) for s in worlds) for r in worlds]
mean=lambda z:sum(a*b for a,b in zip(p,z))
groups=[r['signal'] for r in worlds]
coarse=[sum(p[j]*y[j] for j in range(4) if groups[j]==groups[i])/sum(p[j] for j in range(4) if groups[j]==groups[i]) for i in range(4)]
out.update(worlds=4,probability_sum=sum(p),no_information_mean=mean(y),
           no_information_risk=mean([(a-mean(y))**2 for a in y]),
           coarse_risk=mean([(a-b)**2 for a,b in zip(y,coarse)]),
           coarse_gain=mean([(a-mean(y))**2 for a in coarse]),exact_risk=0,
           nonadapted_pair_count=sum(groups[i]==groups[j] and y[i]!=y[j] for i in range(4) for j in range(i+1,4)))
for i,value in enumerate(coarse,1):out[f'state{i}_coarse_forecast']=value
for kind,bad in [('duplicate',gdp+[gdp[0]]),('nonfinite',[dict(gdp[0],value=float('nan'))])]:
    try:asof(bad,origin);out[kind+'_rejected']=0
    except ValueError:out[kind+'_rejected']=1
try:asof(gdp,origin,-1);out['negative_delay_rejected']=0
except ValueError:out['negative_delay_rejected']=1
try:forecast({});out['empty_forecast_rejected']=0
except ValueError:out['empty_forecast_rejected']=1
print('metric,value')
for key in sorted(out):print(f'{key},{out[key]:.17g}')
