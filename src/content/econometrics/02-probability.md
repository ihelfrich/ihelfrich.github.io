---
title: 'Which population is inside the average?'
order: 2
part: 'Frame'
description: 'Use conditioning and expectation to diagnose changes in composition before interpreting an average.'
question: 'Why do training participants meet their targets more often?'
prerequisites: 'Fractions and the distinction between association and intervention.'
minutes: 25
---

## An average has an address

Suppose a report says that 68% of training participants meet their output target, compared with 32% of nonparticipants. Before explaining the difference, find out who is inside each denominator.

Here is a completely constructed population of 100 employees. Let $D=1$ mean participation, $E=1$ mean prior experience, and $Y=1$ mean meeting the output target. Each entry describes people, not estimated probabilities.

| Prior experience | Participation | Employees | Meet target |
| --- | --- | ---: | ---: |
| Experienced | Participate | 40 | 32 |
| Experienced | Do not participate | 10 | 8 |
| New | Participate | 10 | 2 |
| New | Do not participate | 40 | 8 |

Among experienced employees, the success rate is 80% in both participation groups. Among new employees, it is 20% in both groups. Yet participants are mostly experienced, and nonparticipants are mostly new.

The aggregate difference is 36 percentage points. Every within-experience difference is zero. This is a composition calculation; a causal interpretation will require additional assumptions.

## Conditioning changes the reference group

Imagine drawing one employee uniformly from the table. Probability describes the resulting uncertainty. For events $A$ and $B$ with $P(B)>0$,

$$
P(A\mid B)=\frac{P(A\cap B)}{P(B)}.
$$

Conditioning on participation restricts attention to the 50 participants. Forty are experienced, so $P(E=1\mid D=1)=0.8$. The probability of meeting the target is

$$
\begin{aligned}
P(Y=1\mid D=1)
&=P(Y=1\mid E=1,D=1)P(E=1\mid D=1)\\
&\quad+P(Y=1\mid E=0,D=1)P(E=0\mid D=1)\\
&=0.8(0.8)+0.2(0.2)=0.68.
\end{aligned}
$$

The same calculation for nonparticipants gives $0.8(0.2)+0.2(0.8)=0.32$. The within-group success rates are identical. The weights differ.

Probabilities with different conditioning information answer different questions. $P(E=1\mid D=1)=0.8$ says how many participants are experienced. $P(D=1\mid E=1)=0.8$ says how many experienced employees participate. They happen to agree here because both marginal group sizes are 50. That coincidence is not a general symmetry.

## Expectation is a weighted sum

For a discrete variable $Y$, expectation is

$$
E[Y]=\sum_y yP(Y=y).
$$

The expectation of a zero-one variable equals its probability of being one. Expectations of income, output, and losses use the same rule, with the outcome values included in the weighted sum. For continuous variables, integration replaces summation.

The **law of iterated expectations** says, for an integrable outcome,

$$
E[Y]=E\{E[Y\mid E]\}.
$$

Here integrable means $E[|Y|]<\infty$. In the table, half the workforce is experienced:

$$
E[Y]=0.5(0.8)+0.5(0.2)=0.5.
$$

You can also count directly: $32+8+2+8=50$ successes among 100 employees. Conditioning reorganizes the calculation without changing the overall population average, provided the outer weights are the correct population weights.

Standardizing both participation groups to a half-experienced, half-new workforce gives a success rate of 0.5 for each. Whether that standardized contrast identifies a causal effect depends on consistency, overlap, and the adequacy of experience as an adjustment variable. An identity about probabilities cannot certify those causal conditions.

## Where variation comes from

Let $m(E)=E[Y\mid E]$. If $E[Y^2]<\infty$, then

$$
\operatorname{Var}(Y)
=E\{\operatorname{Var}(Y\mid E)\}
+\operatorname{Var}\{m(E)\}.
$$

The first term is variation within experience groups. The second is variation in their conditional means. In our population, $Y$ is binary with mean 0.5, so its variance is $0.5(1-0.5)=0.25$. Within either experience group, the variance is $0.8(0.2)=0.16$. The group means lie 0.3 above or below 0.5, so their variance is $0.09$. Thus $0.25=0.16+0.09$.

<details><summary>Why the decomposition works</summary>

Write

$$
Y-E[Y]=\{Y-m(E)\}+\{m(E)-E[Y]\}.
$$

Square and take expectations. The cross term is zero because

$$
E[(Y-m(E))(m(E)-E[Y])]
=E[(m(E)-E[Y])E[Y-m(E)\mid E]]=0.
$$

The remaining two squared terms are precisely the within-group and between-group components.

This also explains why the conditional mean minimizes mean squared prediction error among functions of $E$. For any square-integrable $g(E)$,

$$
E[(Y-g(E))^2]
=E[(Y-m(E))^2]+E[(m(E)-g(E))^2].
$$

The second term cannot be negative. This is a prediction result and makes no causal claim.

</details>

## A census, a sample, and a missing employee

The table is a finite population we constructed. Its proportions are exact. If a survey samples 20 of these employees, its proportions become random because a different sample could contain different people. If the intended population is next year's workforce, even a census of these 100 employees leaves a transport question.

Now suppose experienced employees answer a follow-up survey with probability 0.8 and new employees with probability 0.2. Assuming response is independent of success within experience groups, the respondent population is 80% experienced and has a success rate of 68%. The whole eligible population still has a 50% success rate.

A million responses produced by the same selection mechanism would estimate the respondent rate with great precision. It would not turn respondents into a representative workforce.

## Check the weights yourself

~~~python
# Standard Python; all quantities describe the synthetic table.
rates = [0.8, 0.2]  # experienced, new
weights = {
    "participants": [0.8, 0.2],
    "nonparticipants": [0.2, 0.8],
    "eligible population": [0.5, 0.5],
}
for name, w in weights.items():
    print(name, sum(p*q for p, q in zip(rates, w)))
~~~

## Try it

**1.** A future workforce is 75% experienced. Keep the two group-specific success rates fixed. What success rate should you predict?

<details class="solution"><summary>Work through the solution</summary>

Use the future population weights: $0.75(0.8)+0.25(0.2)=0.65$. Using 0.5 would silently assume the old composition. Using 0.68 would silently use participant composition. Keeping the group-specific rates fixed is itself a transport assumption.

</details>

**2.** Does zero covariance between two variables establish independence?

<details class="solution"><summary>Work through the solution</summary>

No. Let $X$ be equally likely to equal $-1,0,1$ and let $Z=X^2$. Then $E[X]=0$ and $E[XZ]=E[X^3]=0$, so $\operatorname{Cov}(X,Z)=0$. But $Z$ is determined by $X$: for example, $P(Z=0\mid X=0)=1$, whereas $P(Z=0)=1/3$. A zero linear association can conceal complete nonlinear dependence.

</details>

## Read further

Blitzstein and Hwang's [Introduction to Probability](https://probabilitybook.net/) develops conditioning, expectation, and their calculations. For the econometric use of conditional expectations and projections, see Bruce Hansen's [Econometrics](https://users.ssc.wisc.edu/~behansen/econometrics/). Return to the table when the notation gets crowded: every expectation still needs an outcome and a population.
