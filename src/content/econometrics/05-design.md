---
title: 'Make the comparison before the outcomes arrive'
order: 5
part: 'Identify'
description: 'Construct a randomized comparison, distinguish its estimand from uptake effects, and inspect the design threats.'
question: 'What would the firm have to randomize to learn whether training works?'
prerequisites: 'Conditional expectation, sample means, and confidence intervals.'
minutes: 30
---

## The expensive part is the comparison

A firm can buy a sophisticated analysis after collecting its data. It cannot buy back a credible control group that its implementation destroyed.

Suppose 100 employees are eligible for the same four-hour training session. Before enrollment, the firm randomly selects 50 to receive it this month; the others receive it later. Output is measured for everyone over the same following month. The intervention, eligibility rule, outcome window, and assignment mechanism have now become concrete.

Define $Y_i(1)$ as employee $i$'s output under training and $Y_i(0)$ as output without it during that window. The individual effect is $Y_i(1)-Y_i(0)$. Only one outcome is observed:

$$
Y_i=D_iY_i(1)+(1-D_i)Y_i(0),
$$

where $D_i$ indicates assigned and delivered training in this initial, perfect-compliance example.

These definitions assume that each treatment condition has a specified version and that another employee's assignment does not affect $i$'s outcome. These are the usual no-hidden-versions and no-interference components associated with SUTVA. If trained employees teach their colleagues, the second assumption is doubtful. The intervention and analysis may need to move to teams.

## Why random assignment identifies a comparison

For a population formulation, suppose

$$
D\ \perp\ (Y(1),Y(0)),\qquad 0<P(D=1)<1,
$$

and observed outcomes satisfy the consistency relation above. Then

$$
\begin{aligned}
E[Y\mid D=1]-E[Y\mid D=0]
&=E[Y(1)\mid D=1]-E[Y(0)\mid D=0]\\
&=E[Y(1)]-E[Y(0)].
\end{aligned}
$$

The first equality uses consistency. The second uses random assignment. Writing both steps makes it possible to see which part fails when training is optional.

For a fixed set of $N$ employees, complete randomization selects exactly $n_1$ for treatment and $n_0=N-n_1$ for control. The difference in observed group means,

$$
\widehat\tau=\bar Y_1-\bar Y_0,
$$

is unbiased over the randomization for the finite-population average effect

$$
\tau_N=\frac1N\sum_{i=1}^N\{Y_i(1)-Y_i(0)\}.
$$

Randomization balances the potential outcomes in expectation. It does not guarantee perfect balance in every realized assignment.

<details><summary>The exact randomization variance</summary>

Let $S_d^2$ be the finite-population variance of $Y_i(d)$, using denominator $N-1$, and let $S_\tau^2$ be the corresponding variance of individual effects. Under complete randomization,

$$
\operatorname{Var}_D(\widehat\tau)
=\frac{S_1^2}{n_1}+\frac{S_0^2}{n_0}
-\frac{S_\tau^2}{N}.
$$

The random subscript emphasizes that assignments vary while potential outcomes remain fixed. A single realized assignment reveals only one potential outcome per employee, so $S_\tau^2$ generally cannot be calculated from it without additional restrictions. The usual estimator $s_1^2/n_1+s_0^2/n_0$ has expectation at least as large as the true variance. This is a statement about conservative variance estimation, not a guarantee of exact coverage for a normal-approximation interval in a tiny experiment.

</details>

## An experiment small enough to enumerate

Consider four employees with observed outputs $(1,3,5,7)$. Exactly two were randomized to training; the employees with outputs 5 and 7 received it. The observed difference in means is $6-2=4$.

Test the **sharp null** that training affects nobody: $Y_i(1)=Y_i(0)$ for every $i$. Under that null, each employee's observed output would remain the same under any assignment. All six possible treated pairs are equally likely. Their differences in means are

$$
-4,\ -2,\ 0,\ 0,\ 2,\ 4.
$$

The exact two-sided randomization $p$-value, using absolute difference as the statistic, is $2/6=1/3$. A large observed difference can coexist with weak evidence when the design permits very few distinct comparisons.

~~~python
from itertools import combinations

y = [1, 3, 5, 7]
statistics = []
for treated in combinations(range(4), 2):
    controls = [i for i in range(4) if i not in treated]
    stat = (sum(y[i] for i in treated)/2
            - sum(y[i] for i in controls)/2)
    statistics.append(stat)

print(sorted(statistics))
print(sum(abs(t) >= 4 for t in statistics) / len(statistics))
~~~

This test targets the sharp null. A null of zero average effect permits positive and negative individual effects and does not reveal every missing potential outcome. The same enumeration cannot be carried over without justification.

## Design choices that survive implementation

**Covariates.** Measure experience before assignment. Blocking randomization by experience can improve balance. Prespecified regression adjustment can improve precision too. A useful large-sample approach includes centered baseline covariates and their treatment interactions, with appropriate robust uncertainty. It does not make finite-sample bias impossible, and a large search over adjustments compromises the advertised analysis.

**Uptake.** If some assigned employees skip training, preserve assignment in the main comparison. Randomization then identifies the effect of offering or assigning training, the intention-to-treat effect. Comparing attendees with nonattendees reintroduces selection. Moving from assignment to receipt requires additional assumptions, developed in the instruments chapter.

**Attrition.** Collect outcomes for both groups whether employees attend or not. Randomizing assignment does not randomize which outcomes go missing afterward. If disappointed participants stop reporting output, complete-case analysis can break the original comparison.

**Power.** Under an independent, equal-variance approximation, 200 people in each arm with outcome standard deviation 4 give a difference-in-means standard error of $4\sqrt{1/200+1/200}=0.4$. Approximate 80% power for a two-sided 5% test requires an effect of $(1.96+0.84)(0.4)=1.12$. Clustering, attrition, unequal allocation, and baseline adjustment alter this planning calculation.

## Try it

**1.** In the four-person example, what is the exact one-sided $p$-value for a prespecified positive-effect alternative?

<details class="solution"><summary>Work through the solution</summary>

Only one of the six assignments yields a statistic at least as large as 4, so the value is $1/6$. Choosing the direction after seeing the sign would not justify reporting this as a prespecified one-sided test.

</details>

**2.** Twenty employees were assigned treatment. Eighteen report an average outcome of 8; two outcomes are missing. Outcomes are bounded between 0 and 10. All 20 controls report an average of 7. Bound the full-assignment difference in observed group means.

<details class="solution"><summary>Work through the solution</summary>

The full treatment mean lies between $(18\cdot8+2\cdot0)/20=7.2$ and $(18\cdot8+2\cdot10)/20=8.2$. Subtracting 7 gives $[0.2,1.2]$. These bounds address the missing outcomes for this realized assignment. Randomization uncertainty about the causal average is an additional issue.

</details>

## Read further

Cunningham's [Potential Outcomes and Randomization](https://mixtape.scunning.com/04-potential_outcomes_and_randomization) develops the design-based argument. Winston Lin's [Agnostic Notes on Regression Adjustments to Experimental Data](https://arxiv.org/abs/1208.2301) supplies the formal basis and qualifications for fully interacted adjustment.
