"""Authored reference experiments. Copyright 2026 Ian Helfrich.

All indexes here are zero based. R/Julia implementations use one-based indexes.
The common input file, conventions, and numerical outputs are the contract.
Run python course.py [lecture-number]; run verify.py for cross-language parity.
"""
from pathlib import Path
import csv
import math
import sys
import numpy as np

ROOT = Path(__file__).resolve().parent


def normals(n, seed=515):
    """Park-Miller LCG plus Box-Muller: same arithmetic in all three languages."""
    state = seed
    out = []
    while len(out) < n:
        state = (48271 * state) % 2147483647
        u = state / 2147483647
        state = (48271 * state) % 2147483647
        v = state / 2147483647
        radius = math.sqrt(-2 * math.log(u))
        out.extend([radius * math.cos(2 * math.pi * v),
                    radius * math.sin(2 * math.pi * v)])
    return np.array(out[:n])


def fixtures():
    path = ROOT / 'data' / 'innovations.csv'
    if not path.exists():
        path.parent.mkdir(exist_ok=True)
        e = normals(2048 * 6).reshape(2048, 6)
        np.savetxt(path, e, delimiter=',', header='e1,e2,e3,e4,e5,e6', comments='', fmt='%.17g')
    return np.loadtxt(path, delimiter=',', skiprows=1)


def ols(X, y):
    """QR-based least squares; no explicit inverse of X'X."""
    X = np.asarray(X, float)
    y = np.asarray(y, float)
    if len(y) <= X.shape[1] or np.linalg.matrix_rank(X) < X.shape[1]:
        raise ValueError('Too few observations or rank-deficient design')
    b, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
    return b, y - X @ b


def ar(e, phi=.7, c=0., initial=0.):
    y = np.empty(len(e)); previous = initial
    for t, shock in enumerate(e):
        y[t] = c + phi * previous + shock
        previous = y[t]
    return y


def acf(y, lag):
    y = np.asarray(y) - np.mean(y)
    return float(y[lag:] @ y[:-lag] / (y @ y))


def pacf(y, lag):
    """Final slope in the sample lag projection, with an intercept."""
    X=np.column_stack([np.ones(len(y)-lag)]+[y[lag-j:len(y)-j] for j in range(1,lag+1)])
    return float(ols(X,y[lag:])[0][-1])


def ljung_box(y, lags=8):
    n=len(y)
    return n*(n+2)*sum(acf(y,k)**2/(n-k) for k in range(1,lags+1))


def adf_stat(y, lags=2, trend=False):
    """ADF statistic only; inferential reference depends on deterministic terms."""
    dy=np.diff(y);n=len(dy);time=np.arange(lags,n)
    columns=[np.ones(len(time)),y[time]]
    if trend:columns.append(time+1)
    columns.extend(dy[time-j] for j in range(1,lags+1))
    X=np.column_stack(columns);b,u=ols(X,dy[time])
    covariance=(u@u)/(len(u)-X.shape[1])*np.linalg.solve(X.T@X,np.eye(X.shape[1]))
    return float(b[1]/np.sqrt(covariance[1,1]))


def hac_mean_se(y,bandwidth=3):
    """Bartlett HAC standard error of a mean, using denominator n throughout."""
    z=np.asarray(y)-np.mean(y);n=len(z);long_run=z@z/n
    for lag in range(1,bandwidth+1):
        long_run+=2*(1-lag/(bandwidth+1))*(z[lag:]@z[:-lag])/n
    if long_run < -1e-12:raise ValueError('Negative long-run variance')
    return float(np.sqrt(max(long_run,0)/n))


def ar_fit(y):
    return ols(np.column_stack([np.ones(len(y)-1), y[:-1]]), y[1:])[0]


def ar_forecast(y, h=1):
    c, phi = ar_fit(y)
    value = y[-1]
    for _ in range(h): value = c + phi * value
    return float(value)


def rolling(y, h=1, start=80, window=None):
    """Origin is last observed row. Target origin+h; refit at every origin."""
    errors = []
    for origin in range(start - 1, len(y)-h):
        first = 0 if window is None else max(0, origin-window+1)
        forecast = ar_forecast(y[first:origin+1], h)
        errors.append(y[origin+h] - forecast)
    return np.asarray(errors)


def rmse(e): return float(np.sqrt(np.mean(np.asarray(e)**2)))


def ma_filter(y, centered=False):
    z = np.full(len(y), np.nan)
    for t in range(2, len(y) - (2 if centered else 0)):
        z[t] = np.mean(y[t-2:t+3] if centered else y[t-2:t+1])
    return z


