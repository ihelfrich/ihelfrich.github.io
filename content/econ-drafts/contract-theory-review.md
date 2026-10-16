# Information and Contract Theory review

Author-reviewed draft: 60 original constructed questions, six units of ten. Saved only draft questions, outline and this review inside the repository. All items include explanations, method hints, exactly three complete distractor strings, source URLs, `reviewStatus: draft` and `scenarioType: constructed`. No activation, runtime, shared-log or commit changes were made.

## Provenance and scope

Verified October 13, 2026:

- MIT Fall 2026 economics catalog, the curriculum-plan anchor: https://student.mit.edu/catalog/m14a.html. Supports the information/contracts graduate progression and broader curriculum context.
- MIT 14.124, Spring 2017, detailed lecture-note contents: https://www.ocw.mit.edu/courses/14-124-microeconomic-theory-iv-spring-2017/pages/lecture-notes/. Covers static and dynamic hidden action, teams, linear and multitask incentives, screening, revelation and commitment/renegotiation.
- MIT Sloan, Make, Buy, or Cooperate?: https://ocw.mit.edu/courses/15-963-advanced-strategy-spring-2008/resources/gibbons4/. Verified the official resource describing Robert Gibbons’s notes on formal and relational contracts; used for ownership and relational units.

The requirement for multiple official R1 sources is met by distinct official MIT catalog and teaching resources; this is not a claim of multiple-university consensus. Penn and Harvard syllabus URLs appeared in search but direct fetches failed; those sources were not relied on or included in the draft metadata. Sources guide topic coverage; numerical examples and all question wording are original rather than copied assessments. Source summaries remain narrow and do not assert institutional endorsement.

Selectively inspected existing game-theory questions for signaling, screening, adverse selection, contracts and moral hazard. Avoided sender-signaling and equilibrium-refinement exercises and auction duplication. Some basic IC terminology necessarily builds on game theory, but tasks here concern menus, wages, insurance, ownership and continuing contracts.

The outline separates graduate extensions and lists expected utility, probability, intermediate microeconomics and basic game theory as foundations; calculus and constrained optimization are required for advanced tasks. The full curriculum-plan entry also mentions information design; this bounded course includes a value-of-information exercise but does not claim comprehensive Bayesian persuasion coverage.

## Corrections and verification

Parent review correctly identified an ambiguity in initial item 3.8: raising an already-positive linear sales bonus cannot move effort farther if the worker already allocates everything to sales. Rewrote the item with an initial zero bonus, explicit tie-breaking toward maintenance, and introduction of a strictly positive bonus. The unique new allocation is all sales, so maintenance falls from one to zero. The final item states utility and feasibility explicitly.

All mathematical keys were independently recalculated, including participation cap 6, rent 3, rent increment 1, envelope integral 3/2, binary IC spread 10, expected utility 7, limited-liability expected wage 8, unrestricted-wage utility zero, principal profit 8, certainty equivalent 25, risk premium 25, linear slope 1/4, multidimensional dot product −4, perfect-information value 5, Nash bargaining payoff 45, discount thresholds 2/3 and 3/4, survival-adjusted factor 18/25, and deferred utility spread 10. Quadratic objectives were also evaluated on a 0.01 grid over [0,20], confirming high quantity 4, low quantity 0, private investment 5, joint investment 10 and incentive slope 0.25. The analytical second derivatives are negative in these cases; the grid check is corroboration, not proof.

Final saved-file checks confirm 60 unique IDs, 60 unique topics, six units of ten, exactly four distinct options per item, all required nonempty fields, draft/constructed status and exact outline topic alignment. No delimiter parsing is used for distractors. Full semantic self-review appears below; parent review is additional rather than a substitute.

## Item-by-item self-review

