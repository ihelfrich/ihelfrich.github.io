# Statistics for Economics draft review

Reviewed October 13, 2026. Draft status: 60 original constructed questions in six units of ten, with an aligned outline. No activation or rendered-page verification is claimed.

## Verified official university sources

- [MIT 14.30, Introduction to Statistical Methods in Economics, Spring 2009 syllabus](https://ocw.mit.edu/courses/14-30-introduction-to-statistical-methods-in-economics-spring-2009/pages/syllabus/). The official undergraduate course covers probability, sampling, estimation and hypothesis testing as preparation for econometrics. It assumes algebra and single- and multivariable calculus and does not require prior probability or statistics.
- [UC Berkeley STAT 135, Fall 2026 syllabus](https://stat135.berkeley.edu/fall-2026/syllabus.html). The official syllabus and linked topic list cover estimation, maximum likelihood, loss functions, sampling distributions, confidence intervals, large-sample likelihood theory, the delta method and bootstrap. The draft uses this as coverage provenance for inference and bridge extensions, not as a copied question source.

Both are official R1-university materials verified through live web retrieval. Source URLs on questions document curricular provenance, not evidence that hypothetical invoice rates or other constructed values occurred. The outline recommends algebra, functions, summation notation and basic single-variable calculus; probability is introduced within the course. Derivatives support the likelihood, delta-method and allocation extensions.

## Review of all 60 items

Every record has one supported answer, three distinct full-string distractors, an explanation, a method hint and draft/constructed metadata. The following records the principal item-level verification.

| Item | Review result |
|---|---|
| u1-01 | Bayes denominator includes true and false flags: 0.08/0.26=4/13. |
| u1-02 | Without replacement, one incomplete application remains among four. |
| u1-03 | Inclusion-exclusion gives 0.4+0.3−0.1=0.6. |
| u1-04 | Positive-probability disjoint events cannot satisfy independence factorization. |
| u1-05 | Foreign late payments are 0.15 of the population and 0.75 of all late payments. |
| u1-06 | State-weighted loss probability is 0.30. |
| u1-07 | The complement of two on-time deliveries gives 1−0.8²=0.36. |
| u1-08 | Conditional independence does not survive mixing here: joint probability 0.41 versus marginal product 0.25. |
| u1-09 | Multiplying prior odds by likelihood ratio gives 3:4, distinct from posterior probability 3/7. |
| u1-10 | Normalize the joint cell by B’s total probability: 0.12/0.30=0.4. |
| u2-01 | The cash-flow expectation is 4 thousand dollars, retaining level units. |
| u2-02 | Variance is 9 dollars squared and differs from standard deviation 3 dollars. |
| u2-03 | The sum variance includes twice the covariance: 4+9−2=11. |
| u2-04 | Revenue variance is 3²×4=36; a fixed addition does not affect it. |
| u2-05 | Strict Jensen inequality uses positive nondegenerate income and finite expectations. |
| u2-06 | Iterated expectations yields 35 without needing conditional variances. |
| u2-07 | Total variance is within-group 1 plus between-group 4. |
| u2-08 | Indicator linearity gives an expected count of 1 without assuming independence. |
| u2-09 | The stated lower-quantile convention includes equality at F(1)=0.7. |
| u2-10 | Symmetry makes covariance zero, but Y=X² is nonconstant deterministic dependence. |
| u3-01 | Independence and finite variance imply exact mean SD 2; normality is unnecessary. |
| u3-02 | The specified divisor-N correction gives sampling variance 3. |
| u3-03 | The classical iid finite-positive-variance CLT normalizes by σ/√n and is a limiting statement. |
| u3-04 | Convergence in probability alone specifies fixed-tolerance concentration, not a rate or finite-sample distribution. |
| u3-05 | Shared-shock variance remains: Var(mean)=4+9/n tends to 4. |
| u3-06 | Cauchy stability and undefined mean block a finite-mean LLN or usual CLT conclusion. |
| u3-07 | Pareto exponent 1.5 permits the integrable iid LLN but violates finite-variance CLT assumptions. |
| u3-08 | Population shares yield 14 rather than the equal-sample-mixture mean 20. |
| u3-09 | Trip sampling weights commuters by the number of trips they contribute. |
| u3-10 | A fixed-threshold empirical CDF is an average of Bernoulli indicators, variance 0.001875. |
| u4-01 | MSE includes squared bias: 5 for A versus 6 for B. |
| u4-02 | The permitted boundary p=0 maximizes the all-zero Bernoulli likelihood. |
| u4-03 | Exponential rate MLE is count/total exposure=0.5 per hour, not the mean wait in hours. |
| u4-04 | Uniform support rules out θ<5, and likelihood decreases for θ≥5. |
| u4-05 | Moment matching yields 14/3−4=2/3, not the n−1-corrected sample variance. |
| u4-06 | Bernoulli sample likelihood depends on successes and failures, not their ordering. |
| u4-07 | Relative likelihood needs no prior; posterior probability does. |
| u4-08 | First-order delta SE is 0.2/4=0.05, explicitly an asymptotic approximation. |
| u4-09 | Normal known-variance information 4 implies exact estimator variance 1/4 and SE 0.5. |
| u4-10 | Projecting the unconstrained normal mean −2 onto μ≥0 gives the boundary zero. |
| u5-01 | Exact one-sided binomial p-value is 1/32; no normal approximation is used. |
| u5-02 | Maximizing p⁵ over p≤0.5 gives size 0.03125, below the permitted 0.05 level. |
| u5-03 | The union bound gives at least 90% simultaneous coverage without dependence assumptions. |
| u5-04 | Exact t pivot requires iid normal sampling, n≥2 and the divisor n−1 variance; degrees of freedom are n−1. |
| u5-05 | Alternative-standardized threshold is −0.355; power is Φ(0.355)=0.638705…, rounded to 0.639. |
| u5-06 | Halving a margin proportional to n^−1/2 requires four times the sample size. |
| u5-07 | A corresponding 90% interval wholly inside prespecified margins rejects both 5% one-sided non-equivalence nulls. |
| u5-08 | Noncoverage of an inverted test set equals rejection of the true candidate, yielding at least 1−α coverage. |
| u5-09 | Repeated looks change the overall event; fixed-sample test levels alone do not control it. |
| u5-10 | Paired-difference variance is 2; averaging 25 independent pairs gives SD √2/5. |
| u6-01 | Permuting all original observations preserves the mean and cannot estimate its sampling variation. |
| u6-02 | Conditional on the sample, the empirical-resampling mean has expectation equal to the observed mean 7. |
| u6-03 | Expected distinct observations is 4[1−(3/4)⁴]=2.734375. |
| u6-04 | Resampling whole independent households preserves arbitrary within-household dependence. |
| u6-05 | Underage/overage costs imply the 0.75-quantile, stock 10; piecewise expected loss confirms it. |
| u6-06 | Posterior mean 2 minimizes squared loss; unique median 0 minimizes absolute loss. |
| u6-07 | Equal-share, equal-cost Neyman allocation follows standard deviations, giving ratio 1:2. |
| u6-08 | Budget-adjusted mean variances are 0.2 for A and 0.1 for B. |
| u6-09 | More resamples reduce Monte Carlo approximation error, not original sampling variance or frame bias. |
| u6-10 | Equal means alone do not imply raw-label exchangeability under different distributions. |

## Executed checks

The final complete validation passed schema equality with the education draft, 60 unique stable IDs, six units of ten sequential topics, exactly three nonempty string distractors, four distinct choices per item, all required prose/source fields, metadata and exact outline synchronization. It also found no exact title or prompt duplicates with intro-econometrics or causal-inference.

Forty numerical assertions passed. Eleven additional enumeration/grid/model checks passed: exhaustive four-draw bootstrap samples, exhaustive five-trial Bernoulli outcomes, four likelihood maxima on parameter grids, three decision-loss minima, exhaustive integer Neyman allocation for n=60, and the direction and nonzero floor of common-shock variance. Grid checks corroborate the accompanying analytic arguments; they are not offered as proofs of continuous optimization or limit theorems.

The first validation run exposed a mistyped high-precision reference value in the check for power (a difference of about 2.7×10⁻⁸). The normal CDF calculation gives 0.638705204383687, consistent with the question’s existing rounded 0.639. The reference value was corrected and the complete validation rerun successfully; the draft answer did not require correction.

## Scope and revisions

Compared relevant intro-econometrics and causal-inference titles and prompts. No regression slope, OLS, treatment-effect, IV, DiD or RD exercises were added. Shared inference topics use distinct cognitive tasks: exact discrete p-values and size, simultaneous coverage bounds, exact t assumptions, power under a stated alternative, equivalence and test inversion. Probability and sampling questions concern the statistical object rather than disguising another causal-estimator drill.

Parent review also corrected u1-08 from ambiguous “Both default” wording to “Each firm defaults,” so the stated 0.1 and 0.9 clearly refer to individual conditional probabilities before multiplication. The key and calculations remain unchanged.

During review, specified n≥2 for the exact t pivot and replaced a simple MLE transformation item with a first-order delta-method uncertainty item to improve bridge coverage. Rechecked outline and numerical consistency afterwards. All finite-sample results state their sampling or distributional assumptions; normal approximation, convergence and delta-method claims are explicitly distinguished. No unresolved mathematical or numerical defect identified. Human editorial approval and integration remain pending. Only this course’s three draft files were written; no runtime edits, activation, shared log entries, commits or extra agents.