def arma_residuals(y, phi, theta):
    u = np.zeros(len(y)); previous = 0.
    for t in range(1, len(y)):
        u[t] = y[t] - phi*y[t-1] - theta*previous
        previous = u[t]
    return u


def df_stat(y):
    """DF with intercept, no trend, no augmented lags; t-stat is nonstandard."""
    X = np.column_stack([np.ones(len(y)-1), y[:-1]])
    b, u = ols(X, np.diff(y))
    sigma2 = u @ u / (len(u)-2)
    covariance = sigma2 * np.linalg.solve(X.T @ X, np.eye(2))
    return float(b[1] / np.sqrt(covariance[1,1]))


def kalman(y, phi=.8, q=.25, r=1.):
    """Given parameters: return filtered state, variances, and RTS smoother."""
    if not np.all(np.isfinite([phi,q,r])) or q < 0 or r <= 0 or abs(phi) >= 1:
        raise ValueError('Invalid stationary filter parameters')
    if len(y) == 0: raise ValueError('Require at least one observation')
    n = len(y); m = np.zeros(n); P = np.zeros(n)
    a = np.zeros(n); V = np.zeros(n)
    previous = 0.; variance = q/(1-phi**2)
    for t in range(n):
        a[t] = phi*previous; V[t] = phi**2*variance+q
        if np.isnan(y[t]): m[t], P[t] = a[t], V[t]
        else:
            K = V[t]/(V[t]+r)
            m[t] = a[t]+K*(y[t]-a[t]); P[t] = (1-K)*V[t]
        previous, variance = m[t], P[t]
    s = m.copy(); S = P.copy()
    for t in range(n-2, -1, -1):
        # A zero stationary process variance makes the latent state known.
        J = 0. if V[t+1] == 0 else P[t]*phi/V[t+1]
        s[t] = m[t]+J*(s[t+1]-a[t+1])
        S[t] = P[t]+J**2*(S[t+1]-V[t+1])
    return m, P, s, S


def var_fit(Y):
    X = np.column_stack([np.ones(len(Y)-1), Y[:-1]])
    b, U = ols(X, Y[1:])
    A = b[1:].T
    Sigma = U.T@U/(len(U)-X.shape[1])
    return b[0], A, Sigma


def garch_variance(u, omega, alpha, beta):
    if omega <= 0 or alpha < 0 or beta < 0 or alpha+beta >= 1:
        raise ValueError('Require omega>0, alpha,beta>=0, alpha+beta<1')
    v = np.empty(len(u)); v[0] = omega/(1-alpha-beta)
    for t in range(1,len(u)): v[t] = omega+alpha*u[t-1]**2+beta*v[t-1]
    return v


def garch_fit(u):
    """Transparent bounded grid estimate, not a production optimizer or MLE SE."""
    best = None; objective = float('inf')
    for omega in [.02,.05,.1,.2,.4]:
        for alpha in [.05,.1,.2]:
            for beta in [.5,.7,.8,.9]:
                if alpha+beta >= .999: continue
                v = garch_variance(u,omega,alpha,beta)
                loss = np.mean(np.log(v)+u**2/v)
                if loss < objective: objective, best = float(loss), (omega,alpha,beta)
    return best, objective


