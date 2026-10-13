# International Macroeconomics draft review

Reviewed 2026-10-13. Status: draft; not activated or represented as independently approved.

## Scope and sources

60 original constructed questions, six units of ten, for upper undergraduate/MA study. Prerequisites are specified in the outline: intermediate micro and macro, calculus and constrained optimization, present-value accounting, probability, conditional expectations and introductory econometrics.

Official materials opened and checked during drafting:

- Columbia, Schmitt-Grohé, Uribe and Woodford, *International Macroeconomics*, BA/MA chapter-material index: https://www.columbia.edu/~mu2166/UIM/ . Chapters cover external accounts, intertemporal adjustment, investment, exchange rates, capital markets and regimes.
- Columbia, Martín Uribe, GR6241 field syllabus (Spring 2018): https://www.columbia.edu/~mu2166/GIM/syllabus.pdf . Used to choose scaffolded topics on collateral, default, spreads and policy identification; these exercises do not claim graduate-field depth.
- MIT, 15.015 Macro and International Economics lecture-material index (Fall 2011): https://ocw.mit.edu/courses/15-015-macro-and-international-economics-fall-2011/pages/lecture-notes/ . Confirms coverage of exchange-rate regimes, banking and financial crises.

These are university-hosted materials from two R1 institutions. They guide scope, not copied questions, scenarios, wording or empirical estimates. Existing curriculum-plan entries for open-economy macro and international crises informed boundaries.

## Self-review and corrections

Read all 60 prompts, keys, distractors, explanations and method hints for economic validity and uniqueness of the correct answer. Every item has one correct answer and three distinct incorrect answers. All scenarios are explicitly tagged constructed and all review statuses remain draft.

- Replaced the original external-debt-ratio exercise after the overlap check found a substantively similar advanced-macro exercise. Its replacement asks how a net debtor can receive positive net investment income when yields differ on gross positions.
- Corrected the real-exchange-rate answer units to domestic baskets per foreign basket.
- Incorporated parent review clarifications: the precautionary-saving problem now states increasing strictly concave time-separable utility, convex marginal utility, a two-date interior problem and admissible risk support; downward wage rigidity explicitly binds; the foreign-debt balance sheet is valued immediately before repayment.
- Fixed net primary and secondary income in the sudden-stop absorption question so fixed output alone does not silently stand in for fixed national disposable income.
- Exchange-rate numerical items explicitly use domestic currency per foreign currency. Exact gross-rate calculations are distinguished from log-linear approximations. External debt and asset exercises specify the inherited position, payment date or excluded stock adjustments as needed.
- Conceptual checks include net lending versus gross flows, external solvency versus liquidity, income versus substitution effects, risk-neutral versus covered parity, price-mediated externalities under constraints, and causal identification versus association.

## Verification

A separate Python arithmetic pass recomputed 33 numerical results, including external-flow reconciliation, yield income, consumption smoothing, marginal investment, real-rate changes, exact covered/uncovered parity, default recovery pricing and risk-sharing curvature. All passed within 1e-12 against unrounded expected values; displayed approximations were checked against those results.

Structural checks passed: 60 unique IDs, exactly ten questions in each of six units, three distinct distractors per item, all required text and source fields, draft/constructed tags, and exact outline topic/title matches. Exact title and prompt intersections with the existing international-trade and advanced-macroeconomics banks are empty. Shared foundational concepts remain, but the applications focus on external accounts, foreign financing and international policy rather than trade-pattern models or the closed-economy graduate core.

No activation, runtime code, shared trackers or commits were changed. Parent review and release checks remain the next gate; author self-review and arithmetic checks are not a claim of independent certification.
