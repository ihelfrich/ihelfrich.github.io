---
title: 'One scatterplot, several possible worlds'
order: 1
part: 'Frame'
description: 'Separate the question a dataset can answer from the question a decision requires.'
question: 'If employees who train more produce more, should the firm buy more training?'
prerequisites: 'Words, fractions, and an interest in evidence.'
minutes: 25
lab: 'worlds'
---

## The decision hiding inside the graph

A firm offers optional training. Employees who take more of it tend to produce more. A manager asks whether another training hour would pay for itself.

The scatterplot answers a question about employees who chose different amounts of training. The manager asks what would happen if the firm changed an employee's training. Those questions can have different answers, including different signs.

Start by writing the target in a sentence: “The average change in next month's output if each eligible employee received one additional hour of this training, with staffing and equipment held fixed.” The intervention, population, outcome, and horizon belong in that sentence. “The effect of training” leaves all four open.

An **estimand** is the mathematical quantity corresponding to that target. An **estimator** is a rule for calculating a number from observations. An **estimate** is the number the rule produces this time. A spreadsheet can return an estimate before anybody has agreed on an estimand. That is an efficient way to answer the wrong question.

## Build two worlds before fitting one model

<details><summary>A quick notation bridge</summary>

$E[Y]$ means the population average of $Y$. The bar in $E[Y\mid X=x]$ restricts that average to observations with $X=x$. Variance, $\operatorname{Var}(Y)$, averages the squared distance from the mean, so it measures spread in squared units. Covariance, $\operatorname{Cov}(X,Y)$, averages the product of the two variables' deviations from their means; its sign describes linear co-movement.

Two variables are independent when learning the value of one leaves the other's distribution unchanged. A standard normal variable has a bell-shaped distribution with mean zero and variance one. These ingredients keep the following thought experiment easy to calculate. Chapter 2 develops the averaging rules.

</details>

Here is a deliberately stripped-down, synthetic economy. Let $U$ denote an unobserved employee characteristic and $V$ an independent output shock. Both have mean zero and variance one; specifically, they are independent standard normal variables. Training intensity $X$ is measured relative to its mean, so a negative value means below-average intensity.

For any real number $b$, suppose the economy obeys

$$
X=U,\qquad Y=bX+(1-b)U+V.
$$

The coefficient $b$ describes the direct response to changing training while leaving the employee's underlying characteristic unchanged. Substitute the first equation into the second:

$$
Y=bU+(1-b)U+V=U+V=X+V.
$$

Every value of $b$ produces exactly the same joint distribution of observed training and output. In all these worlds,

$$
E[Y\mid X=x]=x,\qquad
\frac{\operatorname{Cov}(X,Y)}{\operatorname{Var}(X)}=1.
$$

Now intervene. The operation $\operatorname{do}(X=x)$ replaces the training equation with $X=x$. It leaves the distribution of $U,V$ and the output equation alone. Consequently,

$$
E[Y\mid \operatorname{do}(X=x)]=bx.
$$

At $b=1$, moving training from zero to one increases expected output by one unit. At $b=0$, it changes nothing. At $b=-1$, it reduces expected output by one unit. The observational regression is upward-sloping in all three cases.

The arithmetic is simple. The important move is deciding which equation an action replaces.

## What identification actually promises

A target is **identified** within a stated model class if every model in that class consistent with the observable distribution gives the same target value. Identification is therefore a joint statement about data and restrictions.

In this example, the observable distribution cannot identify $b$. No estimator that sees only $(X,Y)$ can consistently recover the correct $b$ in every one of these worlds. The reason is stronger than “the sample is small”: such an estimator receives data with the same distribution whichever world is true.

The [same-data experiment](/econometrics/lab/#worlds) lets you change $b$ while preserving the observed sample. Its slider limits are a teaching choice. They are not a data-derived identified set. In the unrestricted construction above, every real $b$ is observationally compatible.

There is plenty of variation in observed training: the normal distribution has support on the entire real line. That does not remove confounding. Conditional on $U$, training is deterministic. Even measuring $U$ would leave no within-$U$ training variation in this toy economy. A credible randomized intervention would add the variation needed to distinguish these worlds.

## A small reproducible check

Run this with Python and NumPy. Reusing the same shocks is essential: it shows that changing $b$ preserves every observed point, not merely a rounded correlation.

~~~python
import numpy as np

rng = np.random.default_rng(20260904)
u, v = rng.normal(size=(2, 1000))
x = u.copy()
reference = x + v

for b in (-1.0, 0.0, 1.0, 2.0):
    observed_y = b*x + (1-b)*u + v
    intervention_y = b*1.0 + (1-b)*u + v
    print(b, np.max(np.abs(observed_y-reference)),
          np.mean(intervention_y))
~~~

The maximum observed-data difference is zero up to floating-point rounding. The simulated intervention mean is close to $b$, with sampling error from the finite draws. The observed fitted slope is close to one and identical across worlds. Its finite-sample departure from one is an estimation issue; its inability to reveal $b$ is an identification issue.

## Carry an argument, not just a coefficient

For each investigation, keep six linked statements:

1. **Target:** the quantity needed for the decision.
2. **Observations:** what was measured, for whom, and when.
3. **Identification:** restrictions connecting observations to the target.
4. **Estimation:** the calculation implementing that connection.
5. **Uncertainty:** sampling variation and credible departures from assumptions.
6. **Decision:** the action, costs, and threshold at which the recommendation changes.

These statements can disagree. A prediction may be excellent while a causal claim remains unidentified. A causal effect may be precisely estimated while the business case fails because implementation costs are high.

The failure to watch for is quiet substitution: reporting the coefficient that is easy to calculate as the effect somebody wanted to know.

## Try it

**1.** In the synthetic model, the observational mean rises by two units when $X$ rises from zero to two. What is the corresponding intervention contrast when $b=0.4$?

<details class="solution"><summary>Work through the solution</summary>

The intervention mean is $bx$, so the contrast is $0.4(2-0)=0.8$. The observational contrast is two because changing the observed value of $X$ also selects a different value of $U$. The intervention changes $X$ while retaining the population distribution of $U$.

</details>

**2.** Somebody proposes collecting a million additional observations from the same system. Which parts of the argument could improve? Which cannot?

<details class="solution"><summary>Work through the solution</summary>

The joint distribution of observed training and output can be estimated more precisely. Sampling error in its regression slope can shrink. But all values of $b$ still produce that distribution. More observations from this same process do not identify $b$. A new design, additional defensible restrictions, or a narrower target is required.

</details>

## Read further

For an alternative introduction to causal questions, see Scott Cunningham's [Foundational Ideas in Causal Inference](https://mixtape.scunning.com/01-introduction). For the distinction between association and intervention developed through potential outcomes, see Hernán and Robins's [Causal Inference: What If](https://miguelhernan.org/whatifbook). These established frameworks inform the course; the recurring training example and its teaching sequence are original constructions.
