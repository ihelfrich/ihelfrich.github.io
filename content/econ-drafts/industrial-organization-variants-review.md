# Industrial organization numeric variants: author review

Reviewed 2026-10-13. Draft authoring only; no activation, registration, release-manifest change, or commit. The original 60-item file is unchanged. These 256 additional items expand 16 existing base IDs, with 16 variants per base; they are not new families. The parent retains each original as variant 1 and integrates these as variants 2–17.

Run `node scripts/econ-practice/draft-io-variants.mjs` from the repository root to reproduce the JSON and execute its assertions. The generator has no bank-registration imports or runtime side effects beyond writing its designated draft JSON.

## Scope and formula review

| Base suffix | Preserved task and independent check | Boundary checks |
|---|---|---|
| u1-01 | Linear monopoly quantity; evaluate profit on either side of optimum and verify MR = MC | Positive quantity, price above MC, no capacity constraint |
| u1-02 | Lerner margin as a percentage; reciprocal elasticity calculation | Absolute elasticity exceeds one; interior optimum stated |
| u1-04 | Monopoly deadweight loss; midpoint integration of the linear surplus wedge | Efficient quantity exceeds monopoly quantity; no externalities |
| u1-10 | Unit-tax consumer-price increase; calculate pre/post prices separately | Positive after-tax output; unchanged linear-demand regime |
| u2-01 | Symmetric Cournot output; residual-profit optimization and first-order condition | Positive interior symmetric quantities |
| u3-01 | Spatial indifference; equate both delivered costs | Nonnegative prices; cutoff strictly between 0 and 1 |
| u3-07 | Campaign's profit change; additional revenue minus additional cost and campaign cost | Price above MC; all profit changes positive |
| u4-01 | Entry NPV; sum annual cash flows separately | Zero discount rate, no salvage, positive entry cost |
| u4-02 | Integer free-entry count; adjacent integer profit inequalities | Strict positive active profit and negative next-entry profit avoid boundary multiplicity |
| u4-04 | Minimum grim-trigger discount factor; substitute into both present values | Deviation > cooperation > Nash punishment; threshold strictly between zero and one |
| u5-05 | Highest incentive-compatible high-plan price; compare net utilities | Low option offers positive surplus, ensuring participation at the IC bound |
| u5-06 | Successive-monopoly retail price; optimize wholesale profit and check retailer FOC | Zero upstream MC, no downstream costs, linear wholesale price, positive quantities |
| u5-07 | Integrated retail price; optimize joint profit numerically locally | Zero total MC and positive demand intercept |
| u6-01 | Deficit at marginal-cost pricing; subtract revenue from total cost | Positive served demand and fixed cost |
| u6-04 | Merger HHI increase; full before/after squared-share sums | Positive shares summing to 100; shares otherwise fixed |
| u6-06 | Specified diversion screen; independent arithmetic | Valid diversion fraction, positive margin and savings; no equilibrium-price prediction |

Every family has exactly 16 distinct numeric answers; across the entire set there are 153 distinct numeric values. Answer overlap between unrelated tasks is expected (dollars, quantities, percentages and discount factors have different meanings). No family was added merely for changing a parameter. Parameters change both intercepts and slopes where appropriate; each question retains the base task. The HHI examples use three firms rather than four without changing the concentration-change calculation.

Five families (u1-01, u1-04, u2-01, u3-01 and u5-06) include line graphs in all 16 variants: 80 graphs total. They show demand/MR/MC, mutual best responses, or delivered costs. Graphs contain no point labels, optimal quantities, equilibrium prices or answer annotations. All use the existing `kind: lines` schema with explicit axis units. Spatial location is a dimensionless fraction; elasticity questions request a percentage explicitly.

## Executed validation

The standalone generator passed 272 numerical equality or regime checks, additional local profit comparisons, structural checks for 16 existing unique base IDs and 16 variants each, and finite-answer/required-string checks. An independent pass parsed the serialized question wording and recomputed all 256 answers using separate formulas or an integer entry search; all passed at tolerance 1e-7. All 80 saved graphs successfully passed the existing SVG renderer. Answers are rounded to at most eight decimal places, including recurring fractions; ordinary practice answer tolerance must accommodate this representation.

During generation, the initial spatial price range produced a negative B price. The boundary assertion rejected it before output; raising the common price level preserved the intended cutoffs and made every price nonnegative. The reproducible nonnegative-price and interior-cutoff assertions prevent recurrence.

The original IO review and its official MIT curriculum anchor were read for scope. No new empirical, legal or uncertain research claim is introduced by these constructed numerical examples. This is an author self-review, not an independent content approval. Browser visual inspection, learner testing, answer-input integration and final release approval remain with the parent integration task.
