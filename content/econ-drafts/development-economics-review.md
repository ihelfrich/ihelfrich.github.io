# Development Economics draft review

Author review date: 2026-10-13. Status: draft; not activated or independently reviewed.

The file contains 60 original single-best-answer items, ten in each unit. Every prompt explicitly identifies its setting as hypothetical. No question reports a real empirical estimate, and no question was copied from source assessments. The scope follows `docs/econ-practice/research/fields-curriculum.md`; the MIT development calendar was also opened during authoring to verify its subject coverage. MIT's course is graduate-level, so it is a subject anchor rather than a claim about the level of these questions. The exercises use undergraduate algebra, introductory microeconomics and basic program-evaluation interpretation. Source links establish curricular provenance, not empirical validation of the invented settings.

| Unit | Coverage | Items |
| --- | --- | ---: |
| 1 | Headcounts, poverty gaps, distributional transfers, Gini scaling, Lorenz dominance, spatial prices, household size, seasonality, aggregate growth, relative poverty | 10 |
| 2 | Indivisible investment, asset thresholds, convergence versus traps, lending break-even, adverse selection, moral hazard, aggregate insurance risk, basis risk, certainty equivalents, take-up mechanisms | 10 |
| 3 | Sharecropping, tenure, input profitability, adoption risk, information, farm-size evidence, complete-market separation, missing labor markets, transport costs, irrigation coordination | 10 |
| 4 | Attendance versus learning, schooling costs, marginal completion, health externalities, clinic use, income pooling, nutrition dynamics, care selection, classroom congestion, program choice | 10 |
| 5 | Expected migration income, liquidity, employment shares, productivity reallocation, marginal products, sector wage comparisons, networks, local labor demand, informality, seasonal migration | 10 |
| 6 | Institutional endogeneity, ITT, IV/LATE, spillovers, DiD, attrition, scale-up equilibrium effects, audit incentives, bundles, external validity | 10 |

## Key and distractor review

All 60 answer sets were reviewed for a single best response under the stated assumptions. The distractors reflect identifiable mistakes: averaging only across poor people, confusing totals with margins, equating financing with profitability, confusing selection with hidden action, treating expected profit as expected utility, inferring causality from selection, assuming assignment removes attrition or interference, and transferring pilot effects unchanged to new populations or scales. Some mathematical claims are deliberately categorical; they are consequences of an explicit model, not unsupported empirical generalizations.

The drafting pass made the following assumptions explicit to avoid competing correct answers:

- Poverty gaps are averaged across the entire population; strict poverty-line classification and fixed versus relative lines are stated.
- Threshold dynamics specify what happens exactly at the cutoff; the comparison model has one globally attracting steady state.
- Lending has zero recovery and zero other costs; the expected-return migration example specifies risk neutrality.
- Farm-household separation requires functioning relevant markets; transport-cost pass-through is stipulated rather than inferred from competition alone without further detail.
- Health program choice has a specified objective, indivisible alternatives, a binding feasible set and no additional effects.
- The IV item states exclusion, monotonicity, relevance and no spillovers; the DiD item states parallel untreated trends, no anticipation and no spillovers.
- Attrition bias has no asserted direction; bundled treatments do not identify component contributions; a positive feedback is not itself evidence of a poverty trap.

No incorrect numeric key was found by the executable arithmetic pass. No answer was promoted beyond draft on the basis of author review.

## Executed checks

A Python validation run parsed the delivered JSON and verified 60 unique IDs, ten records per unit, exact schema fields, course identifiers, draft status, topic/unit agreement, nonempty text fields, exactly three distinct incorrect choices, and four unique choices per item. All prompts passed the explicit hypothetical-setting check.

Twenty-nine arithmetic assertions passed with numerical tolerance 1e-10. Multiple assertions refer to distinct quantities in the same question:

| Item suffix | Verified quantities |
| --- | --- |
| u1-01 | Headcount = 3/5 = 0.60 |
| u1-02 | Population-average poverty gap = 0.20 |
| u1-03 | Squared gap sums before/after = 0.68 and 0.52 |
| u1-06 | Real basket quantities = 2 and 1.6 |
| u1-07 | Per-person consumption = 150 and 100 |
| u2-01 | Undiscounted investment net return = 40 |
| u2-02 | Minimum threshold grant = 20 |
| u2-03 | Steady state = 100 |
| u2-04 | Conditional repayment = 125 |
| u2-09 | Certainty equivalent = 225 |
| u3-03 | Fertilizer marginal profit = 10 |
| u3-09 | Farm-gate prices = 7 and 9 |
| u3-10 | Payoff when both connect = 30 per farmer |
| u4-02 | Net schooling benefit = 50 |
| u4-10 | Costs per episode = 5 and 3.75 |
| u5-01 | Expected net urban income = 65 |
| u5-02 | Migration net present value = 150 |
| u5-03 | Agricultural employment growth = 3/7, approximately 43% |
| u5-04 | Aggregate productivities = 3 and 4 |
| u6-02 | ITT = 20 |
| u6-03 | LATE = 30 |
| u6-05 | DiD = 5 |
| u6-08 | Minimum audit probability = 0.40 |

## Remaining limits

This is author self-review, not a blind independent content review or psychometric calibration. Source URLs are broad curriculum anchors rather than item-specific readings. Empirical difficulty, distractor performance and curricular completeness have not been established. Several familiar mathematical tools recur across economic contexts, but these are sixty authored tasks rather than numerical variants of a common template. Rendering, answer randomization, accessibility, integration and activation belong to the parent task and were not tested here. No shared application files, live content, commits or Agent Log entries were changed by this authoring subtask.
