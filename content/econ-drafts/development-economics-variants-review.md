# Development economics numeric expansion review

Sixteen existing families receive sixteen variants each (256 total). Base questions are unchanged. These are authored drafts for integration; nothing is registered or activated. Regenerate with `node scripts/econ-practice/draft-development-variants.mjs` from the project root.

Every family has **16 distinct numeric answers**. Empirical surveys, economies and evaluations are explicitly synthetic. Other questions are transparent hypothetical household/model choices. Units and requested numeric format are explicit.

## Family review

| Existing family | Numeric task and boundary review |
|---|---|
| u1-01 | Headcount percentage, 10–85%. Exactly-at-line observation is excluded in every variant. Population fixed at 20; all consumption observations supplied. |
| u1-02 | Population poverty-gap index, 0.1875–0.3. Includes one at-line and one above-line person; denominator includes all four people. No negative gaps. |
| u2-02 | Minimum immediate grant, 20–125 asset units. Threshold is inclusive; checks establish that one cent less misses it. No premature depreciation. |
| u2-03 | Unique steady state, 20–80 asset units. Transition slope 0.5 ensures convergence from all nonnegative starting levels. Numeric conversion preserves the convergence/no-separate-trap reasoning in explanation and diagram. |
| u2-04 | Break-even total repayment, 100–250 currency units. Probability 0.8, zero default recovery and zero other costs stated; expected receipts equal the advance. |
| u2-09 | Certainty equivalent, 169–784 consumption units. Square-root utility and equiprobable positive outcomes; average utilities before inversion. CE below expected consumption. |
| u3-03 | Incremental fertilizer profit, −16 to 14 currency units, including zero. Price-taking and all incremental costs/risk assumptions explicit. Negative profit does not imply purchase is optimal. |
| u3-09 | Farm-gate price increase, 16–31 currency units/kg. Both transport charges remain below city price; full competitive pass-through stated. |
| u4-02 | Schooling net benefit, −120 to 180 currency units, including zero. Fees plus forgone earnings, one future return period, zero discounting. |
| u5-01 | Expected migration gain versus staying, −20 to 100 currency units. Costs paid even when unemployed; risk neutrality explicit. Numeric conversion preserves the original migrate/stay margin. |
| u5-03 | Agricultural worker count change, 0–750 workers. Falling sector share is paired with rising total employment; zero is included, so the count need not strictly increase. |
| u5-04 | Aggregate productivity increase, 0.2–3.2 thousand currency units/worker/year. Common fixed prices, fixed sector productivities, shares in [0,1]; numerical weighted averages shown. |
| u6-02 | ITT, −20 to 55 currency units/month, including zero. Complete follow-up and random offer; take-up does not enter the ITT calculation. |
| u6-03 | LATE, 10–85 currency units/month. First stage is 40 percentage points = 0.4; all IV assumptions stated and result restricted to compliers. |
| u6-05 | DiD, −10 to 20 currency units/month, including zero. Parallel untreated trends, no anticipation and no spillovers explicit; both within-group changes required. |
| u6-08 | Deterrence threshold, 0.10–0.85. Total payment includes restitution; all probabilities feasible. Equality meets “no better”; lower probability leaves positive diversion payoff. |

## Verification executed

1. Generator executed 256 answer checks, including fixed-point iteration for asset convergence, numerical utility inversion for certainty equivalents, and threshold-side checks. All passed.
2. A separate Node execution loaded the saved JSON, parsed numeric inputs from every final prompt, and independently recomputed all 256 answers. All matched within 1e-7.
3. All 32 line diagrams (16 each for assets and reallocation) rendered through the existing `renderGraph`; every curve has a valid visible segment. The asset diagram includes the transition and 45-degree line; the reallocation diagram shows the employment-share weighted average. No answer point, solved intercept annotation or answer marker is present.
4. Checked 16 groups, 16 variants per group, and 16 distinct answers per group. Generated output is deterministic. No shared bank/configuration edits, releases, commits or activation were performed.

Scope limit: this is a numeric expansion, not a replacement for the original conceptual base questions. The original categorical convergence/migration/structural-change questions remain available for conceptual assessment.
