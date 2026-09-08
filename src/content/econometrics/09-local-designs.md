---
title: 'Find the comparison the institution creates'
order: 9
part: 'Identify'
description: 'Explain what a cutoff or a synthetic comparison identifies, including the conditions that make a convincing picture insufficient.'
question: 'Does an eligibility threshold create a credible experiment near its edge?'
prerequisites: 'Conditional means, potential outcomes, local comparisons, and difference-in-differences.'
minutes: 30
---

## An administrative rule leaves a seam

A synthetic firm guarantees training to employees whose assessment score reaches 70. People scoring 69.9 and 70.1 may differ little in underlying skill, yet the rule changes their access sharply. A regression discontinuity design asks whether the outcome has a jump at that same threshold.

The argument rests on what would happen at 70 without the treatment rule. If expected untreated output changes smoothly through 70, a jump in observed output has a causal interpretation. The relevant comparison is local. Employees scoring 40 or 95 do not enter that interpretation simply because their records are available.

## The sharp discontinuity result

Let $R$ be the running variable, $c=70$ the cutoff, and $D=1\{R\geq c\}$. Potential outcomes are $Y(0)$ and $Y(1)$, with observed $Y=DY(1)+(1-D)Y(0)$. Suppose the conditional means

$$
\mu_d(r)=E[Y(d)\mid R=r],\quad d\in\{0,1\},
$$

are continuous at $c$, with observations supported on both sides. Under consistency and no interference,

$$
\lim_{r\downarrow c}E[Y\mid R=r]
-\lim_{r\uparrow c}E[Y\mid R=r]
=\mu_1(c)-\mu_0(c).
$$

The first limit approaches the threshold from above; the second approaches from below. Above the threshold we observe the treated conditional mean. Below it we observe the untreated conditional mean. Continuity carries each to the same score. Their difference is the treatment effect at the cutoff, using these continuous extensions.

Suppose those limits are 63 and 55 output units. The local effect is 8. If another benefit starts at 70, the jump may instead represent a bundle of changes. A clean-looking discontinuity cannot separate components whose assignment rules coincide.

With imperfect take-up, divide the outcome jump by the participation jump only under additional local IV assumptions, including exclusion, monotonicity, and a nonzero participation discontinuity. An outcome jump of 8 and participation jump of 0.40 give a local complier effect of 20. The target has changed from the sharp-design effect at the cutoff.

## Estimating a limit from finite data

A local linear fit on each side estimates separate intercepts at the cutoff. For a given side, minimize

$$
\sum_{i\text{ on that side}}K\!\left(\frac{R_i-c}{h}\right)
\{Y_i-a-b(R_i-c)\}^2.
$$

$K$ weights nearby observations and $h$ is the bandwidth. The estimated jump is the right intercept minus the left intercept. Separate slopes allow different local trends.

The bandwidth controls a real tradeoff. A wide neighborhood supplies more observations but may poorly approximate a curved conditional mean. A narrow neighborhood reduces approximation error but raises variance. Under suitable smoothness, density, moment, and independent-sampling conditions, local linear boundary bias is of order $h^2$, while variance is of order $1/(nh)$.

Balancing squared bias and variance gives $h$ of order $n^{-1/5}$. At that rate, bias and standard error both have order $n^{-2/5}$. Consequently, ignoring bias in a conventional interval is generally unjustified at a mean-squared-error-optimal bandwidth. Bias-aware inference, including properly constructed robust bias correction, addresses this problem. A plot with two fitted lines does not implement that inference. See [Cattaneo, Idrobo, and Titiunik's Foundations](https://arxiv.org/abs/1911.09511).

## Which story about the neighborhood?

Continuity-based RD and local-randomization RD make different commitments. Continuity-based analysis takes limits as the score approaches the cutoff. Local randomization posits a window in which assignment behaves according to a specified randomization mechanism and potential outcomes satisfy the corresponding restrictions. Selecting a narrow window does not establish random assignment within it.

Inspect score manipulation, heaping, covariate jumps, other rules at the cutoff, and sensitivity to reasonable analysis choices. A density discontinuity may undermine the institutional story; a nonsignificant density test does not prove it. Discrete scores also demand care: if only integer values are possible, one cannot observe arbitrarily close scores on either side. Extrapolation or finite-window assumptions must then be made explicit.

## When there is one treated place

A different institution may introduce training throughout one region at once, leaving no score threshold. Synthetic control constructs a comparison from untreated regions:

$$
\hat Y_{1t}(0)=\sum_{j=2}^{J+1}w_jY_{jt},
\qquad w_j\geq0,\quad\sum_jw_j=1.
$$

Weights are selected using pre-treatment information, often to approximate outcomes and predictors. Nonnegative weights summing to one make the comparison a convex combination of donors.

Consider this synthetic example:

| Region | Pre 1 | Pre 2 | Pre 3 | Post |
|---|---:|---:|---:|---:|
| Treated | 45 | 47.5 | 50 | 60 |
| Donor A | 40 | 44 | 48 | 52 |
| Donor B | 60 | 58 | 56 | 54 |

Weights 0.75 on A and 0.25 on B reproduce all three pre-treatment observations. The synthetic post-treatment outcome is 52.5, leaving a gap of 7.5.

```python
a, b = [40, 44, 48, 52], [60, 58, 56, 54]
synthetic = [0.75 * x + 0.25 * y for x, y in zip(a, b)]
print(synthetic)          # [45.0, 47.5, 50.0, 52.5]
print(60 - synthetic[-1]) # 7.5
```

Why might the comparison persist? In a factor model $Y_{it}(0)=\delta_t+\lambda_t'\mu_i+\varepsilon_{it}$, matching the treated region's factor loadings $\mu_1$ with $\sum_jw_j\mu_j$ cancels the common factor component. Let $\mathcal F_{\mathrm{pre}}$ contain the pre-treatment information used to choose the weights. For a post-treatment date, also require

$$
E\!\left[\varepsilon_{1t}-\sum_jw_j\varepsilon_{jt}
\mid\mathcal F_{\mathrm{pre}}\right]=0.
$$

Exact loading balance and this conditional restriction yield a zero expected untreated gap given the weight-selection information. Unconditional mean-zero disturbances alone are insufficient because fitted weights depend on pre-treatment outcomes. Good pre-fit may support the loading approximation. It does not prove it or rule out a new region-specific shock.

Donor contamination, spillovers, anticipation, and a post-treatment shock unique to the treated unit can all break the interpretation. Placebo comparisons are informative diagnostics; their inferential meaning depends on an exchangeability or assignment argument. [Abadie's methodological review](https://economics.mit.edu/sites/default/files/publications/jel.20191450.pdf) emphasizes feasibility and contextual requirements.

## Try the argument

**1.** Training and a cash bonus both start at score 70. Output jumps by 8 units. What does the sharp RD identify?

<details class="solution"><summary>Work through the solution</summary>

Under continuity and the other design assumptions, it identifies the local effect of eligibility for the combined intervention. It does not separately identify training's effect. Separating the components requires further variation or substantive restrictions.

</details>

**2.** Every donor's pre-treatment outcome lies below 40, while the treated region's outcome is 50. Can nonnegative weights summing to one fit that date exactly?

<details class="solution"><summary>Work through the solution</summary>

No. A convex combination cannot exceed the largest donor outcome. Exact fit would require a changed donor pool or a different model allowing extrapolation or adjustment. Such a change brings additional assumptions; it does not recover missing overlap by algebra alone.

</details>