def experiment(k, E=None):
    E = fixtures() if E is None else E
    e, f, g = E[:,0], E[:,1], E[:,2]
    out = {}
    def record(key,value): out[f'{k:02d}_{key}'] = float(value)
    if k == 1:
        temperature = np.array([40.,80.]); weights = np.array([.5,.5])
        mean_temp = weights@temperature
        record('weighted_temperature',mean_temp)
        record('degree_days_before_aggregation',weights@np.maximum(65-temperature,0))
        record('degree_days_after_aggregation',max(65-mean_temp,0))
        y = 100+ar(e[:180],.8)
        record('naive_rmse',rmse(np.diff(y[119:])))
        # Records dated month t are available t+2. No origin may include unreleased data.
        period = np.arange(12); release = period+2; origin=8
        record('latest_available_period',max(period[release<=origin]))
        assert max(release[release<=origin]) <= origin
    elif k == 2:
        phi=.7; c=.6; y=ar(e[:1024],phi,c)
        record('population_mean',c/(1-phi))
        record('population_variance',1/(1-phi**2))
        record('sample_mean',np.mean(y[100:]))
        record('sample_variance',np.var(y[100:],ddof=0))
        record('forecast_h4',c/(1-phi)+phi**4*(y[-1]-c/(1-phi)))
        record('variance_h4',sum(phi**(2*j) for j in range(4)))
        quarterly=y[:1023].reshape(-1,3).mean(axis=1)
        record('aggregated_fitted_phi',ar_fit(quarterly)[1])
        assert abs(sum(phi**(2*j) for j in range(4))-(1-phi**8)/(1-phi**2))<1e-12
    elif k == 3:
        phi=.6; theta=.4; y=np.zeros(512)
        for t in range(1,len(y)): y[t]=phi*y[t-1]+e[t]+theta*e[t-1]
        best=(0.,0.); loss=float('inf')
        for p in [.2,.4,.6,.8]:
            for q in [-.4,0.,.4,.8]:
                candidate=np.mean(arma_residuals(y,p,q)[30:]**2)
                if candidate<loss: best,loss=(p,q),float(candidate)
        record('conditional_phi',best[0]);record('conditional_theta',best[1])
        record('sample_acf1',acf(y,1));record('theoretical_ma1_acf',theta/(1+theta**2))
        record('invertible_ma_equivalent',theta/(1+theta**2)-(1/theta)/(1+(1/theta)**2))
        record('innovation_mse',loss)
        record('sample_pacf1',pacf(y,1));record('sample_pacf2',pacf(y,2))
        innovation=arma_residuals(y,*best)[-1]
        forecast=best[0]*y[-1]+best[1]*innovation
        record('arma_forecast_h3',best[0]**2*forecast)
    elif k == 4:
        y=ar(e[:360],.8)
        err=rolling(y,4,120)
        naive=np.array([y[t+4]-y[t] for t in range(119,len(y)-4)])
        record('ar_rmse_h4',rmse(err));record('naive_rmse_h4',rmse(naive))
        variance=sum(.8**(2*j) for j in range(4))
        record('known_parameter_variance',variance)
        truth=y[123:]; prediction=truth-err
        record('known_parameter_interval_coverage',np.mean(np.abs(err)<=1.96*np.sqrt(variance)))
        record('loss_difference',np.mean(err**2-naive**2))
        record('asymmetric_optimal_quantile',3/(3+1))
        record('forecast_error_ljung_box8',ljung_box(err,8))
        assert len(truth)==len(prediction)==len(err)
    elif k == 5:
        signal=ar(e[:240],.8); y=signal+f[:240]
        a=ma_filter(y); b=ma_filter(y,True)
        altered=y.copy();altered[121:]+=100
        record('one_sided_future_sensitivity',ma_filter(altered)[120]-a[120])
        record('centered_future_sensitivity',ma_filter(altered,True)[120]-b[120])
        record('raw_signal_rmse',rmse(y-signal))
        record('one_sided_signal_rmse',rmse(a[2:]-signal[2:]))
        record('noise_variance',np.var(f[:240],ddof=0))
        assert ma_filter(altered)[120]==a[120]
        assert ma_filter(altered,True)[120]!=b[120]
    elif k == 6:
        walk=np.cumsum(e[:360]); other=np.cumsum(f[:360])
        b,u=ols(np.column_stack([np.ones(360),other]),walk)
        record('spurious_level_r2',1-u@u/np.sum((walk-walk.mean())**2))
        _,d=ols(np.column_stack([np.ones(359),np.diff(other)]),np.diff(walk))
        record('differenced_r2',1-d@d/np.sum((np.diff(walk)-np.diff(walk).mean())**2))
        record('df_statistic',df_stat(walk))
        record('adf_statistic_lag2',adf_stat(walk,2))
        record('df_adf_zero_lag_error',adf_stat(walk,0)-df_stat(walk))
        drift=np.mean(np.diff(walk));record('arima010_drift_forecast_h3',walk[-1]+3*drift)
        for n in [80,240,720]:
            stats=np.array([df_stat(np.cumsum(normals(n,515+i))) for i in range(200)])
            count=np.mean(stats<-2.86)
            record(f'df_rejection_n{n}',count)
            record(f'df_mcse_n{n}',np.sqrt(count*(1-count)/200))
        record('random_walk_h12_variance',12)
    elif k == 7:
        n=360;t=np.arange(n); temperature=60+18*np.sin(2*np.pi*t/12)+3*f[:n]
        cooling=np.maximum(temperature-65,0); heating=np.maximum(65-temperature,0)
        X=np.column_stack([np.ones(n),np.sin(2*np.pi*t/12),np.cos(2*np.pi*t/12),heating,cooling])
        y=X@np.array([100.,3.,-2.,.8,1.2])+ar(e[:n],.6)
        b,u=ols(X,y);rho=ar_fit(u)[1]
        bt,ut=ols(X[1:]-rho*X[:-1],y[1:]-rho*y[:-1])
        record('ols_heating',b[3]);record('gls_heating',bt[3]);record('gls_cooling',bt[4])
        record('estimated_error_phi',rho);record('gls_innovation_acf1',acf(ut,1))
        record('hot_scenario_level',np.array([1.,0.,1.,0.,15.])@bt)
        record('cold_scenario_level',np.array([1.,0.,1.,15.,0.])@bt)
        assert np.linalg.matrix_rank(X)==5
    elif k == 8:
        state=ar(.5*e[:360],.8);y=state+f[:360];y[150]=np.nan
        m,P,s,S=kalman(y)
        record('filter_rmse',rmse(m-state));record('smoother_rmse',rmse(s-state))
        record('missing_filtered_variance',P[150]);record('previous_filtered_variance',P[149])
        changed=y.copy();changed[181:]+=10
        mm,_,ss,_=kalman(changed)
        record('filter_future_sensitivity',mm[180]-m[180])
        record('smoother_future_sensitivity',ss[180]-s[180])
        record('minimum_smoothing_variance',min(S))
        a=np.r_[0,.8*m[:-1]];previous=np.r_[.25/(1-.8**2),P[:-1]]
        observation_variance=.8**2*previous+.25+1
        observed=~np.isnan(y);innovation=y[observed]-a[observed]
        record('gaussian_log_likelihood',-.5*np.sum(np.log(2*np.pi*observation_variance[observed])+innovation**2/observation_variance[observed]))
        assert np.all(S>=-1e-12) and np.all(S<=P+1e-12)
        assert mm[180]==m[180]
    elif k in [9,10]:
        A=np.array([[.6,.15],[.05,.5]]);Y=np.zeros((600,2))
        B=np.array([[1.,0.],[.7,.8]])
        for t in range(1,600):Y[t]=A@Y[t-1]+B@E[t,:2]
        c,Ah,Sigma=var_fit(Y)
        if k==9:
            record('estimated_a12',Ah[0,1]);record('estimated_a21',Ah[1,0])
            record('spectral_radius',max(abs(np.linalg.eigvals(Ah))))
            W=np.array([[0.,1.],[1.,0.]])
            record('network_forecast_first',((.6*np.eye(2)+.15*W)@Y[-1])[0])
            record('var_forecast_first',(c+Ah@Y[-1])[0])
            record('residual_covariance12',Sigma[0,1])
            V=np.zeros((2,2));power=np.eye(2)
            for j in range(4):V+=power@Sigma@power.T;power=power@Ah
            record('forecast_covariance_h4_trace',np.trace(V))
            record('forecast_sum_variance_h4',np.ones(2)@V@np.ones(2))
        else:
            L=np.linalg.cholesky(Sigma)
            order=np.array([[0.,1.],[1.,0.]])
            reverse=order@np.linalg.cholesky(order@Sigma@order)@order
            record('first_order_impact21',L[1,0]);record('reverse_order_impact21',reverse[1,0])
            angle=.5;Q=np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]])
            rotated=L@Q
            record('covariance_reconstruction_error',np.max(abs(rotated@rotated.T-Sigma)))
            record('rotated_impact21',rotated[1,0])
            record('response_h4', (Ah@Ah@Ah@Ah@L)[1,0])
            assert np.max(abs(L@L.T-Sigma))<1e-10
            assert np.max(abs(reverse@reverse.T-Sigma))<1e-10
    elif k == 11:
        x=np.cumsum(e[:720]);spread=ar(.4*f[:720],.5);y=1.5*x+spread
        b,u=ols(np.column_stack([np.ones(720),x]),y)
        X=np.column_stack([np.ones(719),u[:-1],np.diff(x)])
        ec,errors=ols(X,np.diff(y))
        record('cointegrating_beta',b[1]);record('error_correction_alpha',ec[1])
        record('short_run_dx',ec[2]);record('spread_variance',np.var(u,ddof=0))
        record('ecm_innovation_acf1',acf(errors,1))
        record('spread_ar_phi',ar_fit(u)[1])
        record('ecm_forecast_change',np.array([1.,u[-1],0.])@ec)
    elif k == 12:
        n=1024;u=np.zeros(n);v=np.ones(n)
        for t in range(n):
            if t>0:v[t]=.1+.1*u[t-1]**2+.8*v[t-1]
            u[t]=np.sqrt(v[t])*e[t]
        parameters,loss=garch_fit(u)
        fitted=garch_variance(u,*parameters);z=u/np.sqrt(fitted)
        record('omega_grid',parameters[0]);record('alpha_grid',parameters[1]);record('beta_grid',parameters[2])
        record('qll_objective',loss);record('squared_return_acf1',acf(u**2,1))
        record('squared_standardized_acf1',acf(z**2,1))
        next_variance=parameters[0]+parameters[1]*u[-1]**2+parameters[2]*fitted[-1]
        record('conditional_q05',-1.6448536269514722*np.sqrt(next_variance))
        long_run=parameters[0]/(1-parameters[1]-parameters[2])
        record('variance_forecast_h5',long_run+(parameters[1]+parameters[2])**4*(next_variance-long_run))
        record('unconditional_variance',.1/(1-.1-.8))
        decimal=garch_variance(u/100,parameters[0]/10000,parameters[1],parameters[2])
        record('unit_scaling_error',np.max(abs(decimal*10000-fitted)))
        try:garch_variance(u,.1,.3,.8)
        except ValueError:record('invalid_parameter_rejected',1)
        else:raise AssertionError('Invalid variance parameters were accepted')
    elif k == 13:
        y=np.zeros(480)
        for t in range(1,480):y[t]=(.8 if t<300 else -.4)*y[t-1]+e[t]
        expanding=rolling(y,1,330);moving=rolling(y,1,330,80)
        record('expanding_rmse',rmse(expanding));record('rolling_rmse',rmse(moving))
        difference=moving**2-expanding**2
        record('paired_mean_loss_difference',np.mean(difference))
        # Block standard error with non-overlapping blocks, descriptive at this n.
        blocks=np.array([np.mean(difference[i:i+10]) for i in range(0,len(difference)//10*10,10)])
        record('block_standard_error',np.std(blocks,ddof=1)/np.sqrt(len(blocks)))
        record('hac_standard_error',hac_mean_se(difference,3))
        record('early_fitted_phi',ar_fit(y[:240])[1]);record('late_fitted_phi',ar_fit(y[360:])[1])
    elif k == 14:
        y=ar(e[:420],.65);y[300:]+=4
        candidates=[40,80,160];validation=[]
        for w in candidates:validation.append(rmse(rolling(y[:300],1,240,w)))
        chosen=candidates[int(np.argmin(validation))]
        record('validation_selected_window',chosen)
        frozen=rolling(y,1,340,chosen);benchmark=y[340:]-y[339:-1]
        record('continuation_rmse',rmse(frozen));record('continuation_naive_rmse',rmse(benchmark))
        record('validation_rmse',min(validation));record('continuation_observations',len(frozen))
        record('future_targets_excluded',1)
    elif k == 15:
        y=ar(e[:240],.75,2.);forecast=ar_forecast(y[:180],3)
        record('forecast_original_units',forecast)
        record('forecast_rescaled_error',ar_forecast(100*y[:180],3)/100-forecast)
        changed=y.copy();changed[180:]+=1000
        record('future_mutation_forecast_error',ar_forecast(changed[:180],3)-forecast)
        record('random_walk_error_variance_h1',1);record('random_walk_error_variance_h12',12)
        record('ar_zero_error_variance_h12',1)
        rejected=0
        try:ols(np.ones((10,2)),np.arange(10))
        except ValueError:rejected=1
        record('rank_failure_detected',rejected)
        assert abs(out['15_forecast_rescaled_error'])<1e-10
    else:raise ValueError('Lecture must be an integer from 1 through 15')
    assert all(np.isfinite(value) for value in out.values())
    return out


def run(lecture=None, output=None):
    E=fixtures();result={}
    for k in ([lecture] if lecture else range(1,16)):result.update(experiment(k,E))
    output=Path(output) if output else ROOT/'results'/'python.csv'
    output.parent.mkdir(exist_ok=True)
    with output.open('w',newline='') as file:
        writer=csv.writer(file);writer.writerow(['metric','value'])
        writer.writerows((key,format(value,'.17g')) for key,value in result.items())
    for key,value in result.items():print(f'{key}: {value:.8g}')
    return result


if __name__=='__main__':run(int(sys.argv[1]) if len(sys.argv)>1 else None)
