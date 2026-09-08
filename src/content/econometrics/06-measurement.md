---
title: 'The dataset is part of the model'
order: 6
part: 'Identify'
description: 'Trace measurement, missingness, and conditioning decisions into the estimand and its identification.'
question: 'What changes when training hours are self-reported and some output records disappear?'
prerequisites: 'Conditional expectation, regression, and potential outcomes.'
minutes: 30
---

## Open the data dictionary before the regression

The firm's records contain a column called training hours. One employee reports hours scheduled, another reports hours attended, and a third includes time practicing afterward. Output is recorded only for employees still present at the next performance review.

Those details change the problem. They define the measured exposure, determine whose outcomes enter the dataset, and may create associations that would be absent in the full workforce.

An estimator operates on the variables supplied to it. A careful measurement model explains how those variables relate to the quantities in the question.

## A derivation with a narrow scope

Suppose true, centered training intensity is $X$, but the recorded value is

$$
X^*=X+\eta.
$$

Assume the outcome obeys $Y=\beta X+\varepsilon$. Require finite second moments, $\operatorname{Var}(X)>0$, and

$$
\operatorname{Cov}(X,\varepsilon)=0,\qquad
\operatorname{Cov}(X,\eta)=0,\qquad
\operatorname{Cov}(\eta,\varepsilon)=0.
$$

These are classical-error restrictions relevant to this single-regressor linear calculation. The population regression slope using the recorded variable is

$$
\begin{aligned}
b^*
&=\frac{\operatorname{Cov}(X^*,Y)}{\operatorname{Var}(X^*)}\\
&=\frac{\beta\operatorname{Var}(X)}
{\operatorname{Var}(X)+\operatorname{Var}(\eta)}
=\lambda\beta,
\end{aligned}
$$

where $\lambda$ is the reliability ratio. Under these assumptions, $0<\lambda\le1$, so the coefficient is attenuated toward zero.

If the true effect is 2 output units per training hour, true-hour variance is 9 hours squared, and error variance is 3 hours squared, then $\lambda=9/12=0.75$ and the recorded-hours slope is 1.5.

The units help catch mistakes: the reliability ratio is dimensionless; the resulting coefficient retains output units per hour.

This result has boundaries. Correlated reporting errors can move a coefficient in either direction. With several regressors, error in one variable can distort several coefficients without a simple attenuation pattern. Independent additive noise in the outcome leaves this simple population slope unchanged, although it generally increases sampling variance. A validation sample, repeat measurements with justified error assumptions, or a defensible instrument may supply information about measurement quality.

## Missing outcomes change the population

Let $R=1$ indicate that output is observed, and let $Z$ contain fully observed baseline information. With one potentially missing outcome, useful distinctions are:

- **Missing completely at random:** $R$ is independent of both $Y$ and $Z$.
- **Missing at random given $Z$:** $R$ is independent of $Y$ conditional on $Z$.
- **Missing not at random:** response still depends on the missing outcome after conditioning on the observed information in the model.

“At random” in the second phrase does not mean every employee has the same response probability. Experience may predict response strongly. The restriction is that, within the observed information, response does not further select on the outcome.

Suppose experienced and new employees each constitute half the workforce, with target-attainment rates 0.8 and 0.2. If response rates are 0.8 and 0.2 respectively, and response is independent of attainment within experience groups, respondents are 80% experienced. Their attainment rate is 0.68; the workforce rate is 0.5.

<details><summary>Why inverse response weighting can recover the mean</summary>

Define $\pi(Z)=P(R=1\mid Z)$. Assume $R\perp Y\mid Z$, positive response probability wherever the target population has support, and integrability. Then

$$
\begin{aligned}
E\left[\frac{RY}{\pi(Z)}\right]
&=E\left[\frac{E[RY\mid Z]}{\pi(Z)}\right]\\
&=E\left[\frac{\pi(Z)E[Y\mid Z]}{\pi(Z)}\right]
=E[Y].
\end{aligned}
$$

