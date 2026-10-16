# International trade numeric expansion review

Author self-review of 256 draft numeric variants: 16 variants for each of 16 existing base families. The base records were read from the current `international-trade.json`, including its corrected exact real-income and exponentiated-log-fit wording. No new families, base replacements, registration changes, release changes, activation, or commits are included. Parent integration should retain the base as variant 1 and add these as variants 2–17.

Reproduce with `node scripts/econ-practice/draft-trade-variants.mjs`. This standalone generator reads the base JSON, verifies every referenced ID, writes only the variants JSON, and executes 256 arithmetic/residual and regime checks. Each family has 16 distinct numeric answers. All six units are represented.

| Existing base suffix | Scalar task retained | Answer coverage (16 distinct each) | Review and boundaries |
|---|---|---|---|
| u1-03 | Competitive hourly wage | $7–$22 | Revenue per labor hour is strictly higher in bicycles; zero profit there and strictly negative basket profit at that wage. No tie or diversification ambiguity. |
| u1-04 | Honey component of consumption bundle | 6–13.5 jars | Fish exports are positive and smaller than production. World honey price is strictly below domestic opportunity cost. Full bundle costs more labor than available domestically. Continuous quantities permit half jars. |
| u1-06 | Delivered Home cost per usable crate | $5–$20 | Arrival fractions lie between zero and one. Factory cost is divided by survival; examples include both Home and Foreign cost advantage. Foreign costs are positive. |
| u2-05 | Sector A component of allocation | 30–60 workers | Both allocations are strictly interior, common wages are positive, and both sector marginal products decline in their own labor. Wage equality and labor exhaustion checked. |
| u2-09 | Exact real-income percentage change | −8% through +7% | Half shares and exact square-root cost-of-living index are explicit. Includes loss, zero, and gain cases. Wage multipliers stay positive; arithmetic price averaging is not used. |
| u3-05 | Wage component of factor-price solution | $3–$18 | Nonsingular coefficient matrices, positive wages and rentals, and both zero-profit equations verified. Diversification is a premise, not inferred from an omitted endowment. |
| u3-08 | Net capital component of factor content | 28–133 capital units | Export and import content use the stated coefficients; subtraction orientation is explicit. Machines remain more capital intensive. No broader empirical factor-content theorem is presumed. |
| u4-03 | Incremental export profit | −$15,000 through +$15,000 in $2,000 steps | Eight unprofitable and eight profitable cases. Avoidable fixed entry cost belongs to the same period and is not sunk; domestic operations remain unaffected. No zero-profit tie. |
| u4-07 | Constant-elasticity monopoly price | $30–$255 in $15 steps | Elasticity takes values 2–5, marginal costs stay positive, and Lerner identity checked. Interior optimum stipulated; all input prices display cleanly. |
| u5-02 | Imports after tariff | 30–75 units | Domestic demand, supply, and imports positive; tariff-inclusive price strictly below autarky price. Small-country competition/no-cost assumptions make the price wedge valid. |
| u5-03 | Two-triangle tariff deadweight loss | $6–$561 | Positive tariff and both quantity distortions; linear curves, fixed world price, continued imports, and absence of other distortions stated. Revenue excluded as a domestic transfer. |
| u5-08 | Effective protection percentage | +22% down to −0.5% | Both initial and protected domestic value added remain positive. Fixed input requirement; denominator is initial value added. Includes negative protection despite a positive output tariff. |
| u6-01 | Gravity percentage compounding | 9.2%–28.4% (not monotonic) | Both GDP changes compound, distance and other terms fixed. Answers are percentage points of growth, not fractional multipliers. |
| u6-02 | Exponentiated fitted-value factor | 0.943133 down to 0.697589 | Exact power/exponential computation with six-decimal rounding. Explicitly concerns exponentiated log fit, with no unsupported arithmetic conditional-mean interpretation. Factors strictly between zero and one. |
| u6-05 | Domestic value added | $80–$275 | Gross exports exceed imported content; no other foreign content or firm-level double counting. |
| u6-06 | Offshoring break-even volume | 2,000–5,750 units | Domestic variable cost strictly exceeds offshore cost and fixed cost is positive/avoidable. Equal total costs at answer and offshore advantage just above threshold verified. |

## Independent arithmetic pass

A separate executed Node audit reread the saved JSON, extracted numerical premises from every rendered prompt, and recomputed all 256 answers without using the generator's parameter variables. It passed at absolute tolerance 0.00000051 (the six-decimal log-fit rounding allowance; other answers matched more closely). This independently checks the rendered premises against the saved answers, in addition to the generator's inverse identities and equilibrium residuals. It is not a second-person review or psychometric validation.

The display audit found and corrected long binary-decimal expansions in iceberg cost, markup cost, and gravity explanations. The final audit found no eight-or-more-digit fractional display strings.

## Figures

64 existing-schema line diagrams span four families: production frontier versus trade budget (u1-04), the two labor value-marginal-product curves on a common allocation axis (u2-05), supply/demand with world and tariff-inclusive prices (u5-02), and domestic/offshore total costs (u6-06). All 64 passed the existing figure renderer. Labels identify economic curves, not the numeric solution; there are no answer annotations. Axes carry units. Labor's B curve rises in A labor because remaining B labor falls. Negative supply intercepts are legitimate and handled by the existing axis-clipping renderer. Figure rendering was checked programmatically; no browser screenshot review or student difficulty calibration is claimed.

Parameters change substantive computations and answers within the existing reasoning tasks. For multi-component base questions, variants request a named scalar component, and explanations preserve the other component where useful. These remain draft content for parent integration and review.

Parent review checkpoint: inspected all 16 generator families, including wage specialization, iceberg survival costs, interior specific-factor allocation, exact Cobb–Douglas price index, diversified zero-profit equations, avoidable export entry costs, elasticity markup, positive-import tariff regime, effective protection denominator, compounded gravity changes, log retransformation interpretation and offshoring break-even. Independent regression test parses every saved prompt and reconstructs all 256 answers within 0.00000051. Corrected log-distance prompt from six-decimal to three-decimal rounding to match the bank materializer; explanation now reports the same rounded result. Saved numeric answers retain precision for auditing. Four diagram families still require parent browser inspection before activation; this checkpoint does not release the variants.
