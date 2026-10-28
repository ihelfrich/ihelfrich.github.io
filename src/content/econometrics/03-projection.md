---
title: 'Least squares and projection'
order: 3
part: 'Estimate'
description: 'Derive least squares, interpret residualization, and distinguish a projection coefficient from a causal effect.'
question: 'What changes when experience enters the training regression?'
prerequisites: 'Averages, basic algebra, and expectation and conditional expectation (chapters 1 and 2). Optional derivations use derivatives and matrices.'
requires: [2]
minutes: 30
---

## Least squares

Least squares minimizes the sum of squared residuals. Interpreting the fitted coefficients requires assumptions about how the data were generated.

The six-person example below can be followed with averages and arithmetic. The derivative and matrix steps explain why its calculation generalizes; readers new to those tools can return to them after working through the numbers.

For observations $(d_i,y_i)$, a regression with an intercept chooses $a,b$ to minimize

$$
\sum_{i=1}^n(y_i-a-bd_i)^2.
$$

Differentiate with respect to $a$ and $b$. At the optimum,

$$
\begin{gathered}
\sum_i \widehat u_i=0,\qquad
\sum_i d_i\widehat u_i=0,\\
\text{where }\widehat u_i=y_i-\widehat a-\widehat b d_i.
\end{gathered}
$$

The first equation gives $\widehat a=\bar y-\widehat b\bar d$. Substituting it into the second gives

$$
\widehat b=
\frac{\sum_i(d_i-\bar d)(y_i-\bar y)}
{\sum_i(d_i-\bar d)^2},
$$

