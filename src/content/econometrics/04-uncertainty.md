---
title: 'Precision around the wrong answer'
order: 4
part: 'Estimate'
description: 'Distinguish sampling uncertainty from bias and choose an uncertainty calculation that matches the design.'
question: 'What does a narrow confidence interval leave unresolved?'
prerequisites: 'Expectation, variance, least squares, and square roots.'
minutes: 30
lab: 'sampling'
---

## Ask what could have been different

An estimate is a number from one dataset. A standard error describes how that estimate would vary across repetitions of a specified sampling or assignment process.

That process matters. Repeatedly sampling employees differs from repeatedly randomizing training across the same employees. Sampling 1,000 employees from one office differs from sampling one employee from each of 1,000 independent offices.

Before calculating uncertainty, finish this sentence: “If we repeated the process, we would keep ___ fixed and redraw ___.” An uncertainty formula is an answer to that sentence, even when software leaves the sentence unwritten.

## A case where the interval is exact

Let $Y_1,\ldots,Y_n$ be independent draws from a normal population with unknown mean $\mu$ and known standard deviation $\sigma$. Then

$$
\bar Y\sim N\left(\mu,\frac{\sigma^2}{n}\right),
\qquad
Z=\frac{\bar Y-\mu}{\sigma/\sqrt n}\sim N(0,1).
$$

Let $z_{0.975}\approx1.959964$ be the standard normal 97.5th percentile. The interval

$$
C(Y)=
\left[\bar Y-z_{0.975}\frac{\sigma}{\sqrt n},
\bar Y+z_{0.975}\frac{\sigma}{\sqrt n}\right]
$$

