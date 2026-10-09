---
title: Forecasts that survive a chronological comparison
order: 4
description: Construct rolling-origin comparisons, distinguish kinds of uncertainty, and connect forecast loss to decisions.
question: Has the model improved a decision on targets it had not seen?
prerequisites: Lectures 1–3, conditional variance, and least squares.
lecture: February 5
concepts: [rolling origins, horizons, loss, forecast intervals, parameter uncertainty, residual diagnostics]
---

## Fitting and forecasting answer different questions

A regression's fitted values use coefficients estimated from its training sample. Their residuals describe how that fitted model represents observations it has already seen. A forecast uses a model constructed before its target is observed. Its errors describe performance on subsequent targets. A small training residual sum of squares can coexist with poor forecasting.

Begin with a historical sequence and a forecast origin $t$. The training window ends at that origin, or at the latest earlier observation available under the release rule. Fit the model using only that window, issue a forecast for $t+h$, and retain the prediction. Move the origin forward and repeat. This is rolling-origin evaluation. An expanding window starts at a fixed initial date; a rolling window retains a fixed number of recent observations.

An honest comparison holds the target periods, information rule, and loss fixed across methods. If one model is evaluated only on easy months and another on every month, their average losses are not comparable. If a model cannot produce a forecast at an origin, record that failure and apply a declared fallback rule. Do not silently drop the difficult target.

The comparison should reflect the intended deployment. Refitting at every origin evaluates a repeatedly updated procedure. Fitting once and holding coefficients fixed evaluates a different procedure. Both are legitimate designs if their interpretation is explicit.

## The algorithm is part of the statistical model

For an estimated AR(1), the procedure at each origin solves

$$
\min_{c,\phi}\sum_{s\in W_t}(Y_s-c-\phi Y_{s-1})^2,
$$

then iterates the estimated recursion $h$ steps. $W_t$ contains admissible target-regressor pairs from that origin's training window. A lagged outcome requires both rows to be available; missing periods must not turn adjacent rows into a false one-period lag.

The executable implementation uses QR-based least squares. Solving the normal equations by explicitly inverting $X'X$ is unnecessary and can amplify numerical problems. Rank checks detect a design with redundant columns or insufficient observations. This is a computational condition; rank sufficiency does not establish exogeneity, stationarity, or stability.

Preprocessing also belongs inside the origin loop. Estimate a mean, standard deviation, imputation rule, seasonal adjustment, or principal component from training data. Apply the retained transformation to the admissible prediction inputs. A full-sample transformation can carry information from the test period into every historical forecast even when the regression itself is refitted correctly.

Tuning requires another boundary. Use an earlier validation segment to choose lag order or window length, then evaluate the chosen procedure on later targets. Repeatedly choosing a model after observing the same test errors turns that test segment into a selection sample. Lecture 14 will freeze a complete procedure before a continuation release.

## Match loss to the decision

For errors $e_t=Y_t-\widehat Y_t$, common summaries are

$$
\operatorname{MAE}=\frac1n\sum_t|e_t|,
\qquad
\operatorname{RMSE}=\sqrt{\frac1n\sum_te_t^2}.
$$

Both are in outcome units. RMSE emphasizes large errors. MAE has the conditional median as its population-optimal point forecast; squared loss has the conditional mean. Percentage errors are problematic near zero and can compare series in economically misleading ways. For a scaled error, calculate its scaling denominator from the training sample and state the benchmark defining that scale.

If underprediction costs $c_u$ per unit and overprediction costs $c_o$, define

$$
L(a,Y)=c_u(Y-a)_++c_o(a-Y)_+.
$$

For a continuous conditional distribution $F$, differentiating expected loss with respect to $a$ gives $-c_u[1-F(a)]+c_oF(a)$. The optimum satisfies

$$
F(a)=\frac{c_u}{c_u+c_o}.
$$

With $c_u=3$ and $c_o=1$, the preferred action is the conditional 75th percentile. An unbiased conditional-mean forecast can therefore be an inappropriate reserve decision. The distinction is between estimating an outcome distribution and choosing an action from that distribution.

## Identify the uncertainty in an interval

For a known-parameter stable AR(1), the $h$-step process variance is $V_h=\sigma^2\sum_{j=0}^{h-1}\phi^{2j}$. Gaussian innovations give a conditional Gaussian forecast distribution, so an interval is $\widehat Y\pm z_{1-\alpha/2}\sqrt{V_h}$.

There are several practical qualifications. Estimating parameters adds uncertainty; selecting a model adds another layer; a future covariate may need its own forecast; a geographic measure may be uncertain; and a structural break can invalidate the fitted process entirely. A normal interval computed from a residual variance addresses only the assumptions included in that calculation.

One possible approximation for a one-step regression forecast adds the coefficient-estimation term:

