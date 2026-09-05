---
title: 'Tomorrow and elsewhere are different populations'
order: 11
part: 'Generalize'
description: 'Connect likelihood, dependent-data forecasting, predictive coverage, and the assumptions needed to transfer an effect.'
question: 'What changes when the next observation comes next month or from a different workplace?'
prerequisites: 'Conditional expectation, variance, estimation, and the distinction between prediction and intervention.'
minutes: 35
---

## Name the future observation

A firm wants next month's demand forecast, an employee's probability of leaving, and the effect of exporting its training program to a new division. Each request concerns an unobserved outcome. The required arguments differ.

A forecast conditions on information available now. A probability model assigns a distribution to an outcome. Transferring a treatment effect asks whether a causal relationship learned in one population applies in another. A model can do the first two well while failing at the third.

## Likelihood adds a distributional commitment

For a binary outcome $Y_i$, suppose independent observations satisfy

$$
P(Y_i=1\mid X_i)=p_i=\frac{\exp(X_i'\beta)}{1+\exp(X_i'\beta)}.
$$

The logistic model belongs to the generalized linear model family. Its link maps a probability into log odds. Conditional on covariates, the log-likelihood is

$$
L(\beta)=\sum_i\{Y_iX_i'\beta-\log(1+\exp(X_i'\beta))\}.
$$

Differentiating yields the score $\sum_iX_i(Y_i-p_i)$ and Hessian $-\sum_ip_i(1-p_i)X_iX_i'$. The Hessian is negative semidefinite. With appropriate rank and existence conditions, optimization identifies the maximum; complete separation can prevent a finite maximum from existing.

A coefficient shifts log odds, not probability by a constant amount. Starting at $p=0.20$, doubling the odds changes odds from $0.25$ to $0.50$, hence probability to $0.50/1.50=1/3$. For a continuous covariate entering linearly, the probability derivative is $p(1-p)\beta_j$. It depends on the covariates. A causal interpretation still requires a design; the link function provides none.

If the observations are dependent, multiplying their marginal conditional probabilities need not be the joint likelihood. Conditional-mean estimation may remain useful under justified quasi-likelihood and dependence-robust conditions, but the independence-based uncertainty calculation needs reconsideration.

## Derive a forecast with memory

Consider a synthetic output series following

$$
Y_t-\mu=\phi(Y_{t-1}-\mu)+\varepsilon_t,
\qquad |\phi|<1,
$$

where innovations are independent $N(0,\sigma^2)$ and independent of the past. Its stationary solution is $Y_t-\mu=\sum_{j=0}^{\infty}\phi^j\varepsilon_{t-j}$, with variance $\sigma^2/(1-\phi^2)$. This infinite series explains why the stability restriction matters.

Iterating forward $h$ dates gives

$$
Y_{T+h}=\mu+\phi^h(Y_T-\mu)
+\sum_{j=0}^{h-1}\phi^j\varepsilon_{T+h-j}.
$$

The conditional mean forecast and forecast-error variance, with parameters known, are

$$
\hat Y_{T+h\mid T}=\mu+\phi^h(Y_T-\mu),
\qquad s_h^2=\sigma^2\sum_{j=0}^{h-1}\phi^{2j}.
$$

Independence eliminates covariance terms in the variance sum. Gaussian innovations make the forecast error Gaussian, giving an approximately 95% predictive interval $\hat Y_{T+h\mid T}\pm1.96s_h$. Parameter-estimation uncertainty is absent from this known-parameter calculation.

At $\mu=100$, $Y_T=110$, $\phi=0.8$, and $\sigma=3$, next month's forecast is 108 with interval $[102.12,113.88]$. The two-month forecast is 106.4 and its error variance is $9(1+0.8^2)=14.76$. Further forecasts move toward 100 while predictive variance approaches the stationary variance of 25.