contains $\mu$ in 95% of repeated samples. The [sampling experiment](/econometrics/lab/#sampling) deliberately uses this known-$\sigma$, Gaussian setting. Its simplicity lets you inspect coverage without mixing in estimated variance or asymptotic approximations.

With $\bar Y=2.4$, $\sigma=4$, and $n=100$, the standard error is $0.4$. The interval is approximately $[1.616,3.184]$.

The parameter is fixed in this frequentist calculation; the interval is random before sampling. After observing a particular interval, the procedure's 95% coverage does not become a 95% posterior probability that $\mu$ lies in that interval. A Bayesian probability statement would require a specified probability model for the unknown parameter.

If $\sigma$ is unknown and the observations remain independent normal draws, replacing it with the sample standard deviation yields a Student $t$ statistic with $n-1$ degrees of freedom. Using a normal critical value with an estimated standard error is usually an approximation, not that exact result.

## The limits behind large-sample reasoning

For independent, identically distributed observations with $E[|Y_i|]<\infty$, the law of large numbers gives $\bar Y\to_p\mu$. With finite, positive variance as well, the central limit theorem gives

$$
\sqrt n(\bar Y-\mu)\ \xrightarrow{d}\ N(0,\sigma^2).
$$

Convergence in probability concerns closeness to a target. Convergence in distribution concerns the shape of scaled fluctuations. Neither statement says every dataset of size 30, or 300, behaves approximately normally. Heavy tails, rare influential observations, and dependence can make an approximation poor.

The same distinction carries into regression. Under suitable sampling and moment conditions, a coefficient becomes increasingly precise around its population projection. That projection can differ from the causal parameter a manager cares about.

## More data can make a bad interval worse

Suppose the desired target is $\theta$, but the observations satisfy

$$
Y_i=\theta+b+\varepsilon_i,\qquad
\varepsilon_i\overset{\mathrm{iid}}{\sim}N(0,\sigma^2).
$$

The persistent bias is $b$. An analyst mistakenly reports the ordinary mean interval as an interval for $\theta$. Its actual coverage is

$$
P(\theta\in C)
=\Phi\left(z_{0.975}-\frac{b\sqrt n}{\sigma}\right)
-\Phi\left(-z_{0.975}-\frac{b\sqrt n}{\sigma}\right),
$$

where $\Phi$ is the standard normal cumulative distribution function.

Take $b=1$ and $\sigma=4$. Coverage is about 29.5% at $n=100$ and 0.12% at $n=400$. With nonzero fixed bias, coverage approaches zero as the sample grows. The interval becomes excellent at locating $\theta+b$ and terrible at covering $\theta$.

~~~python
# Standard Python; 1.96 approximates the exact normal quantile.
from math import erf, sqrt
Phi = lambda z: (1 + erf(z/sqrt(2))) / 2

for n in (25, 100, 400):
    bias_in_se = sqrt(n) / 4
    coverage = Phi(1.96-bias_in_se) - Phi(-1.96-bias_in_se)
    print(n, round(coverage, 4))
~~~

## Match the standard error to the dependence

Heteroskedasticity allows the error variance to differ across observations. For independent, identically distributed observations, let $\mathbf x_i$ be the regressor vector and $u_i$ the population projection error. The conditional error variance can still vary with $\mathbf x_i$. If the relevant moments exist, $Q=E[\mathbf x_i\mathbf x_i']$ is nonsingular, and a suitable central limit theorem applies,

$$
\sqrt n(\widehat{\boldsymbol\beta}-\boldsymbol\beta)
\xrightarrow{d}
N(0,Q^{-1}\Omega Q^{-1}),
\quad
\Omega=E[\mathbf x_i\mathbf x_i'u_i^2].
$$

The sample counterpart is the heteroskedasticity-robust sandwich variance estimator. Its job is to estimate sampling variance under unequal variances. It does not correct selection, measurement error, or omitted-variable bias.

Employees within an office may share shocks. A cluster-robust calculation aggregates score contributions within office:

$$
\widehat{\operatorname{Var}}(\widehat{\boldsymbol\beta})
=(\mathbf X'\mathbf X)^{-1}
\left(\sum_{g=1}^G\mathbf S_g\mathbf S_g'\right)
(\mathbf X'\mathbf X)^{-1},
\qquad
\mathbf S_g=\sum_{i\in g}\mathbf x_i\widehat u_i.
$$

This displays the uncorrected form; software often adds finite-sample adjustments. The standard justification requires sufficiently many independent clusters and conditions preventing a few clusters from dominating. A large employee count cannot substitute for those conditions.

As an illustration for a simple mean with equally sized independent clusters, cluster size $m=25$ and within-cluster correlation $\rho=0.1$ inflate variance relative to independent observations by $1+(m-1)\rho=3.4$. This formula depends on that exchangeable covariance structure; it is not a universal regression correction.

## Try it

**1.** How much must sample size increase to halve the standard error of an independent sample mean, keeping population variance fixed?

<details class="solution"><summary>Work through the solution</summary>

The standard error is $\sigma/\sqrt n$. Replacing $n$ with $4n$ divides it by two. Doubling $n$ multiplies it by $1/\sqrt2\approx0.707$. The claim assumes the additional observations follow the same independent sampling process.

</details>

**2.** A training estimate is 3 with a standard error of 0.1. A credible selection mechanism could contribute between 1 and 4 output units to that association. Can the narrow interval establish a positive causal effect?

<details class="solution"><summary>Work through the solution</summary>

No. Ignoring sampling variation for the moment, subtracting the selection contribution gives causal effects between $3-4=-1$ and $3-1=2$. Sampling uncertainty would add another layer. Reporting $3\pm1.96(0.1)$ addresses precision around the association and leaves the identification uncertainty unresolved.

</details>

## Read further

Hansen's [Econometrics](https://users.ssc.wisc.edu/~behansen/econometrics/) develops asymptotic regression theory. Cameron and Miller's [A Practitioner's Guide to Cluster-Robust Inference](https://doi.org/10.3368/jhr.50.2.317) explains why the clustering level and the number of clusters deserve substantive attention.
