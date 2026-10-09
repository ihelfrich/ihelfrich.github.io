"""Complete public Build/Audit/Revise case, using the fixed Texas extract.

This is a worked practice case. Live course data releases and keys are separate.
The two-month availability lag is an explicit teaching assumption. Input values
are the downloaded vintage, not recovered historical real-time observations.
"""
from pathlib import Path
import csv
import hashlib
import json
import numpy as np
from course import ols, ar_forecast, ar_fit, rmse

ROOT=Path(__file__).resolve().parent


def load():
    with (ROOT/'data/texas-electricity.csv').open() as file:rows=list(csv.DictReader(file))
    return ([r['period'] for r in rows],np.array([float(r['residential_sales_mwh'])/1e6 for r in rows]),np.array([float(r['temperature_f']) for r in rows]))


def design(t,temperature=None):
    t=np.atleast_1d(t);columns=[np.ones(len(t)),t/12,np.sin(2*np.pi*t/12),np.cos(2*np.pi*t/12)]
    if temperature is None:columns.extend([np.sin(4*np.pi*t/12),np.cos(4*np.pi*t/12)])
    else:columns.extend([np.maximum(65-temperature,0),np.maximum(temperature-65,0)])
    return np.column_stack(columns)


def forecast(y,temp,target,method='ar',window=0,release_lag=2):
    origin=target-1;latest=origin-release_lag;h=target-latest
    first=0 if window==0 else max(0,latest-window+1)
    if method=='naive':return float(y[target-12])
    if method=='ar':return ar_forecast(y[first:latest+1],h)
    time=np.arange(first,latest+1)
    X=design(time,temp[first:latest+1] if method=='weather' else None)
    b,u=ols(X,y[first:latest+1]);rho=ar_fit(u)[1]
    if abs(rho)>=1:raise ValueError('Unstable residual process: use declared seasonal fallback')
    if method=='weather':
        same_month=time[time%12==target%12]
        if len(same_month)<2:raise ValueError('Too little climate history')
        # E[positive part] from prior same-month observations, not positive part of E[T].
        x=design(np.array([target]),np.array([65.]))[0]
        x[-2]=np.mean(np.maximum(65-temp[same_month],0));x[-1]=np.mean(np.maximum(temp[same_month]-65,0))
    else:x=design(np.array([target]))[0]
    return float(x@b+rho**h*u[-1])


def table(y,temp,periods,targets,method,window=0):
    rows=[]
    for target in targets:
        fallback=False
        try:value=forecast(y,temp,target,method,window)
        except ValueError:value=forecast(y,temp,target,'naive');fallback=True
        rows.append({'origin':periods[target-1],'target':periods[target],'latest_available':periods[target-3],'method':method,'window':window,'actual_million_mwh':y[target],'forecast_million_mwh':value,'error':y[target]-value,'fallback':int(fallback)})
    return rows


def run():
    periods,y,temp=load();results={};all_rows=[]
    def keep(phase,rows):
        for row in rows:row['phase']=phase
        all_rows.extend(rows);return np.array([r['error'] for r in rows])
    p1=range(120,156)
    baseline=keep('build',table(y,temp,periods,p1,'naive'))
    original=keep('build',table(y,temp,periods,p1,'ar'))
    results['p1_naive_rmse']=rmse(baseline);results['p1_ar_rmse']=rmse(original)
    audit=range(156,180)
    honest=keep('audit',table(y,temp,periods,audit,'ar'))
    impossible=np.array([y[t]-np.mean(y[t-2:t+3]) for t in audit])
    results['p2_original_rmse']=rmse(honest);results['p2_leaky_centered_rmse']=rmse(impossible)
    mutated=y.copy();mutated[157:]+=100
    results['p2_leaky_future_sensitivity']=np.mean(mutated[154:159])-np.mean(y[154:159])
    chosen=None;loss=float('inf')
    # Fixed candidate list and tie rule: first strict improvement wins.
    for method in ['calendar','weather']:
        for window in [60,120,0]:
            rows=table(y,temp,periods,audit,method,window);errors=keep('repair-selection',rows)
            score=np.mean(errors**2)
            if score<loss:loss=float(score);chosen=(method,window)
    results['p2_repair_validation_rmse']=np.sqrt(loss)
    continuation=range(180,192)
    revised=keep('continuation',table(y,temp,periods,continuation,*chosen))
    base=keep('continuation',table(y,temp,periods,continuation,'naive'))
    old=keep('continuation',table(y,temp,periods,continuation,'ar'))
    results['p3_revised_rmse']=rmse(revised);results['p3_naive_rmse']=rmse(base);results['p3_original_rmse']=rmse(old)
    results['p3_paired_mse_difference']=float(np.mean(revised**2-base**2))
    results['p3_selected_weather']=int(chosen[0]=='weather');results['p3_selected_window']=chosen[1]
    target=180;original_forecast=forecast(y,temp,target,*chosen)
    altered=y.copy();altered[target-2:]+=1000;altered_temp=temp.copy();altered_temp[target-2:]+=100
    results['p3_future_mutation_error']=forecast(altered,altered_temp,target,*chosen)-original_forecast
    assert abs(results['p3_future_mutation_error'])<1e-9
    assert all(np.isfinite(list(results.values())))
    output=ROOT/'results';output.mkdir(exist_ok=True)
    with (output/'projects-python.csv').open('w',newline='') as file:
        writer=csv.writer(file);writer.writerow(['metric','value']);writer.writerows(results.items())
    with (output/'project-forecasts-python.csv').open('w',newline='') as file:
        writer=csv.DictWriter(file,fieldnames=list(all_rows[0]));writer.writeheader();writer.writerows(all_rows)
    freeze={'method':chosen[0],'window':chosen[1],'release_lag':2,'lag_status':'teaching assumption','target':'Texas monthly residential sales in million MWh','selection_targets':'2023-01 through 2024-12','continuation_targets':'2025-01 through 2025-12','update_rule':'refit each origin using only observations released under the assumed clock','fallback':'seasonal naive on rank or stability failure','loss':'squared error on matched targets','data_sha256':hashlib.sha256((ROOT/'data/texas-electricity.csv').read_bytes()).hexdigest(),'kind':'public worked practice, not live graded holdout'}
    (output/'project-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n')
    print(json.dumps(results,indent=2));return results


if __name__=='__main__':run()