| Topic | Check performed |
|---|---|
| 1.1 | Private valuation precedes menu choice; identified adverse selection rather than hidden action. |
| 1.2 | IR is 6−t≥0; explicit acceptance at equality makes maximum 6 attainable. |
| 1.3 | Low utilities 0,−2; high utilities 2,2; intended-option tie rule resolves high choice. |
| 1.4 | Low IR fixes payment 2; high mimicking utility is 3. |
| 1.5 | Added both IC inequalities to obtain monotonic quantity necessity. |
| 1.6 | Binding constraints imply rent 2q_L; quantity increment 0.5 raises rent by 1. |
| 1.7 | With q_L held feasible, high surplus derivative 4−q_H gives quantity 4. |
| 1.8 | Low surplus and high rent terms cancel linearly; −q_L²/4 gives boundary zero. |
| 1.9 | Supplied envelope derivative integrated to 1.5; not treated as standalone proof of global IC. |
| 1.10 | Marginal valuation θ rises with type; IR is not eliminated. |
| 2.1 | Effort chosen after acceptance and unavailable as enforceable wage contingency. |
| 2.2 | Probability difference 0.3 times spread must cover cost 3; ties support equality. |
| 2.3 | Expected wage 10 minus cost 3 is 7≥5; only IR asked. |
| 2.4 | Nonnegative wages plus minimum spread imply w_F=0,w_S=10 and expected wage 8. |
| 2.5 | Wages 5,−5 give spread 10 and expected net utility zero; negative payments explicitly allowed. |
| 2.6 | Expected revenue 16 minus expected wages 8 gives profit 8. |
| 2.7 | Constant wage cancels across actions, making costless L strictly preferred. |
| 2.8 | Verification expands contingencies without changing risk preferences or outside option. |
| 2.9 | Independent effort-invariant signal adds no information conditional on output. |
| 2.10 | Stationarity without suitable global conditions does not establish worker IC. |
| 3.1 | Contractible fixed effort removes incentive need for risk; strict concavity favors full insurance. |
| 3.2 | Mean utility 5 implies certainty equivalent 25. |
| 3.3 | Expected wage 50 minus CE 25 gives monetary risk premium 25. |
| 3.4 | Effort-dependent objective is 0.6e−e²/2; unique effort 0.6. |
| 3.5 | Supplied strictly concave profit gives slope 1/4; optimum restricted to linear contracts. |
| 3.6 | Noise comparative static explicitly conditional on the CARA-normal model. |
| 3.7 | Output subtraction eliminates common noise but leaves both idiosyncratic shocks. |
| 3.8 | Corrected zero-bonus initial condition and tie rule; positive slope uniquely yields sales one. |
| 3.9 | Individual derivative 0.5−e_i gives simultaneous effort pair (0.5,0.5). |
| 3.10 | Joint-surplus derivative 1−e_i gives pair (1,1). |
| 4.1 | Type coordinates cross; no universal scalar valuation ranking follows. |
| 4.2 | Each intended option gives 1, other option −2, rejection zero; choices strict. |
| 4.3 | IR against rejection differs from IC against other reports. |
| 4.4 | Bayesian IC averages under beliefs conditional on own type; dominant IC is profile-wise. |
| 4.5 | Revelation replicates an existing equilibrium under standard assumptions, not arbitrary allocations. |
| 4.6 | Pairwise necessary dot product is −4; no transfer choice repairs both IC constraints. |
| 4.7 | Optimized payoff rises from 5 to 10, giving maximum information price 5. |
| 4.8 | Certain verification with enforceable penalties changes available report enforcement; no costless-audit claim. |
| 4.9 | Correlation can make other reports informative; does not universally imply full rent extraction. |
| 4.10 | Local differential restrictions do not substitute for global IC absent sufficient conditions. |
| 5.1 | Party observability distinguished from court verifiability. |
| 5.2 | Ownership concerns residual asset decisions, not ownership of human capital. |
| 5.3 | Supplier payoff 5i−i²/2 yields investment 5. |
| 5.4 | Full joint objective 10i−i²/2 yields investment 10. |
| 5.5 | Supplier receives disagreement 10 plus half of incremental surplus 70, totaling 45. |
| 5.6 | Gross supplier return (10+α)i/2 produces investment (10+α)/2; α bounds preserve nonnegative surplus. |
| 5.7 | Both parties’ marginal investment returns enter the ownership tradeoff; no universal integration claim. |
| 5.8 | Unconditional F drops out of marginal condition; wealth and renegotiation effects excluded. |
| 5.9 | Efficient trade conditional on investment does not eliminate ex ante appropriation distortion. |
| 5.10 | Alternative-use exclusion changes disagreement payoff; marginal dependence matters for incentives. |
| 6.1 | Unverifiable discretionary bonus requires self-enforcement through continuation value. |
| 6.2 | Bonus saved now is 4; future rents start next period: 4≤2δ/(1−δ), threshold 2/3. |
| 6.3 | Shirking gain 3 compared with δ/(1−δ); threshold 3/4. |
| 6.4 | Intersected two parties’ constraints; tighter threshold is 3/4. |
| 6.5 | Final payment-stage withholding result excludes all other future, legal and preference consequences. |
| 6.6 | Independent survival and time discount multiply to 0.72; stream timing stated. |
| 6.7 | Future extraction after productivity revelation explains current suppression incentives. |
| 6.8 | Promise keeping has correct effort-cost sign and continuation discount; not sufficient for IC. |
| 6.9 | Extra discounted benefit 0.5×0.2×spread covers cost 1; threshold spread 10. |
| 6.10 | Mutually preferred feasible replacement challenges renegotiation-proofness, not all repeated cooperation. |

## Remaining gate

Files remain drafts for integration and release review. No rendered-page inspection or runtime activation was performed within this content-only assignment. The models state restricted environments; keys should not be generalized to all risk-sharing, multidimensional screening or incomplete-contract settings.