provided training varies in the sample. These residual properties follow from the optimization. They cannot serve as evidence that the error in a causal model is unrelated to training. The [exogeneity panel](/teaching/ols-assumptions/#a3-exogeneity) of the OLS assumptions lab simulates the slope when the error is correlated with the regressor.

## A six-person example

All numbers below are synthetic. Here $d$ is training hours, $k$ indicates prior experience, and $y$ is output in arbitrary units.

| Employee | Training $d$ | Experience $k$ | Output $y$ |
| --- | ---: | ---: | ---: |
| A | 0 | 0 | 1 |
| B | 1 | 0 | 0 |
| C | 2 | 0 | 5 |
| D | 2 | 1 | 8 |
| E | 3 | 1 | 7 |
| F | 4 | 1 | 12 |

The overall means are $\bar d=2$ and $\bar y=5.5$. The centered cross-product is 29 and the centered training sum of squares is 10. Regressing output on training alone produces a slope of $2.9$.

Now remove each experience group's mean from both variables. The group training means are 1 and 3; output means are 2 and 9. The residualized observations are

$$
\begin{gathered}
\widetilde d=(-1,0,1,-1,0,1),\\
\widetilde y=(-1,-2,3,-1,-2,3).
\end{gathered}
$$

Their cross-product is 8 and the training sum of squares is 4. The adjusted slope is $8/4=2$.

This is the training coefficient from regressing output jointly on an intercept, training, and experience. Residualizing makes the comparison visible: within each experience group, how do deviations in training line up with deviations in output?

## The general projection

Put the outcome in an $n$-vector $\mathbf y$ and the regressors, including any intercept, in an $n\times p$ matrix $\mathbf X$. If $\mathbf X$ has full column rank,

$$
\widehat{\boldsymbol\beta}
=(\mathbf X'\mathbf X)^{-1}\mathbf X'\mathbf y,\qquad
\mathbf X'\widehat{\mathbf u}=0.
$$

The fitted vector lies in the space spanned by the columns of $\mathbf X$. The residual is perpendicular to that space. Adding a regressor enlarges the available space, so in-sample squared error cannot increase. This says nothing by itself about prediction on new data.

In a population, let $\mathbf x$ be a random $p$-vector. With finite second moments and nonsingular $Q=E[\mathbf x\mathbf x']$, the best linear predictor minimizes $E[(Y-\mathbf x'\boldsymbol\beta)^2]$ and satisfies

$$
\boldsymbol\beta=Q^{-1}E[\mathbf xY],\qquad
E[\mathbf xu]=0.
$$

The conditional mean $E[Y\mid\mathbf x]$ may still be nonlinear. Orthogonality to the chosen regressors is weaker than $E[u\mid\mathbf x]=0$.

The [OLS assumptions lab](/teaching/ols-assumptions/) simulates each classical assumption separately. Its [correct-specification panel](/teaching/ols-assumptions/#a1-specification) fits a straight line to a curved conditional mean, and its [collinearity panel](/teaching/ols-assumptions/#a6-collinearity) shows what happens to the coefficients as the full-rank condition above nearly fails.

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
\begin{gathered}
Y=\alpha+\beta D+\gamma K+\varepsilon,\\
\operatorname{Cov}(D,\varepsilon)=0.
\end{gathered}
$$

Then the population slope from omitting $K$ is

$$
b_{\mathrm{short}}
=\frac{\operatorname{Cov}(D,Y)}{\operatorname{Var}(D)}
=\beta+\gamma
\frac{\operatorname{Cov}(D,K)}{\operatorname{Var}(D)}.
$$

The extra term requires both an output relationship and a training relationship for $K$. In the six-person construction, $y=2d+3k+e$ with $e=(1,-2,1,1,-2,1)$. The residual vector has zero sample covariance with $d$ and $k$. The short slope is therefore exactly $2+3(3/10)=2.9$.

Knowing the construction lets us interpret the coefficient. With actual company records, that construction is unknown. Experience may be insufficient to address self-selection. A variable measured after training may be a **mediator**, which carries part of training's effect to output, or a **collider**, which is caused both by training and by something else that affects output. Chapter 6 shows how adjusting for either changes the comparison. More controls do not automatically produce a better causal argument.

## Reproduce the adjustment

~~~python
# Standard Python.
d = [0, 1, 2, 2, 3, 4]
k = [0, 0, 0, 1, 1, 1]
y = [1, 0, 5, 8, 7, 12]

def demean_by_group(values):
    means = {
        g: sum(v for v, h in zip(values, k) if h == g)
           / k.count(g)
        for g in set(k)
    }
    return [v-means[g] for v, g in zip(values, k)]

rd, ry = demean_by_group(d), demean_by_group(y)
print(sum(a*b for a, b in zip(rd, ry))
      / sum(a*a for a in rd))  # 2.0
~~~

## Exercises

**1.** Does a regression fitted without an intercept necessarily have residuals that sum to zero?

<details class="solution"><summary>Work through the solution</summary>

No. Residuals are orthogonal to the included columns. Without a constant column, orthogonality to the vector of ones is not generally imposed. For example, fitting $y=bx$ to $x=(1,2)$ and $y=(1,1)$ gives $\widehat b=3/5$ and residuals $(0.4,-0.2)$, which sum to 0.2.

</details>

**2.** Let $X$ be uniform on $[-1,1]$ and $Y=X^2$. What does the population linear projection with an intercept predict? Is its residual conditionally mean zero?

<details class="solution"><summary>Work through the solution</summary>

Symmetry gives $E[X]=E[X^3]=0$, so the slope is zero. The intercept is $E[X^2]=1/3$. The residual is $u=X^2-1/3$, with $E[u]=E[Xu]=0$. But $E[u\mid X]=X^2-1/3$, generally nonzero. The projection is the best available straight line, although the conditional mean is a curve.

</details>

## Further reading

Bruce Hansen's [Econometrics](https://users.ssc.wisc.edu/~behansen/econometrics/) develops population projection, least squares, and their sampling theory. Angrist and Pischke's [Mostly Harmless Econometrics resources](https://economics.mit.edu/people/faculty/josh-angrist/mhe-data-archive) provide a route from regression arguments to inspectable empirical applications.
