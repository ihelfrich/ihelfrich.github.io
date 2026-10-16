# Empirical Macroeconomics draft review

Reviewed 2026-10-13. Status: draft, not activated or independently certified.

## Scope and sources

60 original constructed questions, six units of ten: macroeconomic data and vintages; structural identification; VAR/local projections; forecast evaluation; state-space methods and nowcasting; policy evidence. Prerequisites distinguish an advanced undergraduate methods bridge from graduate extensions and require macroeconomics, econometrics, matrix algebra, probability, time-series dependence and basic dynamic-model notation.

Started from the curriculum-plan entry for Empirical Macroeconomics and Monetary History. Official courses from two R1 institutions were opened and verified:

- Berkeley, Christina and David Romer, Economics 210c/236a Monetary History, Fall 2008: https://eml.berkeley.edu/~webfac/cromer/e210c_f08/e210c.shtml . The course lists VARs, narrative identification, monetary policy, credit, inflation persistence, fiscal effects and financial panics. Some archive navigation includes server-side errors, but the course identity and topic list were readable.
- MIT, Anna Mikusheva, 14.384 Time Series Analysis, Fall 2013: https://ocw.mit.edu/courses/14-384-time-series-analysis-fall-2013/pages/lecture-notes/ . Lists VARs, structural identification, factor models, state-space methods, filtering and related inference.
- Additional MIT-hosted primary research, Montiel Olea, Plagborg-Møller, Qian and Wolf, Local Projections or VARs? A Primer for Macroeconomists (March 2025): https://economics.mit.edu/sites/default/files/2025-03/lp_var_primer.pdf . Informs the estimator-versus-estimand and dynamic-approximation distinctions.

Measurement checks used primary data-producer documentation:

- Philadelphia Fed real-time data research: https://www.philadelphiafed.org/surveys-and-data/real-time-data-research . Confirms the role of vintages and macro forecast data.
- BEA quarterly annualization: https://www.bea.gov/help/faq/122 . States the compound quarterly-to-annual convention.
- BEA chain-index use: https://www.bea.gov/help/faq/79 and the explicit nonadditivity note in https://apps.bea.gov/scb/issues/2020/08-august/0820-nipa-update.htm . Supports distinguishing real component levels from additive nominal accounting.

Sources guide topic coverage and conventions. Questions and numerical scenarios are original. No invented historical findings or claims about the effectiveness of an actual policy episode are presented.

## Review and repairs

Self-reviewed all 60 prompts, correct choices, three distractors, explanations and method hints for assumptions, unique answers and useful distinctions.

- Incorporated parent correction to the chain-volume question: the prompt now includes all expenditure components, including exports less imports, so nonadditivity is not confused with an incomplete accounting identity.
- Incorporated parent correction to posterior variance: the measurement disturbance is explicitly independent mean-zero Gaussian noise. Independent noise with a stated variance alone would not establish that posterior result.
- Replaced a near-duplicate second-step VAR multiplication with an identified-shock forecast-error variance share calculation, specifying unit variances and orthogonal innovations.
- Separated quarterly flows, annual-rate levels, annualized growth rates, percentage points and percentage changes relative to different baselines.
- Stated identification assumptions for proxy ratios, LP responses, announcement signals, variance-regime identification and counterfactual policy rules.
- Distinguished filtration from smoothing, observed-data revisions from latent-state revisions, and information timing from observation timing.
- Reviewed pointwise versus simultaneous uncertainty, normalization uncertainty, overlapping forecast losses and exploratory horizon selection without claiming a universal inference recipe.

## Verification

A separate Python arithmetic pass checked 19 numerical quantities: vintage-dependent errors, compounding, annual-rate conversion, revised ratios, proxy normalization, VAR propagation, FEVD share, accumulated growth responses, forecast-combination variance and optimal weight, local-level Q/R recovery, posterior and prediction variances, conditional nowcast news, and both fiscal multiplier calculations. All passed at 1e-12 tolerance against unrounded expected values.

Additional deterministic model checks verified the forecast-combination optimum using finite differences and nearby alternatives, the negative revision covariance in an independent finite-support noise model, the Gaussian posterior-variance identity and FEVD shares summing to one. These validate the supplied constructed models, not empirical claims about the economy.

Structural checks passed: 60 unique IDs, six units of ten, exactly three distinct distractors plus a distinct key, populated hints/explanations/source fields, draft/constructed tags, and exact outline topic/title agreement. Exact title and prompt checks against advanced econometrics, advanced macroeconomics, introductory econometrics and causal inference returned no matches. Related foundations are applied to macro research questions rather than repeating the other banks’ derivations.

Only empirical-macroeconomics.json, empirical-macroeconomics-outline.json and this note were written for this assignment. No activation, runtime, shared log or commit changes. Parent review and release checks remain the next gate.
