---
title: 'What a fitted line has actually earned'
order: 3
part: 'Estimate'
description: 'Derive least squares, interpret residualization, and distinguish a projection coefficient from a causal effect.'
question: 'What changes when experience enters the training regression?'
prerequisites: 'Algebra and averages; optional derivations use derivatives and matrices.'
minutes: 30
---

## First, account for what the calculation does

Least squares chooses coefficients to make squared residuals as small as possible. It does not inspect the hiring process, interview the training manager, or determine which variables preceded treatment. Those jobs remain ours.

The six-person example below can be followed with averages and arithmetic. The derivative and matrix steps explain why its calculation generalizes; readers new to those tools can return to them after working through the numbers.

For observations $(x_i,y_i)$, a regression with an intercept chooses $a,b$ to minimize

$$
\sum_{i=1}^n(y_i-a-bx_i)^2.
$$

Differentiate with respect to $a$ and $b$. At the optimum,

$$
\sum_i \widehat u_i=0,\qquad
\sum_i x_i\widehat u_i=0,
\quad\text{where }\widehat u_i=y_i-\widehat a-\widehat b x_i.
$$

The first equation gives $\widehat a=\bar y-\widehat b\bar x$. Substituting it into the second gives

$$
\widehat b=
\frac{\sum_i(x_i-\bar x)(y_i-\bar y)}
{\sum_i(x_i-\bar x)^2},
$$

provided training varies in the sample. These residual properties follow from the optimization. They cannot serve as evidence that the error in a causal model is unrelated to training.

## A six-person example

All numbers below are synthetic. Here $x$ is training hours, $z$ indicates prior experience, and $y$ is output in arbitrary units.

| Employee | Training $x$ | Experience $z$ | Output $y$ |
| --- | ---: | ---: | ---: |
| A | 0 | 0 | 1 |
| B | 1 | 0 | 0 |
| C | 2 | 0 | 5 |
| D | 2 | 1 | 8 |
| E | 3 | 1 | 7 |
| F | 4 | 1 | 12 |

The overall means are $\bar x=2$ and $\bar y=5.5$. The centered cross-product is 29 and the centered training sum of squares is 10. Regressing output on training alone produces a slope of $2.9$.

Now remove each experience group's mean from both variables. The group training means are 1 and 3; output means are 2 and 9. The residualized observations are

$$
\widetilde x=(-1,0,1,-1,0,1),\qquad
\widetilde y=(-1,-2,3,-1,-2,3).
$$

Their cross-product is 8 and the training sum of squares is 4. The adjusted slope is $8/4=2$.

This is the training coefficient from regressing output jointly on an intercept, training, and experience. Residualizing makes the comparison visible: within each experience group, how do deviations in training line up with deviations in output?

## The general projection

Put the outcome in an $n$-vector $\mathbf y$ and the regressors, including any intercept, in an $n\times k$ matrix $\mathbf X$. If $\mathbf X$ has full column rank,

$$
\widehat{\boldsymbol\beta}
=(\mathbf X'\mathbf X)^{-1}\mathbf X'\mathbf y,\qquad
\mathbf X'\widehat{\mathbf u}=0.
$$

The fitted vector lies in the space spanned by the columns of $\mathbf X$. The residual is perpendicular to that space. Adding a regressor enlarges the available space, so in-sample squared error cannot increase. This says nothing by itself about prediction on new data.

In a population, let $\mathbf x$ be a random $k$-vector. With finite second moments and nonsingular $Q=E[\mathbf x\mathbf x']$, the best linear predictor minimizes $E[(Y-\mathbf x'\boldsymbol\beta)^2]$ and satisfies

$$
\boldsymbol\beta=Q^{-1}E[\mathbf xY],\qquad
E[\mathbf xu]=0.
$$

The conditional mean $E[Y\mid\mathbf x]$ may still be nonlinear. Orthogonality to the chosen regressors is weaker than $E[u\mid\mathbf x]=0$.

