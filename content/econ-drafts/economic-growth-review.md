# Economic Growth draft review

Reviewed 2026-10-13. Status: draft, not activated or independently certified.

## Scope and prerequisites

60 original constructed questions in six units of ten: growth accounting; convergence and transitions; human capital and spillovers; innovation, varieties and quality ladders; distribution and misallocation; institutions and empirical growth.

The outline distinguishes an advanced undergraduate base (intermediate micro/macro, calculus, logarithms, probability and introductory econometrics) from scaffolded graduate extensions involving patent valuation, semi-endogenous growth, allocation wedges and dynamic panels. Continuous-time equations are supplied. The course does not reproduce Ramsey Euler equations, OLG steady states or the development bank’s poverty, household-credit and program-evaluation exercises.

## Verified official sources

Started with the growth entries in src/data/economics-curriculum-plan.json and opened the following university materials:

- MIT, Daron Acemoglu, 14.452 Introduction to Economic Growth, Fall 2025: https://economics.mit.edu/sites/default/files/inline-files/syllabus_Fall_2025.pdf . Guides the progression from accounting and convergence to human capital, innovation, distribution and fundamental causes.
- MIT OCW, Macroeconomic Theory I, Spring 2007 syllabus: https://ocw.mit.edu/courses/14-451-macroeconomic-theory-i-spring-2007/pages/syllabus/ . Cross-check for the curriculum source and mathematical track.
- Stanford, Chad Jones and Pete Klenow, MgtEcon 610/Econ 233 Economic Growth, Fall 2024: https://web.stanford.edu/~chadj/PhDGrowth2024.pdf . Guides the selected extensions on research productivity, misallocation, task allocation, talent and diffusion. The www host timed out; the canonical web.stanford.edu URL opened successfully.

MIT and Stanford are separate R1 universities. Their materials establish topic coverage, not copied wording, numerical exercises or unverified contemporary empirical claims. Every scenario in this bank is hypothetical.

## Self-review and corrections

Read all 60 prompts, answer keys, three distractors, explanations and method hints. Reviewed assumptions, timing, units, existence conditions and whether any distractor could also be correct.

- Incorporated parent review precision edits: the fixed capital-measurement-error item explicitly assumes 0<α<1, and the Solow saving comparative-static item states n+δ>0.
- Distinguished exact compound changes, log changes and instantaneous continuous-time rates. In particular, quality-ladder expected log growth uses λ ln γ rather than the expected level-growth formula.
- Patent valuation includes both discounting and displacement hazard; the research-entry item values a probability-weighted immediate prize rather than treating expected success as certain.
- The semi-endogenous questions distinguish researcher levels from researcher growth and state φ<1. The CES supply exercise holds technology fixed.
- Replaced an internal duplicate of the level-versus-growth-effect distinction with a new identification exercise on common frontier variables and unrestricted year effects.
- Clarified the human-capital depreciation symbol as δ_h to avoid confusing it with multiplication by h.
- Checked misallocation and institution questions for aggregate-versus-private comparisons and avoided treating a production-accounting residual as a causal estimate.

## Verification

A separate arithmetic pass recomputed 33 numerical results, including factor-weighted growth residuals, exact growth factors, convergence rates and half-lives, human-capital elasticities, variety effects, innovation hazards, patent values, semi-endogenous growth, CES wage changes, allocation first-order conditions and reform interactions. Results passed at 1e-12 numerical tolerance against unrounded expected values; displayed rounded answers were checked against these values.

Structural checks passed: 60 unique IDs, exactly ten records in each of six units, one key and three distinct full-string distractors, populated source/explanation/hint fields, draft and constructed tags throughout, and exact agreement with outline topic/title pairs. Exact title and prompt overlap checks with advanced-macroeconomics, development-economics and international-macroeconomics returned no matches. Foundational economic mechanisms naturally overlap across fields, but exercise applications and derivations were selected to avoid repeats.

Only economic-growth.json, economic-growth-outline.json and this review note were written for this assignment. No activation, runtime, shared log or commit changes. Parent review and release checks remain the next gate.
