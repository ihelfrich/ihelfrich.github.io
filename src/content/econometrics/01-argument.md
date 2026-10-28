---
title: 'Estimands and identification'
order: 1
part: 'Frame'
description: 'Separate the question a dataset can answer from the question a decision requires.'
question: 'If employees who train more produce more, should the firm buy more training?'
prerequisites: 'Fractions and basic algebra. The notation bridge inside the chapter introduces the expectation, variance, covariance, independence, and normal distribution that the main argument uses.'
requires: []
minutes: 25
lab: 'worlds'
---

## Association and intervention

A firm offers optional training. Employees who take more of it tend to produce more. A manager asks whether another training hour would pay for itself.

The scatterplot answers a question about employees who chose different amounts of training. The manager asks what would happen if the firm changed an employee's training. Those questions can have different answers, including different signs.

Start by writing the target in a sentence: “The average change in next month's output if each eligible employee received one additional hour of this training, with staffing and equipment held fixed.” The intervention, population, outcome, and horizon belong in that sentence. “The effect of training” leaves all four open.

An **estimand** is the mathematical quantity corresponding to that target. An **estimator** is a rule for calculating a number from observations. An **estimate** is the number the rule produces this time. A spreadsheet can return an estimate before anybody has agreed on an estimand. That is an efficient way to answer the wrong question.

## Observationally equivalent models

<details><summary>A quick notation bridge</summary>

$E[Y]$ means the population average of $Y$. The bar in $E[Y\mid D=d]$ restricts that average to observations with $D=d$. Variance, $\operatorname{Var}(Y)$, averages the squared distance from the mean, so it measures spread in squared units. Covariance, $\operatorname{Cov}(D,Y)$, averages the product of the two variables' deviations from their means; its sign describes linear co-movement.

Two variables are independent when learning the value of one leaves the other's distribution unchanged. A standard normal variable has a bell-shaped distribution with mean zero and variance one. These ingredients keep the following thought experiment easy to calculate. Chapter 2 develops the averaging rules.

</details>

Here is a deliberately stripped-down, synthetic economy. Let $U$ denote an unobserved employee characteristic and $V$ an independent output shock. Both have mean zero and variance one; specifically, they are independent standard normal variables. Training intensity $D$ is measured relative to its mean, so a negative value means below-average intensity.

For any real number $b$, suppose the economy obeys

$$
D=U,\qquad Y=bD+(1-b)U+V.
$$

The coefficient $b$ describes the direct response to changing training while leaving the employee's underlying characteristic unchanged. Substitute the first equation into the second:

$$
Y=bU+(1-b)U+V=U+V=D+V.
$$

Every value of $b$ produces exactly the same joint distribution of observed training and output. In all these worlds,

$$
E[Y\mid D=d]=d,\qquad
\frac{\operatorname{Cov}(D,Y)}{\operatorname{Var}(D)}=1.
$$

Now intervene. The operation $\operatorname{do}(D=d)$ replaces the training equation with $D=d$. It leaves the distribution of $U,V$ and the output equation alone. Consequently,

$$
E[Y\mid \operatorname{do}(D=d)]=bd.
$$

At $b=1$, moving training from zero to one increases expected output by one unit. At $b=0$, it changes nothing. At $b=-1$, it reduces expected output by one unit. The observational regression is upward-sloping in all three cases.

## Identification

A target is **identified** within a stated model class if every model in that class consistent with the observable distribution gives the same target value. Identification is therefore a joint statement about data and restrictions. The **identified set** collects the target values of every model in the class that matches the observable distribution, so it is always taken relative to the maintained model class.

In this example, the observable distribution cannot identify $b$. An estimator is **consistent** if it converges in probability to its target as the sample grows; chapter 4 makes that convergence precise. No estimator that sees only $(D,Y)$ can consistently recover the correct $b$ in every one of these worlds. The reason is stronger than “the sample is small”: such an estimator receives data with the same distribution whichever world is true. Chapters 2 and 5 use the word in a second sense, for a causal assumption about how observed outcomes relate to the outcomes a unit would have under each treatment. That sense has nothing to do with sample size.