$$
\widehat\sigma^2\left[1+x_{t+1}'(X'X)^{-1}x_{t+1}\right].
$$

This formula assumes the usual homoskedastic regression conditions and treats the prediction regressors appropriately. It is not a universal ARMA multi-step interval. With dependence, a simulation or bootstrap should preserve the relevant temporal structure and repeat the actual fitting procedure. Resampling individual time rows indiscriminately destroys that structure.

Check intervals empirically. Record coverage, average width, and behavior in periods relevant to the decision. High coverage from enormous intervals can be operationally unhelpful. Narrow intervals with severe undercoverage misstate risk. For overlapping multi-step targets, successive errors are dependent, so a binomial standard error is generally inappropriate without addressing that dependence.

## Compare paired errors

Let $e_{A,t}$ and $e_{B,t}$ be errors on identical targets. Analyze

$$
d_t=L(e_{A,t})-L(e_{B,t}).
$$

A negative mean favors A for that loss and those targets. Pairing preserves the fact that both forecasts face the same difficult months. A standard error for $\overline d$ must reflect serial dependence, including dependence from overlapping horizons and repeated estimation. A heteroskedasticity-and-autocorrelation-consistent estimate or a carefully designed block bootstrap can be suitable under its assumptions.

Do not turn every small numerical difference into a superiority claim. The sample may be short, the decision costs may be poorly specified, or the improvement may disappear when the release lag changes. Report the size of the improvement and what it would change operationally. An inconclusive comparison can justify retaining a transparent benchmark.

## Diagnose the innovation sequence

A useful residual audit asks whether mean bias remains, whether lagged residuals predict future residuals, whether squared residuals cluster, and whether errors differ across calendar periods or geographic regimes. A Ljung–Box statistic has the form

$$
Q=n(n+2)\sum_{k=1}^m\frac{\widehat\rho(k)^2}{n-k}.
$$

Its approximate reference distribution depends on model fitting and degrees-of-freedom adjustments. The statistic aggregates selected residual correlations; failing to reject does not prove independence or complete model correctness. Residual diagnostics complement later-target evaluation. They cannot substitute for it.

For a correctly specified conditional-mean model, systematic residual correlation with an available predictor reveals a potential repair. The predictor must have been observable at the origin. Regressing historical forecast errors on realized future weather may explain mistakes retrospectively while supplying no feasible real-time forecasting method.

## Execute a matched comparison

The lecture's code simulates an AR(1) with coefficient 0.8 and evaluates four-step forecasts after an initial 120 observations. It refits an intercept and persistence coefficient at every origin. The naive competitor holds the latest observed value for all four steps. Both methods forecast the same targets.

The shared realization gives an AR RMSE of about 1.530 and a naive RMSE of about 1.760. The mean difference in squared loss favors the fitted AR procedure on this realization. This is a conditional teaching result, not a claim that autoregressions always dominate naive forecasts.

The code also checks a plug-in interval using the generating process variance while the point forecast uses estimated coefficients. Its label explicitly describes the known-parameter variance component. The resulting coverage is diagnostic, not an exact nominal-coverage theorem for the estimated procedure. Change the sample length and persistence to see where ignoring estimation uncertainty becomes more consequential.

Deliberately fit once using the entire series, then use those coefficients at every earlier origin. Compare the apparent performance with the chronological version. The size of the distortion will depend on the sample. Repair the procedure by moving all fitting and transformation steps inside the origin loop. Finally mutate every observation after a chosen origin and confirm that the retained earlier forecast remains unchanged.

## Worked problem and assignment preparation

At an origin with 100 training observations, a model produces four forecasts. The first targets $t+1$ and the last targets $t+4$. If your evaluation table labels them all with origin $t$, how should you join actuals? Join the first to period $t+1$, the second to $t+2$, and so forth, keeping both origin and target period. One actual can be the target of forecasts issued at several different origins. Those are distinct forecasting tasks.

Suppose A has squared losses $(1,9,4)$ and B has $(4,4,9)$ on the same three targets. Their mean losses are $14/3$ and $17/3$, so the paired mean difference is $-1$. The three differences are $(-3,5,-5)$; the ranking reverses on the second target. A report should show that heterogeneity, identify the decision's important regimes, and avoid treating three observations as strong evidence of universal superiority.

For the first concept check, be prepared to derive an AR forecast, identify an inadmissible input, and interpret a loss comparison. For Project 1, retain a forecast table with an explicit origin-target relationship and an unaltered benchmark. The project is now a reproducible decision procedure, not only a fitted model.

## Further reading

See [Forecasting: Principles and Practice on point accuracy](https://otexts.com/fpp3/accuracy.html) and [residual diagnostics](https://otexts.com/fpp3/diagnostics.html). Its [forecasting with dynamic regression](https://otexts.com/fpp3/forecasting.html) explains why future regressors also require forecasts.
