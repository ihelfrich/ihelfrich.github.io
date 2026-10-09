---
title: ARMA models and recoverable innovations
order: 3
description: Derive ARMA representations, autocovariances, and invertibility, then estimate a transparent conditional model.
question: Can the observed history reveal the shocks that generated it?
prerequisites: Lecture 2, polynomial roots, and geometric series.
lecture: January 29
concepts: [ARMA, lag polynomials, stationarity, invertibility, ACF, PACF, conditional estimation]
---

## Separate propagation from innovation memory

An autoregression propagates past outcomes. A moving-average model carries past innovations into the current observation. For a centered series, an ARMA(1,1) combines both:

$$
X_t=\phi X_{t-1}+\varepsilon_t+\theta\varepsilon_{t-1}.
$$

Our convention places a plus sign before $\theta$. Software packages and textbooks sometimes use different signs. Record the convention before comparing estimates. A coefficient disagreement caused by opposite conventions is a notation mismatch, not an empirical contradiction.

Define the lag operator $LX_t=X_{t-1}$. The model is $(1-\phi L)X_t=(1+\theta L)\varepsilon_t$. A general ARMA$(p,q)$ has

$$
\Phi(L)X_t=\Theta(L)\varepsilon_t,
\quad \Phi(z)=1-\sum_{i=1}^p\phi_i z^i,
\quad\Theta(z)=1+\sum_{j=1}^q\theta_jz^j.
$$

For a causal stationary representation, the roots of $\Phi(z)=0$ must lie outside the unit circle. For an invertible innovation representation, the roots of $\Theta(z)=0$ must lie outside it. These conditions concern different polynomials and different questions. For ARMA(1,1), they become $|\phi|<1$ and $|\theta|<1$, respectively.

## Build the moving-average representation

When $|\phi|<1$,

$$
X_t=\frac{1+\theta L}{1-\phi L}\varepsilon_t
=\sum_{j=0}^{\infty}\psi_j\varepsilon_{t-j},
$$

where $\psi_0=1$ and $\psi_j=(\phi+\theta)\phi^{j-1}$ for $j\ge1$. Obtain the coefficients by multiplying $(1+\theta L)$ by $\sum_{j\ge0}\phi^jL^j$. This representation shows the immediate innovation effect and the later propagation effects.

With serially uncorrelated innovations of variance $\sigma^2$,

$$
\gamma(0)=\sigma^2\sum_{j\ge0}\psi_j^2
=\sigma^2\frac{1+\theta^2+2\phi\theta}{1-\phi^2}.
$$

The numerator and denominator are dimensionless, leaving squared outcome units. At $\theta=0$, this reduces to the AR(1) variance. At $\phi=0$, it becomes $\sigma^2(1+\theta^2)$, the MA(1) variance. At $\theta=-\phi$, the lag polynomials cancel and $X_t=\varepsilon_t$. Such common factors make an unnecessarily large model observationally redundant.

The lag-one covariance is

$$
\gamma(1)=\phi\gamma(0)+\theta\sigma^2.
$$

Multiply the original recursion by $X_{t-1}$ and take expectations. The current innovation is uncorrelated with the past, while $\operatorname{Cov}(\varepsilon_{t-1},X_{t-1})=\sigma^2$. For $k\ge2$, $\gamma(k)=\phi\gamma(k-1)$. The first lag therefore contains both autoregressive propagation and moving-average memory; later lags decay geometrically.

## Why invertibility matters

For an MA(1), $X_t=\varepsilon_t+\theta\varepsilon_{t-1}$. If $|\theta|<1$,

$$
\varepsilon_t=(1+\theta L)^{-1}X_t
=\sum_{j=0}^{\infty}(-\theta)^jX_{t-j}.
$$

The coefficients decay, so distant observations have diminishing influence on the recovered innovation. If $|\theta|>1$, this backward recursion amplifies initialization error. A stable series can therefore have a noninvertible representation: stationarity does not guarantee stable recovery of shocks from observed history.

The MA(1) autocorrelation is $\rho(1)=\theta/(1+\theta^2)$ and $\rho(k)=0$ for $k>1$. Replacing $\theta$ by $1/\theta$ preserves $\rho(1)$. It also preserves the covariance function if the innovation variance is rescaled to $\theta^2\sigma^2$. Gaussian processes with these matched covariance functions have the same distribution. An invertibility convention selects the representation with recoverable innovations; the ACF alone cannot distinguish reciprocal MA roots.

This does not mean all non-Gaussian models with the same covariance are identical in every respect. Covariance characterizes second-order behavior; additional distributional information can matter. Our elementary identification statement should remain within its assumptions.

## Read an ACF and PACF without treating them as verdicts