The [same-data experiment](/econometrics/lab/#worlds) lets you change $b$ while preserving the observed sample. Its slider runs from $-1$ to $2$ as a teaching choice. In the unrestricted construction above, every real $b$ is observationally compatible, so the identified set for $b$ is the whole real line. If the model class were restricted to $b\in[-1,2]$, the identified set would be that whole interval: the restriction would have produced it, and the observations would not narrow it.

There is plenty of variation in observed training: the normal distribution has support on the entire real line. That does not remove confounding. Conditional on $U$, training is deterministic. Even measuring $U$ would leave no within-$U$ training variation in this toy economy. A credible randomized intervention would add the variation needed to distinguish these worlds.

## Numerical check

Run this with Python and NumPy. Reusing the same shocks is essential: it shows that changing $b$ preserves every observed point, not merely a rounded correlation.

~~~python
import numpy as np

rng = np.random.default_rng(20260904)
u, v = rng.normal(size=(2, 1000))
d = u.copy()
reference = d + v

for b in (-1.0, 0.0, 1.0, 2.0):
    observed_y = b*d + (1-b)*u + v
    intervention_y = b*1.0 + (1-b)*u + v
    slope = np.polyfit(d, observed_y, 1)[0]
    print(b, np.max(np.abs(observed_y-reference)),
          round(slope, 4), round(np.mean(intervention_y), 4))
~~~

Each line prints $b$, the maximum observed-data difference, the fitted slope, and the simulated intervention mean. The maximum difference is zero up to floating-point rounding. The fitted slope is 1.0241 in every world, because every world produces the same observations. The intervention mean is close to $b$; its departures, such as 0.0762 when $b=0$, are sampling error from 1,000 draws. The slope's finite-sample departure from one is an estimation issue; its inability to reveal $b$ is an identification issue.

## Components of an empirical analysis

For each investigation, keep six linked statements:

1. **Target:** the quantity needed for the decision.
2. **Observations:** what was measured, for whom, and when.
3. **Identification:** restrictions connecting observations to the target.
4. **Estimation:** the calculation implementing that connection.
5. **Uncertainty:** sampling variation and credible departures from assumptions.
6. **Decision:** the action, costs, and threshold at which the recommendation changes.

These statements can disagree. A prediction may be excellent while a causal claim remains unidentified. A causal effect may be precisely estimated while the business case fails because implementation costs are high.

Reporting a regression coefficient as a causal effect requires an identification argument.

## Exercises

**1.** In the synthetic model, the observational mean rises by two units when $D$ rises from zero to two. What is the corresponding intervention contrast when $b=0.4$?

<details class="solution"><summary>Work through the solution</summary>

The intervention mean is $bd$, so the contrast is $0.4(2-0)=0.8$. The observational contrast is two because changing the observed value of $D$ also selects a different value of $U$. The intervention changes $D$ while retaining the population distribution of $U$.

</details>

**2.** Somebody proposes collecting a million additional observations from the same system. Which parts of the argument could improve? Which cannot?

<details class="solution"><summary>Work through the solution</summary>

The joint distribution of observed training and output can be estimated more precisely. Sampling error in its regression slope can shrink. But all values of $b$ still produce that distribution. More observations from this same process do not identify $b$. A new design, additional defensible restrictions, or a narrower target is required.

</details>

## Further reading

For an alternative introduction to causal questions, see Scott Cunningham's [Foundational Ideas in Causal Inference](https://mixtape.scunning.com/01-introduction). For the distinction between association and intervention developed through potential outcomes, see Hernán and Robins's [Causal Inference: What If](https://miguelhernan.org/whatifbook). These established frameworks inform the course; the recurring training example and its teaching sequence are original constructions.
