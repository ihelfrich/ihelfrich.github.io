---
title: 'An instrument moves a choice'
order: 7
part: 'Identify'
description: 'Derive an instrumental-variables target, distinguish validity from strength, and examine what happens when exclusion fails.'
question: 'What can a randomized invitation tell us when employees choose whether to train?'
prerequisites: 'Potential outcomes, conditional means, and regression projections.'
minutes: 30
---

## An invitation is not participation

A firm randomly sends some employees an invitation to a training program. Invited employees may decline; employees without an invitation can still find a place. Comparing participants with nonparticipants reintroduces self-selection. Comparing invited with uninvited employees retains the lottery.

In a synthetic population, participation is 60% among invited employees and 20% among uninvited employees. Average output is 108 versus 100 units. The invitation raises participation by 0.40 and output by 8. Its effect on output, the **intention-to-treat effect**, answers a useful policy question on its own: what does offering this invitation accomplish?

The ratio $8/0.40=20$ has a different interpretation. Obtaining that interpretation requires an argument about how the invitation works.

## Who changes their mind?

Let $Z\in\{0,1\}$ indicate invitation, $D(z)$ indicate participation under invitation status $z$, and $Y(d)$ denote output under participation status $d$. Observed participation is $D=D(Z)$ and observed output is $Y=Y(D)$ under exclusion and consistency. The latter equality says the invitation affects output through participation alone.

The standard binary-instrument argument requires:

- **Random assignment:** $Z$ is independent of $(Y(0),Y(1),D(0),D(1))$, with both invitation states having positive probability.
- **Exclusion:** invitation has no additional effect on output, including through morale, scheduling, or alternative training.
- **Consistency and no interference:** recorded treatment corresponds to the stated intervention, and one employee's invitation or participation does not alter another employee's outcome.
- **Monotonicity:** $D(1)\geq D(0)$ for every employee. Nobody participates only when uninvited.
- **Relevance:** the invitation changes participation for a positive share of employees.

Monotonicity leaves always-participants, never-participants, and compliers. A complier participates when invited and does not participate when uninvited. Compliance is a pair of potential choices; an observed participant cannot generally be labeled a complier.

Write $\tau=Y(1)-Y(0)$. Randomization and exclusion give

$$
E[Y\mid Z=1]-E[Y\mid Z=0]
=E[(D(1)-D(0))\tau].
$$

For a binary choice, changing participation changes output by $\tau$; unchanged participation contributes zero. Similarly, the first-stage difference is $E[D(1)-D(0)]$. Under monotonicity, this difference equals the complier share. Therefore the **Wald estimand** is

$$
\frac{E[Y\mid Z=1]-E[Y\mid Z=0]}
{E[D\mid Z=1]-E[D\mid Z=0]}
=E[\tau\mid D(1)>D(0)].
$$

This is the local average treatment effect, or LATE. In the example, 40% are compliers, 20% always participate, and 40% never participate. Compliers gain 20 units on average. Effects for the other groups remain unknown. A compulsory-training policy may consequently have an effect very different from 20.

## From a ratio to moments

For a constant-coefficient model $Y=\alpha+\beta D+u$, an instrument supplies the restriction $E[Zu]=0$ along with an intercept restriction $E[u]=0$. Centering variables gives

$$
\beta=\frac{\operatorname{Cov}(Z,Y)}{\operatorname{Cov}(Z,D)}
$$

when the denominator is nonzero. This constant-effect formulation and the heterogeneous-effect LATE argument are distinct routes to an IV interpretation.

With a regressor vector $X_i$, an instrument vector $Z_i$, and parameter vector $\theta$, generalized method of moments starts from $E[Z_i(Y_i-X_i'\theta)]=0$. Define

$$
\bar g_n(\theta)=\frac1n\sum_i Z_i(Y_i-X_i'\theta),
\qquad
\hat\theta=\arg\min_\theta \bar g_n(\theta)'W_n\bar g_n(\theta).
$$

$W_n$ is a positive-definite weighting matrix. Identification requires sufficient rank in $E[Z_iX_i']$; consistency also requires valid moments, suitable sampling conditions, and convergence of the criterion. Two-stage least squares is one familiar linear implementation. Additional moments permit specification tests under further regularity conditions. Passing such a test does not establish that every instrument satisfies exclusion.

## A small denominator changes inference

Sampling noise affects both parts of a Wald ratio. When the population first stage is close to zero, the estimated denominator can approach or cross zero. A symmetric normal interval around the ratio can then behave very poorly. A large sample is helpful only relative to the weakness of the first stage.

The Anderson–Rubin idea avoids dividing by the first stage. To test $H_0:\beta=\beta_0$ in the constant-coefficient model, form $Y-\beta_0D$ and test whether the excluded instrument predicts it, including the specified exogenous controls. Under the null, the instrument should have no explanatory role. In the classical linear model with conditionally independent Gaussian homoskedastic errors, the appropriate F test has a finite-sample reference distribution. Heteroskedasticity or clustering requires a corresponding valid implementation and justification.

Collecting all unrejected values produces a confidence set that may be very wide, disconnected, or unbounded. That can be an accurate account of the information available. Neither a first-stage F rule of thumb nor an identification-robust test repairs an invalid instrument. [Andrews, Stock, and Sun's review](https://stock.scholars.harvard.edu/publications/weak-instruments-iv-regression-theory-and-practice) develops these distinctions.

## Let exclusion fail by a stated amount

Suppose the invitation also raises output directly by $\gamma$ units. In a simple additive sensitivity model,

$$
8=0.40\beta+\gamma,
\qquad \beta=\frac{8-\gamma}{0.40}.
$$

Allowing $|\gamma|\leq2$ yields $\beta\in[15,25]$. These are population sensitivity bounds under the stated model. Sampling uncertainty has not been included.

```python
# Arithmetic for the synthetic population, not estimated standard errors.
reduced_form, first_stage, direct_bound = 8, 0.40, 2
print(reduced_form / first_stage)              # 20.0
print(((reduced_form - direct_bound) / first_stage,
       (reduced_form + direct_bound) / first_stage))  # (15.0, 25.0)
```

The denominator also magnifies exclusion violations. With a 0.02 first stage, a one-unit direct effect shifts the inferred coefficient by 50 units.

## Try the argument

**1.** The same invitation effects are observed, but always-participants gain 5 units and never-participants gain 0. What is the population average treatment effect?

<details class="solution"><summary>Work through the solution</summary>

The shares are 0.20 always-participants, 0.40 compliers, and 0.40 never-participants. The supplied additional information gives $0.20(5)+0.40(20)+0.40(0)=9$ units. The instrument alone identified the complier effect of 20; the effects of 5 and 0 were new information.

</details>

**2.** An encouragement raises participation by 0.02 and output by 1 unit. Calculate the Wald ratio and its sensitivity to a direct effect of 0.5 units.

<details class="solution"><summary>Work through the solution</summary>

The ratio is $1/0.02=50$. With the specified direct effect, the adjusted value is $(1-0.5)/0.02=25$. This calculation concerns validity. Without sample information we cannot calculate sampling precision or diagnose weak-instrument severity from a test statistic.

</details>

## Read alongside this chapter

[Cunningham's IV treatment in The Remix](https://mixtape.scunning.com/) develops the compliance argument. [Hansen's Econometrics](https://users.ssc.wisc.edu/~behansen/econometrics/) supplies the formal IV/GMM framework. Keep the policy target visible when moving between them: the coefficient a design identifies may differ from the effect a decision requires.