The autocorrelation function measures the association between $X_t$ and $X_{t-k}$. The partial autocorrelation at lag $k$ removes linear dependence on the intervening $k-1$ lags. Equivalently, it is the final coefficient in the population linear projection of $X_t$ onto its first $k$ lags under the usual nonsingularity conditions.

For a pure AR$(p)$, the population PACF cuts off after $p$ and the ACF generally tails off. For a pure MA$(q)$, the population ACF cuts off after $q$ and the PACF generally tails off. For a mixed ARMA, both can tail off. Seasonal dynamics introduce patterns at seasonal lags. Differencing, finite samples, parameter cancellation, and near-unit roots complicate these pictures.

An estimated ACF is noisy. A familiar $\pm1.96/\sqrt n$ band is a rough white-noise reference, not a simultaneous confidence band for every lag of every fitted model. Inspecting many lags creates many opportunities for an apparent excursion. Use the plots to propose a short candidate list, then check residuals and evaluate the candidates on later targets.

The laboratory's ARMA series has $\phi=0.6$ and $\theta=0.4$. Its sample lag-one correlation is substantially larger than the isolated MA(1) correlation $0.4/(1+0.4^2)$. Comparing those two values does not reveal an error: one belongs to a mixed model and the other to a pure MA benchmark. Calculate the mixed-model population correlation using the formulas above before interpreting the sample.

## Estimate a conditional model transparently

Given a candidate $(\phi,\theta)$ and an initialization $\widehat\varepsilon_0=0$, recover residuals recursively:

$$
\widehat\varepsilon_t
=X_t-\phi X_{t-1}-\theta\widehat\varepsilon_{t-1}.
$$

Conditional sum of squares minimizes $\sum_t\widehat\varepsilon_t^2$. The source uses a small declared grid and excludes the first 30 residuals from the comparison. A grid estimate is transparent but coarse. It supplies neither exact maximum likelihood nor standard errors. Its pedagogical purpose is to expose the objective, initialization, parameter restrictions, and residual recursion before using a package optimizer.

When fitting real data, an exact Gaussian likelihood accounts for the initial state distribution; conditional likelihood conditions on initial information. Near boundaries, small-sample estimates can depend appreciably on that treatment. An optimizer's successful exit does not prove the global optimum or the economic validity of the model. Retain its convergence information and inspect admissibility.

Estimate a mean explicitly, or center using training data only. Centering with the full sample before forecasting leaks future information into the historical regressors. The lecture's synthetic ARMA is constructed with zero mean, so its grid search has no estimated mean term. That simplifying assumption must not silently migrate to an application with a changing level.

## Execute, break, and repair

Run `ch03` in all three languages. The declared grid includes the generating coefficients, and the shared realization selects them under the conditional criterion. Inspect the entire grid if you want to see how sharply the objective distinguishes nearby candidates. Recover the residuals, then calculate their ACF. A model that reproduces the outcome's ACF can still leave predictable residual patterns.

Set $\theta=1.2$ in the data generator and try the innovation recursion with that coefficient. Perturb the initial residual by a small amount. The initialization difference evolves as $(-\theta)^t$ and grows in magnitude. Repeat at $\theta=0.4$; the difference decays. Repair the representation by finding the reciprocal invertible coefficient and rescaling innovation variance. Explain which features of the observed series are retained.

Next set $\theta=-\phi$. The simulated series collapses to white noise apart from initialization handling. A two-parameter model that seems flexible here is redundant. Simplify the representation and record the reason in the ledger.

## Worked problems

For an MA(1) with $\theta=0.5$ and $\sigma^2=4$, variance is $4(1+0.25)=5$ and lag-one covariance is $0.5(4)=2$. Thus $\rho(1)=0.4$. The reciprocal representation has coefficient 2 and innovation variance 1; its variance is again 5 and its lag-one covariance again 2. The first representation is invertible; the second is not.

For an ARMA(1,1) with $\phi=0.5$, $\theta=0.2$, and $\sigma^2=1$, variance is $(1+0.04+0.2)/(1-0.25)=1.653\overline3$. Lag-one covariance is $0.5(1.653\overline3)+0.2=1.026\overline6$, giving lag-one correlation approximately 0.621. Lag-two covariance is half the lag-one covariance. These checks establish the correct sign convention before any software result is interpreted.

For Project 1, declare a small candidate family and justify it through the target's dynamics. Preserve the benchmark, information rule, and forecast origins. A larger model earns its place through a defensible improvement on that comparison. Lecture 4 specifies the comparison itself.

## Further reading

[QuantEcon's ARMA lecture](https://python-advanced.quantecon.org/arma.html) develops covariance-stationary processes in time and frequency domains. [Forecasting: Principles and Practice](https://otexts.com/fpp3/arima.html) discusses practical ARIMA model selection.
