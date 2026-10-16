# Advanced Econometrics draft review

Reviewed 2026-10-13. Status: draft; not activated or independently certified.

## Scope and prerequisite boundary

60 original constructed questions in six units of ten: asymptotic theory and extremum estimation; GMM and identification; likelihood and limited dependent variables; panels; time series; nonparametric and semiparametric methods. The outline specifies graduate probability/statistics, matrix algebra, multivariable calculus, optimization, convergence concepts and stochastic-process prerequisites. These are graduate theory and field extensions, not an introductory causal-design sequence.

The existing curriculum-plan entry supplied the initial scope but contained no sources. Verified university sources were added through bounded research. Their topics guided coverage; no exam questions, solutions or numerical scenarios were copied.

## Official sources opened and verified

- MIT, Chernozhukov and Newey, 14.385 Nonlinear Econometric Analysis, Fall 2007 lecture index: https://ocw.mit.edu/courses/14-385-nonlinear-econometric-analysis-fall-2007/pages/lecture-notes/ . Lists extremum asymptotics, GMM, likelihood, bootstrap, quantiles, nonlinear panels and nonparametric/semiparametric estimation.
- Wisconsin, Bruce Hansen, Econ 710 Spring 2017 syllabus: https://www.ssc.wisc.edu/~bhansen/710/710.pdf . Establishes first-year PhD scope and prerequisites; the PDF body identifies Spring 2017 despite an older metadata title.
- Wisconsin, Hansen, Econ 718 Nonparametric Econometrics: https://users.ssc.wisc.edu/~behansen/718/ . Confirms the nonparametric graduate field component.
- MIT, Anna Mikusheva, 14.384 Time Series Analysis, Fall 2013 lecture index: https://ocw.mit.edu/courses/14-384-time-series-analysis-fall-2013/pages/lecture-notes/ . Covers stationarity, HAC, VARs, unit roots, cointegration and Kalman filtering. Some linked notes retain earlier teaching-year headers; the cited index identifies the archived course offering.
- MIT, Chernozhukov and Fernandez-Val, 14.382 Spring 2017 lecture index: https://ocw.mit.edu/courses/14-382-econometrics-spring-2017/pages/lecture-notes/ . Adds explicit support for sparse-model inference, adaptive partialling out and panel exogeneity distinctions.

MIT and Wisconsin are separate R1 institutions. Source dates are historical teaching dates rather than claims about a current syllabus.

## Self-review

Read all 60 prompts, correct choices, three distractors, explanations and method hints. Checked the distinction between a theorem’s regularity conditions and the existence or identification of a parameter. Particular cases reviewed:

- Pointwise versus uniform criterion convergence; zero-derivative and boundary limits; Cauchy failure of moment-based asymptotics; sample versus root-n covariance scaling.
- Rank versus order conditions; exact identification; efficient weighting; rescaling invariance; weight-dependent pseudo-true parameters under misspecification.
- Latent scale normalization; probability mass versus density for censoring; truncation normalization; Tobit mean derivatives; quasi-likelihood score validity versus information equality.
- Timing of dynamic-panel instruments; induced negative correlation after differencing; additional system-GMM assumptions; incidental parameters and conditional logit.
- Stationarity versus invertibility; long-run covariance; nonstandard unit-root inference; cointegration; structural-shock normalization and asymmetric forecast losses.
- Nonparametric bias/variance rates; boundary polynomial reproduction; nuisance product rates; endpoint bootstrap failure; approximation bias and regularized-inference limits.

Precision edits during author review explicitly require positive scale in censored/truncated models, positive variance for the differenced-error correlation, and identity covariance normalization for structural VAR shocks. None of these edits changes a key. Censoring and truncation are separate tasks with different observation mechanisms; efficient GMM combination and variance are also separate calculations.

## Mathematical and structural verification

A separate Python pass recomputed 26 scalar quantities: sandwich and delta variances, standard-error scaling, correlated contrasts, a Newton update, a rank minor, efficient GMM weights/variance, J degrees of freedom, logit derivative, LR statistic, differenced correlation, random-effects transformation, AR variance, MA root, long-run variance, random-walk forecast MSE, error correction, forecast quantile, Kalman mean and nonparametric rate exponents. All passed at 1e-12 tolerance.

Additional checks passed: finite differences of the censored-normal mean at three distinct parameter settings match the analytical derivative; a nontrivial diagonal moment rescaling preserves the GMM criterion; the exact empirical-bootstrap probability of including the original sample maximum approaches 1−exp(−1); and the nonunique population-criterion example attains its stated maxima. These are deterministic checks of the supplied mathematical constructions, not empirical claims or universal validation of the methods.

Structural checks passed for 60 unique IDs, six units of ten, exactly three distinct distractors and one distinct correct choice, populated hints/explanations/sources, draft/constructed tags, and exact outline topic/title agreement. Exact title and prompt intersections with introductory econometrics and causal inference are empty. Coverage focuses on graduate estimator conditions and mathematical counterexamples rather than repeating introductory identification designs.

Only advanced-econometrics.json, advanced-econometrics-outline.json and this review note were written for this assignment. No runtime, activation, shared log or commit changes. Parent review and release checks remain the next gate.

## Parent review
All 60 items reviewed. Replaced u1-06 with a triangular-array Lindeberg counterexample to reduce Statistics overlap. Corrected u5-10 to specify independent mean-zero Gaussian measurement noise. Checkpoint records 36 independent scalar and conditional-likelihood checks and hashes all reviewed items. Provisional and inactive pending release integration.
