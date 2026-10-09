---
title: What an impulse response can claim
order: 10
description: Derive reduced-form and structural responses, demonstrate rotational ambiguity, and defend identification assumptions.
question: Which assumptions turn an unexplained movement into an economic shock?
prerequisites: Lecture 9, covariance matrices, orthogonal matrices, and matrix powers.
lecture: March 26
concepts: [structural shocks, Cholesky ordering, impulse responses, rotational ambiguity, network identification]
---

## The disturbance is an unexplained movement

The reduced-form VAR is $Y_t=c+AY_{t-1}+u_t$, with $\operatorname{Var}(u_t)=\Sigma$. Its disturbance is the movement that the included histories did not predict. It can combine several economic shocks, omitted variables, measurement disturbances, and a model's misspecification.

A structural interpretation writes

$$
u_t=B\varepsilon_t,\qquad
\mathbb E[\varepsilon_t\varepsilon_t']=I.
$$

The structural shocks are normalized to unit variance and contemporaneously uncorrelated. Their impact matrix $B$ determines how each shock moves the observed variables immediately. The observed covariance supplies the restriction $BB'=\Sigma$.

That restriction generally does not identify $B$ uniquely. In a two-variable system, $B$ has four entries while symmetric $\Sigma$ supplies three distinct covariance entries. Normalization is useful, but additional substantive restrictions are needed. Assigning a column the name “regional transmission shock” does not supply one of those restrictions.

## Derive the response conditional on an impact matrix

In a stable centered VAR(1),

$$
X_t=\sum_{j=0}^{\infty}A^ju_{t-j}
=\sum_{j=0}^{\infty}A^jB\varepsilon_{t-j}.
$$

A unit structural shock in component $j$ at date $t$ has response $A^hBe_j$ at horizon $h$, holding other shocks at zero. At impact, the response is $Be_j$. At one period, it is $ABe_j$. Subsequent propagation follows the estimated reduced-form dynamics.

These are model-implied responses to a shock defined by $B$. Their economic interpretation inherits the identification assumptions used to construct that matrix. A well-estimated $A$ and $\Sigma$ can coexist with an unresolved economic shock interpretation.

Shock normalization affects scale. A one-standard-deviation shock, a shock normalized to move the first variable by one unit, and a shock normalized to a one-percent policy change produce differently scaled responses. State the normalization and outcome units on every response graph. An apparently large cross-region response can reflect a large shock normalization rather than a stronger economic mechanism.

## Cholesky decomposition chooses a recursive system

For a positive-definite $\Sigma$, a lower-triangular Cholesky factor $L$ satisfies $LL'=\Sigma$. Using $B=L$ imposes a recursive impact structure. In two variables,

$$
L=\begin{pmatrix}\ell_{11}&0\\\ell_{21}&\ell_{22}\end{pmatrix}.
$$

The first variable does not respond immediately to the second structural shock; the second can respond immediately to both. This asymmetry is an identification assumption. It does not follow merely from placing the first variable first in a data file.

Reversing variable order produces a different recursive restriction. Both factorizations reproduce the same covariance after the appropriate permutation back to the original variables. Their impact responses can differ. Variable ordering is therefore part of the economic argument, not an innocuous plotting option.

In a monthly regional system, an immediate-zero restriction may be implausible if markets adjust within days. At a daily frequency, another timing restriction may be more plausible, but measurement and release timing become more demanding. Identification should match the time interval over which “immediate” is defined.

## Orthogonal rotations expose the ambiguity

Let $Q$ be any orthogonal matrix, so $QQ'=I$. If $B$ is a valid covariance factor, then

$$
(BQ)(BQ)'=BQQ'B'=BB'=\Sigma.
$$

An entire family of impact matrices therefore agrees with the same reduced-form covariance. In two dimensions, a rotation can be written

$$
Q(\omega)=\begin{pmatrix}\cos\omega&-\sin\omega\\\sin\omega&\cos\omega\end{pmatrix}.
$$

Changing $\omega$ changes the mixture called each shock while preserving covariance. If the reduced-form disturbances are jointly Gaussian, covariance-preserving orthogonal rotations also preserve their Gaussian distribution. Additional non-Gaussian distributional structure can supply different identifying information, but it must be specified and defended.

This calculation is a counterexample to the claim that a positive-definite covariance matrix uniquely reveals economic shocks. It is exact linear algebra. More observations can estimate $\Sigma$ more precisely; they do not remove this unrestricted rotation by themselves.

## Common shocks and network propagation can look similar

Two regions may move together because a disturbance propagates through economic links. They may also respond to a common national shock, share measurement practices, or react to an omitted input. Predictive cross-lags alone do not resolve these alternatives.

A known network matrix can impose economically meaningful structure, but the network needs its own provenance. Geographic adjacency is not necessarily an electricity-transmission relationship; a trade link is not necessarily a causal channel at the chosen frequency. A network based on contemporaneous outcome correlations can also encode the same common shocks it is being used to explain.

Consider an omitted common factor $F_t$ affecting both regions with persistence. Each region's lagged outcome can predict the other's future because it contains information about $F_t$. An unrestricted VAR may report cross-lags even when there is no direct region-to-region transmission. A causal claim requires a strategy separating the shared factor from the hypothesized channel.

Useful identifying information can come from institutional timing, externally measured shocks, instruments, sign restrictions, or restrictions on long-run effects. Each introduces assumptions beyond the reduced-form fit. The course's core exercise does not estimate all these methods; it equips you to state what an identified method must add and what evidence could challenge it.

## Statistical and identification uncertainty are different

Sampling uncertainty concerns how estimated responses vary across samples under a maintained model and identifying restriction. A residual bootstrap can estimate that variation if its resampling scheme respects the assumed disturbance structure and refits the full procedure. Near instability, small samples, and model selection complicate the approximation.

Identification uncertainty concerns the different responses compatible with credible alternative restrictions. A narrow sampling band around a Cholesky response does not show that its ordering is correct. Report sensitivity to plausible orderings or other admissible restrictions alongside sampling uncertainty. If the key substantive conclusion changes across those alternatives, the economic claim should narrow.

Forecasting can remain useful even when structural identification is unresolved. A predictive system may support reserve planning while being insufficient to estimate the effect of an intervention. The model's action recommendation should match the evidence it supplies.

## Execute the covariance counterexample

Run `ch10`. The source fits the same synthetic two-variable VAR as Lecture 9. It obtains a lower-triangular factor, reverses the variable order and factors again, then constructs a rotation by angle 0.5 radians. All three impact matrices reproduce the same reduced-form covariance to numerical tolerance.

The first recursive ordering produces a nonzero immediate response of the second variable to the first shock. Under the reversed recursive restriction, that corresponding impact is zero. The rotated factor yields a third value. Those discrepancies are the experiment's point: covariance agreement does not imply agreement about economic shock effects.

The code asserts covariance reconstruction for both recursive factorizations. Inspect those tests before inspecting the response values. A failed reconstruction indicates a computational error; successful reconstruction followed by different responses indicates the identification ambiguity we intended to demonstrate.

## Break a causal story and repair the claim

Write a paragraph interpreting the first Cholesky shock as an intervention in region one. State the immediate exclusion restriction needed for that interpretation. Then reverse the ordering and retain the same reduced-form data. Identify which sentence in the original paragraph is no longer supported.

Repair the paragraph in one of two defensible ways. Supply credible external identifying information and state its assumptions, or narrow the paragraph to a model-based predictive response under a declared recursive ordering. A repair that merely changes the plotted color or shock label has not addressed identification.

For the audit verdict, separate replication errors, information violations, and unidentified causal claims. A partner can have executable code and honest forecasts while overinterpreting a response. Your evidence should identify that precise problem and its consequence for the proposed action.

## Worked decomposition

Suppose $\Sigma=\begin{pmatrix}4&2\\2&5\end{pmatrix}$. A lower-triangular factor is $L=\begin{pmatrix}2&0\\1&2\end{pmatrix}$, because $LL'=\Sigma$. Under this ordering, the first unit-variance shock moves variable one by 2 and variable two by 1 immediately. The second moves only variable two, by 2.

Rotate by 90 degrees using $Q=\begin{pmatrix}0&-1\\1&0\end{pmatrix}$. The new factor is $LQ=\begin{pmatrix}0&-2\\2&-1\end{pmatrix}$. Its covariance remains $\Sigma$, but its first shock has a completely different impact pattern. This rotation is an algebraic demonstration, not a recommendation to identify shocks arbitrarily.

Your ledger should retain the shock definition, normalization, identifying restriction, plausible alternative, and the decision that remains defensible under that alternative. Lecture 11 turns to a different multivariate restriction: a stable long-run combination of individually integrated variables.

## Sources

[Sims (1980)](https://www.jstor.org/stable/1912017) motivates the distinction between a system's estimated dynamics and economic restrictions. The [Statsmodels impulse-response documentation](https://www.statsmodels.org/stable/generated/statsmodels.tsa.vector_ar.var_model.VARResults.irf.html) states its default Cholesky convention and covariance-factor requirement.