The recorded product $RY$ contributes zero for nonrespondents, so their unobserved outcomes do not need to be filled in to implement the sample counterpart. In practice $\pi$ is often estimated, adding estimation error and model dependence. Very small response probabilities produce unstable weights.

If response depends on unobserved output within $Z$, the factorization in the second line fails. Missing-at-random assumptions generally cannot be verified from observed outcomes alone. Sensitivity analysis should vary the unresolved outcome distribution, not simply run another imputation package.

</details>

## Three reasons a variable might matter

A causal graph is an explicit proposal about how variables arise. An arrow denotes a possible direct causal relationship in the proposed model; absence of an arrow is a substantive restriction. Graphs help expose the assumptions behind a control list.

**Common cause:** $Z\to D$ and $Z\to Y$. Prior experience might influence both participation and output. Adjustment can close this confounding path, provided the selected variables are sufficient and treatment has overlap within their values.

**Mediator:** $D\to M\to Y$. Training may improve skill, which raises output. Controlling for post-training skill removes part of the pathway included in a total-effect question. The remaining coefficient does not automatically identify a direct effect; mediator–outcome confounding introduces further requirements.

**Collider:** $D\to S\leftarrow U\to Y$. Inclusion in a performance review may depend on training and latent readiness. Conditioning on review inclusion can associate randomized training with readiness.

Here is an exact collider example. Let $D$ and $U$ be independent fair zero-one variables, let $Y=U$, and include employees if $S=1$ whenever $D=1$ or $U=1$. Training has no effect on output. Among included employees with $D=0$, everyone has $U=1$, so their mean output is 1. Among included employees with $D=1$, half have $U=1$, so their mean is 0.5. The selected-sample difference is $-0.5$.

~~~python
from itertools import product

# Four equally likely types; D has no causal role in Y.
rows = [{"d": d, "y": u}
        for d, u in product((0, 1), repeat=2)
        if d == 1 or u == 1]

means = {d: sum(r["y"] for r in rows if r["d"] == d)
            / sum(r["d"] == d for r in rows)
         for d in (0, 1)}
print(means[1] - means[0])  # -0.5
~~~

## Leave an audit trail someone else can use

For each analysis variable, record its substantive definition, units, measurement window, source system, transformations, missing-value codes, and whether it precedes assignment. For each exclusion, record the rule and the number removed by treatment group. Retain raw values separately from derived fields.

Then ask a harder question: could the outcome or treatment have affected the variable used to select these rows? A clean-looking dataset can represent a badly selected comparison.

## Try it

**1.** True-hour variance remains 9, but measurement-error variance rises from 3 to 9. Under the classical assumptions above, what happens to the slope when $\beta=2$?

<details class="solution"><summary>Work through the solution</summary>

Reliability becomes $9/(9+9)=0.5$, so the slope becomes 1. The calculation applies to the stipulated classical-error model. It is not evidence that an observed coefficient should be doubled without external information about reliability.

</details>

**2.** Should a total-effect analysis of training control for an employee's post-training certification score?

<details class="solution"><summary>Work through the solution</summary>

Usually that requires changing the question or giving a specific causal argument. If training affects certification and certification affects output, the score is a mediator. Adjusting for it blocks part of the total effect. If unobserved motivation affects both certification and output, conditioning on certification can also introduce selection along a collider path. A baseline certification score has a different temporal and causal role.

</details>

## Read further

The [measurement investigation](/econometrics/measurement/) asks an earlier question: what makes an observation a measure of the thing we care about? Enter through a narrative essay, work the undergraduate examples, or examine the doctoral companion's proofs and research proposals. Its two browser experiments separate ordinal recoding, empirical uncertainty, and disagreement about values.

Rubin's [Inference and Missing Data](https://doi.org/10.1093/biomet/63.3.581) established the missingness framework. Cunningham's [Directed Acyclic Graphs](https://mixtape.scunning.com/03-directed_acyclical_graphs) and Hernán and Robins's [Causal Inference: What If](https://miguelhernan.org/whatifbook) develop graphical reasoning about selection and adjustment.
