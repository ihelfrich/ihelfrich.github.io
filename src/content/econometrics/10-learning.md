---
title: 'Let prediction help estimation without choosing the question'
order: 10
part: 'Generalize'
description: 'Derive an orthogonal partial-linear score and understand the role and limits of sample splitting and nuisance learning.'
question: 'Can flexible prediction estimate a training effect without absorbing the effect we want?'
prerequisites: 'Projection, conditional expectation, exogeneity, and asymptotic inference.'
minutes: 35
---

## A good prediction can answer the wrong question

A model predicts employee output extremely well from past performance, job role, manager ratings, and training participation. That may help staffing. It does not establish what would happen if the firm changed training assignments.

Prediction evaluates a forecast against an observed outcome under a stated data distribution and loss. Causal estimation needs a target and identifying restrictions. Flexible learning is valuable within that argument: it can estimate complicated conditional relationships that would be difficult to specify by hand. It cannot supply missing randomization or remove unmeasured confounding by predictive accuracy alone.

## Protect the evaluation before choosing the model

For squared-error prediction, define risk as $E[(Y-\hat f(X))^2]$ for a new observation and the specified training procedure. More flexibility can reduce approximation bias while increasing estimation variability. The direction of the net change is an empirical question for honest evaluation.

Use training data to fit, validation data to select, and untouched evaluation data to estimate performance. Preprocessing, feature selection, and tuning belong inside the appropriate training split. Looking repeatedly at the final holdout and changing the model spends its independence. Split by the unit of dependence and by time when the deployment task requires it.

For causal work, excluding post-treatment variables and information unavailable at the decision date comes before a prediction contest.

## A partial-linear target

Consider independent observations $W=(Y,D,X)$ satisfying

$$
Y=\theta_0D+g_0(X)+\varepsilon,
\qquad E[\varepsilon\mid D,X]=0,
$$

where $D$ is training dose, $X$ contains pre-treatment covariates, and $\theta_0$ is a constant partial-linear coefficient. For a causal interpretation, the conditional mean restriction and structural interpretation must be credible, including the absence of relevant unmeasured confounding. This model is restrictive; arbitrary heterogeneous effects need different target definitions.

Define $m_0(X)=E[D\mid X]$, $\ell_0(X)=E[Y\mid X]$, and $V=D-m_0(X)$. Iterated expectations imply $\ell_0=\theta_0m_0+g_0$, hence

$$
Y-\ell_0(X)=\theta_0V+\varepsilon.
$$

If $J=E[V^2]>0$, multiplying by $V$ and taking expectations identifies $\theta_0$. Covariates may predict much of training, but some residual treatment variation must remain.

## Why the score is orthogonal

Use the residual-on-residual score

$$
\psi(W;\theta,\ell,m)
=(D-m(X))\{Y-\ell(X)-\theta(D-m(X))\}.
$$

At the true functions and coefficient, $\psi=V\varepsilon$, with mean zero. Now perturb the nuisance functions along fixed square-integrable directions: $\ell_t=\ell_0+ta$ and $m_t=m_0+tb$. At $\theta_0$,

$$
\psi_t=(V-tb)\{\varepsilon-ta+\theta_0tb\}.
$$

Differentiate its expectation at zero:

$$
\left.\frac{dE[\psi_t]}{dt}\right|_{t=0}
=E[-b\varepsilon-Va+\theta_0Vb]=0.
$$

Each term vanishes because $E[\varepsilon\mid X]=0$ and $E[V\mid X]=0$. This is Neyman orthogonality: small nuisance errors have no first-order effect on the population moment at the truth. It is a local insensitivity result, not immunity to arbitrary model errors.

## What error remains?

Let $a=\hat\ell-\ell_0$ and $b=\hat m-m_0$ be nuisance errors trained on independent data. The same expansion gives the exact conditional population drift

$$
E[\psi(W;\theta_0,\hat\ell,\hat m)]
=E[ab]-\theta_0E[b^2].
$$

By Cauchy–Schwarz, its magnitude is bounded by

