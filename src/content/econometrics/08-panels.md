---
title: 'A comparison across time needs a counterfactual trend'
order: 8
part: 'Identify'
description: 'Derive difference-in-differences, separate fixed effects from identification, and quantify a transparent trend sensitivity.'
question: 'Would the training offices have improved even without the program?'
prerequisites: 'Potential outcomes, group means, regression, and sampling uncertainty.'
minutes: 30
lab: 'design'
---

## Two changes, one missing change

In a synthetic firm, offices adopting training increase output from 50 to 62 units per employee. Comparison offices increase from 40 to 46. The trained offices improve by 12; the comparison offices improve by 6. Difference-in-differences reports $12-6=6$.

Why subtract six? Because we are proposing that the comparison group's change describes what would have happened to the training group without training. We can observe three relevant pieces: the training group's earlier outcome, its later treated outcome, and the comparison group's change. The training group's later untreated outcome is missing.

A second date supplies a comparison over time. It does not automatically supply the missing counterfactual.

## Derive the two-by-two result

Let $G=1$ identify the group that starts treatment between dates 0 and 1; $G=0$ identifies the untreated comparison group. Let $Y_t(0)$ be an outcome without treatment and $Y_1(1)$ the treated outcome at date 1. Assume consistency, no spillovers, and no anticipation, so the training group is untreated at date 0. Its target effect is

$$
ATT=E[Y_1(1)-Y_1(0)\mid G=1].
$$

Define the observable difference-in-differences as

$$
DD=E[Y_1-Y_0\mid G=1]-E[Y_1-Y_0\mid G=0].
$$

Add and subtract $E[Y_1(0)\mid G=1]$. The result is

$$
DD=ATT+\delta,
$$

where

$$
\delta=E[Y_1(0)-Y_0(0)\mid G=1]
-E[Y_1(0)-Y_0(0)\mid G=0].
$$

**Parallel trends** sets $\delta=0$. The groups may have different initial levels. What must match is their mean untreated change over the relevant interval. The observed ten-unit baseline difference causes no algebraic difficulty.

For a panel, we also need the sample and outcome definitions to represent the intended population at both dates. A repeated cross-section can identify a similar target under appropriate stable-composition and sampling assumptions. Replacing departing workers with more productive recruits can otherwise produce an apparent training effect through composition.

## Fixed effects remove a particular kind of difference

A familiar panel regression is

$$
Y_{it}=\alpha_i+\lambda_t+\tau D_{it}+\varepsilon_{it}.
$$

$\alpha_i$ captures time-invariant unit differences, $\lambda_t$ common date effects, and $D_{it}$ treatment status. Within-unit transformations remove $\alpha_i$. They leave time-varying omitted determinants intact.

In a balanced two-group, two-date setting with the appropriate group and time indicators, the treatment-interaction coefficient equals the difference-in-differences contrast. Its causal meaning still comes from the counterfactual assumptions. In more general panels, a constant causal interpretation of $\tau$ needs additional restrictions on effects and on the relation between treatment and disturbances. Writing “unit and year fixed effects” is not a substitute for stating those restrictions.

Consider offices selected for training because management already expects their orders to recover. That expectation may cause a differential untreated trend. Neither office effects nor a common year effect removes it.

## Staggered adoption changes the comparison

When offices adopt at different dates, define $G_i=g$ as first treatment date and consider

$$
ATT(g,t)=E[Y_{it}(g)-Y_{it}(\infty)\mid G_i=g],\quad t\geq g.
$$

$Y_{it}(g)$ is the outcome under adoption at $g$; $Y_{it}(\infty)$ is the outcome under no adoption. Identification requires specifying valid untreated comparisons for each cohort and date, such as never-treated or still-untreated units, with suitable no-anticipation, parallel-trends, and overlap conditions.

A conventional two-way fixed-effects coefficient can compare newly treated units with already treated units. If effects change with exposure time or differ across cohorts, those comparisons need not recover a useful average causal effect; implied weights can be problematic. [Callaway and Sant'Anna](https://arxiv.org/abs/1803.09015) organize estimation around cohort-time effects and explicit aggregation.

Aggregation itself answers a question. Weighting each office equally, each worker equally, or each cohort equally produces different targets. State the weights and which cohort-time cells are supported by untreated comparisons.

## An event-study picture cannot certify the future

Pre-treatment outcomes can expose implausible comparisons. A visible differential pre-trend is a warning. An insignificant pre-trend test, however, may simply be imprecise. It cannot demonstrate that an unobserved post-treatment counterfactual satisfies parallel trends.

Every plotted coefficient also has a construction: reference period, comparison group, and aggregation. Modern estimators' pre-treatment coefficients need not be built symmetrically with their post-treatment effects. Check the construction before applying a familiar visual heuristic.

Inference must reflect the dependence structure. Repeated observations in an office are not independent replications of the treatment assignment. Clustered inference often matters; few assignment clusters require methods and caution suited to that design. A large employee count does not manufacture a large number of independently treated offices.

## Put the trend assumption on a scale

Suppose substantive knowledge supports $|\delta|\leq M$ output units. Since $ATT=DD-\delta$, the population sensitivity interval is

$$
ATT\in[DD-M,DD+M].
$$

At $DD=6$ and $M=4$, the interval is $[2,10]$. If each extra output unit is worth \$100 and training costs \$300 per employee, the corresponding net-benefit interval is $[-100,700]$ dollars. A positive baseline effect need not imply a decision robust to the specified trend uncertainty.

```python
# Synthetic group means and an assumed population trend bound.
treated_change = 62 - 50
comparison_change = 46 - 40
dd, M = treated_change - comparison_change, 4
effect_bounds = (dd - M, dd + M)
net_bounds = tuple(100 * effect - 300 for effect in effect_bounds)
print(dd, effect_bounds, net_bounds)  # 6 (2, 10) (-100, 700)
```

The [design experiment](/econometrics/lab/#design) exposes this calculation. Its interval excludes sampling uncertainty. It is **not an implementation of HonestDiD**. [Rambachan and Roth](https://www.jonathandroth.com/assets/files/HonestParallelTrends_Main.pdf) develop formal restrictions and inference that connect pre-treatment evidence to allowed post-treatment violations. Choosing a restriction remains substantive work.

## Try the argument

**1.** A firm's $DD$ is 6. Suppose the training offices would have improved two units more than comparison offices without training. What is $ATT$?

<details class="solution"><summary>Work through the solution</summary>

The differential untreated change is $\delta=2$. Thus $ATT=6-2=4$. The observed training-group change remains 12. Its implied untreated change is $6+2=8$, leaving a treatment effect of $12-8=4$.

</details>

**2.** Retain the \$100 value per output unit and \$300 cost. What largest symmetric trend bound guarantees nonnegative net benefit when $DD=6$, ignoring sampling uncertainty?

<details class="solution"><summary>Work through the solution</summary>

The worst permitted effect is $6-M$. Require $100(6-M)-300\geq0$, so $M\leq3$. At $M=3$, worst-case net benefit is zero. Strictly positive worst-case benefit requires $M<3$. An estimated $DD$ would introduce sampling uncertainty into a real decision.

</details>

## Read alongside this chapter

Use [The Remix](https://mixtape.scunning.com/) for extended design examples, [Callaway and Sant'Anna](https://arxiv.org/abs/1803.09015) for multiple-period targets, and [Rambachan and Roth](https://www.jonathandroth.com/assets/files/HonestParallelTrends_Main.pdf) for structured sensitivity. These address different parts of the argument; no single regression option replaces them all.
