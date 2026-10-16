# Advanced Microeconomics draft review

Status: draft; 60 original constructed questions, six units of ten. No activation, runtime changes, or copied exercises. Reviewed 2026-10-12.

## Curriculum evidence

Verified the official [MIT 14.121 readings](https://ocw.mit.edu/courses/14-121-microeconomic-theory-i-fall-2015/pages/readings/) and [Berkeley ECON 201A 2025 syllabus](https://eml.berkeley.edu/~kariv/201A_syllabus(2025).pdf) by opening both through web retrieval. MIT covers individual choice, consumer theory, producer theory and monotone methods, uncertainty, and dynamic choice. Berkeley supports formal choice and demand theory, revealed preference, uncertainty, and identifies general equilibrium as the second part of the course. Both institutions supply R1 university course evidence. These sources establish curricular coverage, not provenance for the invented exercises or numeric data. The local curriculum plan’s graduate-core entries informed depth. Equilibrium questions are a bridge, not a claim to exhaustive graduate general-equilibrium coverage.

## Item-by-item self-review

Every item was checked for a single defensible key among four distinct options, explicit scope and assumptions, an explanation of the relevant mechanism, and a method hint. The first twenty items remained unchanged after the parent’s checkpoint review.

| Items | Review findings |
| --- | --- |
| 1.1–1.10 | Checked monotone-transform domain; existence versus uniqueness; lexicographic sequence; relative-neighborhood nonsatiation proof; both WARP cross expenditures; all-maximizer contraction convention; convex versus strictly convex preferences; satiation; nonattainment; finite cycle. No unresolved defects. |
| 2.1–2.10 | Checked target utility normalization; both Slutsky signs; homogeneity; Roy normalization; CV sign and baseline; Hicksian correspondence at ties; C² symmetry; quasilinear corner; expenditure infimum argument. No unresolved defects. |
| 3.1–3.10 | Checked input feasibility, conditional demands, support-function convexity without convex technology, global shutdown comparison, sunk costs, unrestricted CRS scale, Hotelling derivative, substitution at fixed output, net-output disposal convention, and price/output curvature distinction. Simplified 3.7 to an explicit piecewise profit statement to avoid a confusing maximum expression outside its stated branch. |
| 4.1–4.10 | Checked price-dependent endowment wealth; weighted Walras law; first-welfare-theorem proof without convexity; transfer role; interior contract curve; external marginal damage; price normalization; resource feasibility; nonconvex equilibrium construction; unequal purchasing power. Retitled 4.9 to state its actual counterexample: nonconvexity does not prove nonexistence. |
| 5.1–5.10 | Checked certainty-equivalent inversion; affine versus ordinal transformations; mixture independence; fair insurance state wealth; absolute versus relative risk aversion; Jensen versus first-order dominance; statewise dominance; feasible-plan value of information; probability-weighted state claims; explicitly approximate small-risk premium. No unresolved defects. |
| 6.1–6.10 | Checked Euler equation and budget; borrowing-boundary inequality; contraction modulus and bounded domain; a posteriori tail starting after V₁; changing quasi-hyperbolic weights; increasing differences and unique policy; discrete ties; moving feasible-set counterexample; sign crossing despite a zero derivative; envelope versus policy derivative. No unresolved defects. |

## Executed independent checks

A standalone Python standard-library run passed 30 assertions. The numerical checks used direct feasible-grid objective comparisons, independent budget/first-order-condition checks, and a finite-difference derivative, rather than parsing the keyed option to reproduce it. Finite grids corroborate the stated calculations; the analytic explanations supply the global arguments and theorem assumptions.

- 60 unique complete records
- Six units with ten items
- Four distinct options each
- Draft metadata and sources
- Outline alignment
- WARP strict cross affordability
- Satiation grid optimum
- Slutsky normal and Giffen arithmetic
- Hicksian cost feasible grid
- Compensation
- Quasilinear optimum at both wealths
- Leontief cost
- Cobb Douglas conditional inputs
- Avoidable cost grid shutdown
- Sunk cost grid output
- Exchange clearing
- Walras weighted excess demand
- Contract curve sampled MRS
- Externality efficient grid
- Nonconvex corner demands
- Certainty equivalent
- Fair insurance state wealth
- State claim budget and FOC
- Small risk approximation
- Two period grid optimum
- Borrowing constraint grid
- Contraction tail error
- Present bias reversal
- Discrete monotone tie
- Envelope finite difference

## Remaining gate

This is a self-reviewed draft. Parent/editor review and the existing release validation process remain required before activation. No rendered interface review was performed because these draft files have not been activated.