$$
\|a\|_2\|b\|_2+|\theta_0|\|b\|_2^2,
$$

where $\|f\|_2=(E[f(X)^2])^{1/2}$. Sufficient rate conditions make both terms $o_p(n^{-1/2})$. Taking both nuisance errors to be $o_p(n^{-1/4})$ suffices; other combinations are possible provided the product **and the squared treatment-model error** satisfy the condition. This parameterization should not be silently exchanged for a score using the structural function $g_0$.

Together with nuisance consistency, suitable moments and sampling conditions, and $J$ bounded away from zero, these restrictions support asymptotically linear inference. Orthogonality alone is insufficient.

## Cross-fit, then estimate

Partition observations into a fixed number of folds. For every fold, estimate $\ell$ and $m$ using the other folds and predict the held-out observations. Let $\tilde Y_i=Y_i-\hat\ell_{-k(i)}(X_i)$ and $\tilde D_i=D_i-\hat m_{-k(i)}(X_i)$. Pool the held-out residuals:

$$
\hat\theta=\frac{\sum_i\tilde D_i\tilde Y_i}{\sum_i\tilde D_i^2}.
$$

Cross-fitting limits own-observation overfitting bias while reusing data. Under the required conditions,

$$
\sqrt n(\hat\theta-\theta_0)
=\frac{1}{\sqrt n}\sum_i\frac{V_i\varepsilon_i}{J}+o_p(1).
$$

The asymptotic variance is $E[V^2\varepsilon^2]/J^2$. A corresponding standard-error estimate is

$$
\widehat{SE}^2=\frac{n^{-1}\sum_i\hat\psi_i^2}{n\hat J^2},
\quad \hat J=n^{-1}\sum_i\tilde D_i^2,
\quad \hat\psi_i=\tilde D_i(\tilde Y_i-\hat\theta\tilde D_i).
$$

Dependence or clustered assignment needs an appropriate extension. None of these calculations measures uncertainty from omitted confounding.

## A small calculation, and its limits

Suppose held-out residuals in a synthetic example are $\tilde D=(-2,-1,1,2)$ and $\tilde Y=(-5,-1,2,4)$. Their cross-product sums to 21 and squared treatment residuals sum to 10, so $\hat\theta=2.1$.

```python
d, y = [-2, -1, 1, 2], [-5, -1, 2, 4]
theta = sum(a * b for a, b in zip(d, y)) / sum(a * a for a in d)
print(theta)  # 2.1
```

This demonstrates the final residual regression, not a complete DML analysis. Four supplied residual pairs do not establish nuisance quality, asymptotic precision, or causal validity.

## Try the argument

**1.** Suppose $\|a\|_2$ has order $n^{-0.3}$ and $\|b\|_2$ has order $n^{-0.2}$. Do the displayed sufficient remainder conditions follow?

<details class="solution"><summary>Work through the solution</summary>

No. Their product has order $n^{-0.5}$, which alone does not give the required little-o rate. More importantly, $\|b\|_2^2$ has order $n^{-0.4}$, generally too slow when $\theta_0\ne0$. Faster treatment-model learning or a different valid construction is needed.

</details>

**2.** Managers use unrecorded motivation to select training. Cross-fitted output prediction is excellent. Which identifying condition remains doubtful?

<details class="solution"><summary>Work through the solution</summary>

If motivation affects output beyond recorded $X$, the disturbance may satisfy $E[\varepsilon\mid D,X]\ne0$. Cross-fitting cannot make that conditional mean restriction true. Seek additional design information, a valid instrument, sensitivity analysis, or a more limited predictive claim.

</details>

## Read alongside this chapter

[Chernozhukov and coauthors' original DML paper](https://economics.mit.edu/research/publications/doubledebiased-machine-learning-treatment-and-structural-parameters) provides the framework and regularity conditions. [Ahrens and coauthors' introduction](https://arxiv.org/abs/2504.08324), revised in February 2026, is a current explanatory companion to this established methodology.