<details><summary>The residualization theorem</summary>

Partition the design into a variable of interest $\mathbf d$ and controls $\mathbf W$, including an intercept if needed. Define

$$
M_W=I-\mathbf W(\mathbf W'\mathbf W)^{-1}\mathbf W'.
$$

Assume $\mathbf W$ has full rank and $\mathbf d'M_W\mathbf d>0$. For a proposed coefficient $b$ on $\mathbf d$, fitting the controls leaves residual $M_W(\mathbf y-\mathbf d b)$. Minimizing its squared length gives

$$
\widehat b=\frac{\mathbf d'M_W\mathbf y}{\mathbf d'M_W\mathbf d}.
$$

Since $M_W$ is symmetric and idempotent, this is the regression of residualized $\mathbf y$ on residualized $\mathbf d$. This algebraic result is the Frisch–Waugh–Lovell theorem. It requires no causal assumptions.

</details>

## Where an omitted variable enters

Suppose a substantive model is

$$
Y=\alpha+\beta X+\gamma Z+\varepsilon,
\qquad \operatorname{Cov}(X,\varepsilon)=0.
$$

Then the population slope from omitting $Z$ is

$$
b_{\mathrm{short}}
=\frac{\operatorname{Cov}(X,Y)}{\operatorname{Var}(X)}
=\beta+\gamma
\frac{\operatorname{Cov}(X,Z)}{\operatorname{Var}(X)}.
$$

The extra term requires both an output relationship and a training relationship for $Z$. In the six-person construction, $y=2x+3z+e$ with $e=(1,-2,1,1,-2,1)$. The residual vector has zero sample covariance with $x$ and $z$. The short slope is therefore exactly $2+3(3/10)=2.9$.

Knowing the construction lets us interpret the coefficient. With actual company records, that construction is unknown. Experience may be insufficient to address self-selection. A variable measured after training may be a mediator or a collider. More controls do not automatically produce a better causal argument.

## Reproduce the adjustment

~~~python
# Standard Python.
x = [0, 1, 2, 2, 3, 4]
z = [0, 0, 0, 1, 1, 1]
y = [1, 0, 5, 8, 7, 12]

def demean_by_group(values):
    means = {
        g: sum(v for v, h in zip(values, z) if h == g)
           / z.count(g)
        for g in set(z)
    }
    return [v-means[g] for v, g in zip(values, z)]

rx, ry = demean_by_group(x), demean_by_group(y)
print(sum(a*b for a, b in zip(rx, ry))
      / sum(a*a for a in rx))  # 2.0
~~~

## Try it

**1.** Does a regression fitted without an intercept necessarily have residuals that sum to zero?

<details class="solution"><summary>Work through the solution</summary>

No. Residuals are orthogonal to the included columns. Without a constant column, orthogonality to the vector of ones is not generally imposed. For example, fitting $y=bx$ to $x=(1,2)$ and $y=(1,1)$ gives $\widehat b=3/5$ and residuals $(0.4,-0.2)$, which sum to 0.2.

</details>

**2.** Let $X$ be uniform on $[-1,1]$ and $Y=X^2$. What does the population linear projection with an intercept predict? Is its residual conditionally mean zero?

<details class="solution"><summary>Work through the solution</summary>

Symmetry gives $E[X]=E[X^3]=0$, so the slope is zero. The intercept is $E[X^2]=1/3$. The residual is $u=X^2-1/3$, with $E[u]=E[Xu]=0$. But $E[u\mid X]=X^2-1/3$, generally nonzero. The projection is the best available straight line, although the conditional mean is a curve.

</details>

## Read further

Bruce Hansen's [Econometrics](https://users.ssc.wisc.edu/~behansen/econometrics/) develops population projection, least squares, and their sampling theory. Angrist and Pischke's [Mostly Harmless Econometrics resources](https://economics.mit.edu/people/faculty/josh-angrist/mhe-data-archive) provide a route from regression arguments to inspectable empirical applications.