```python
from math import sqrt
mu, last, phi, sigma = 100, 110, 0.8, 3
for h in (1, 2):
    forecast = mu + phi**h * (last - mu)
    sd = sigma * sqrt(sum(phi**(2*j) for j in range(h)))
    print(h, forecast, tuple(round(v, 2) for v in
          (forecast - 1.96*sd, forecast + 1.96*sd)))
```

These are intervals for future observations. An interval for the stationary mean $\mu$ concerns a different random quantity and a different estimator.

## Preserve the information clock

Forecast evaluation should imitate deployment: train through a date, predict subsequent dates, advance the training window, and repeat. Never let future labels, later revisions, or full-sample normalization enter an earlier forecast. A downloaded time-series snapshot can contain revised historical values unavailable at the original forecast date.

Serial dependence also changes precision. For a stationary process with autocovariance $\gamma_h$, the sample-mean variance is

$$
\operatorname{Var}(\bar Y)
=\frac{1}{n^2}\left[n\gamma_0+
2\sum_{h=1}^{n-1}(n-h)\gamma_h\right].
$$

The usual $\gamma_0/n$ expression drops all off-diagonal terms. Persistent positive correlations can make that omission severe. Structural breaks create a further problem: tomorrow's conditional relationship may no longer resemble the historical one, even with a careful time split.

## Coverage without a full outcome model

Split conformal prediction uses a fitted predictor and an independent calibration sample. Let calibration scores be $s_i=|Y_i-\hat f(X_i)|$, with $m$ scores. Set $k=\lceil(m+1)(1-\alpha)\rceil$ and let $q$ be the $k$th smallest score, using $q=\infty$ if $k=m+1$. Predict with $[\hat f(x)-q,\hat f(x)+q]$.

If calibration and test observations are exchangeable conditional on the training data, the test score's rank gives marginal coverage at least $1-\alpha$. Ties can make coverage conservative. The guarantee averages over the new covariates; it does not promise coverage at every $x$ or a causal confidence interval.

Ordinary chronological dependence or distribution shift can break exchangeability. Applying the formula to a time series does not restore its guarantee. [Angelopoulos and Bates](https://arxiv.org/abs/2107.07511) explain the basic result and its scope.

## A trial can travel only under assumptions

Let $S=1$ denote trial participation and $S=0$ the target population. Randomization can identify $\mu_a(x)=E[Y\mid A=a,X=x,S=1]$ within the trial. To identify target potential-outcome means through

$$
E[Y(a)\mid S=0]=E[\mu_a(X)\mid S=0],
$$

we additionally need conditional mean exchangeability across participation, $E[Y(a)\mid X,S=1]=E[Y(a)\mid X,S=0]$, and trial support throughout the target covariate distribution. Consistency, trial treatment positivity, and the trial's treatment-identification conditions still apply. [Dahabreh and coauthors](https://arxiv.org/abs/1709.04589) develop a formal generalization framework.

Different division cultures may alter training effects even after measured adjustment. Spatial spillovers can also change the intervention itself. Reweighting addresses observed population composition under assumptions; it cannot manufacture missing support or policy invariance.

## Try the argument

**1.** With $\phi=0$, what happens to the known-parameter forecast and variance at every positive horizon?

<details class="solution"><summary>Work through the solution</summary>

The forecast is $\mu$ and the error variance is $\sigma^2$. The latest deviation contains no predictive information. The horizon sum contains only its $j=0$ term, equal to one.

</details>

**2.** Twenty percent of the target employees have job roles absent from the trial. Can weighting the trial alone identify their treatment effects?

<details class="solution"><summary>Work through the solution</summary>

No. Trial-participation positivity fails for those roles. A target-wide effect requires new evidence or explicit extrapolation restrictions. An effect for the supported target subpopulation is a different, potentially defensible target.

</details>

## Read alongside this chapter

[Hansen's Econometrics](https://users.ssc.wisc.edu/~behansen/econometrics/) supplies likelihood and dependent-data foundations. Keep the conformal and transport references beside their assumptions: a portable algorithm does not imply a portable guarantee.
