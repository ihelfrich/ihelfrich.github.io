# Game Theory draft review

Reviewed 2026-10-12. All 60 exercises are original constructed scenarios, not adaptations of course exam questions. All remain `reviewStatus: draft` and `scenarioType: constructed`. This review does not activate the collection or certify independent peer review.

## Sources and prerequisites

Opened and verified these official university course pages through the web tool:

- MIT graduate 14.122 calendar: https://ocw.mit.edu/courses/14-122-microeconomic-theory-ii-fall-2002/pages/calendar/ — strategic games, mixed/existence, extensive/subgame, repeated, Bayesian, signaling/PBE/refinements. This is the curriculum-plan source.
- MIT undergraduate 14.12 syllabus: https://ocw.mit.edu/courses/14-12-economic-applications-of-game-theory-fall-2025/pages/syllabus/ — mathematical strategic interaction, probability/calculus preparation, applications including bargaining and auctions.
- Yale ECON159: https://oyc.yale.edu/economics/econ-159 — undergraduate dominance, backward induction, Nash, commitment/credibility and asymmetric information/signaling.

MIT and Yale are the two distinct R1 institutions. Sources establish scope and level; they do not supply scenario data or endorse answer keys. Outline distinguishes algebra/probability/calculus entry requirements from graduate compactness/convexity, fixed-point and limit reasoning. Existence/refinement questions are conceptual bridges, not proof exercises.

## Checks and corrections

Validated JSON, exactly six units with ten items each, 60 unique IDs, three wrong answers plus one distinct correct answer per item. Checked every key, explanation, distractor and hint against the stated information and payoff convention. Enumerated pure best-response profiles by executable comparison for items 1.3, 1.4, 1.8, 2.1, 2.2 and 2.8. Checked rational fractions for coordination mixing, both grim thresholds, stationary bargaining and posterior updating. Other derivations were checked algebraically below.

Corrected 3.9 during self-review: replaced general perfect-recall/information-set phrasing with finite-horizon perfect information and deviations at single decision nodes in every subgame. This avoids ambiguity about conditioning at unreachable information sets. Explicitly retained indifference in 3.5; specified acceptance ties in 4.7–4.9, auction ties in 5.5–5.6, zero-probability cutoff types in 5.4, and weak-PBE qualification in 6.5. Cournot/Stackelberg permit negative price-cost margins explicitly, so boundary assumptions are not hidden.

## Item audit

| Item | Verification |
|---|---|
| 1.1 | A exceeds B at both columns; C not dominated by A. |
| 1.2 | Half A plus half B gives (2,2), strictly above C=(1,1). |
| 1.3 | Pure NE UL and DL; full set is any row mixture with L. Weak deletion removes DL and mixtures using D. |
| 1.4 | L strictly dominates R; U then dominates D. Unique NE UL. |
| 1.5 | 6q≥3-q gives q≥3/7; equality retained. |
| 1.6 | Positive affine expected-utility transformation preserves all best responses. |
| 1.7 | Original A=2>B=1.5; transformed A=4<B=4.5. |
| 1.8 | D strictly dominates C for both. Unique NE DD; CC strictly Pareto improves on DD. |
| 1.9 | Both actions best respond to some beliefs; no pure NE. |
| 1.10 | Own-action gain is 2 for either opponent action. Unique NE (1,1). |
| 2.1 | No pure NE; unique full-support solution p=1/2, q=1/3. Both expected row payoffs zero. |
| 2.2 | Two strict pure NE plus full-support p=2/3, q=1/4; no boundary mixtures. |
| 2.3 | Omitted C yields 3 versus supported payoffs 1; candidate rejected. |
| 2.4 | Finite-game mixed existence uses nonempty finite action sets and finite expected-utility payoffs. |
| 2.5 | Open interval excludes supremum; every choice has profitable increase. |
| 2.6 | Standard compact/convex/continuous/own-quasiconcave sufficient conditions; no uniqueness claim. |
| 2.7 | BR=max(0,(10-qj)/2); unique intersection 10/3 each; no boundary NE. |
| 2.8 | U strictly dominates D; R strictly optimal for column. Unique saddle (U,R), value 1. |
| 2.9 | Supported actions equal maximal expected payoff with opponent held fixed. |
| 2.10 | Conditional obedience payoff 1 versus 0; fair independent mixing would put positive mass on mismatches. |
| 3.1 | Strategy specifies off-path continuation, not merely realized action. |
| 3.2 | Accommodate after entry; enter at root. Unique SPE. |
| 3.3 | Pure NE Out/Fight and In/Accommodate; only latter SPE. |
| 3.4 | Neither hidden-history node is singleton; no proper subgame starts there. |
| 3.5 | Both continuation actions optimal; exactly two pure SPE In/A and Out/B. Mixed SPE also possible but not requested. |
| 3.6 | Leader objective q1(10-q1)/2 below 10; max at 5, follower 2.5; larger quantities nonpositive. |
| 3.7 | Commitment Fight induces Out and payoff 2 versus commitment Accommodate payoff 1. |
| 3.8 | Perfect recall gives realization equivalence, not equality of distributions over plans. |
| 3.9 | Restricted to finite perfect-information game; last profitable deviation reasoning establishes SPE. |
| 3.10 | One action per information set; hidden history cannot enter strategy. |
| 4.1 | Unique stage NE DD unravels all three periods and every continuation. |
| 4.2 | 4/(1-δ)≥7+δ/(1-δ) iff δ≥1/2; DD punishment credible. |
| 4.3 | 5/(1-δ)≥9+3δ/(1-δ) iff δ≥2/3; credibility explicitly assumed. |
| 4.4 | Punishment-phase profitable local deviation defeats SPE regardless of severity. |
| 4.5 | Public coin convexifies ex-ante continuation payoffs, not physical feasibility. |
| 4.6 | Feasibility, individual rationality and theorem-specific conditions retained. |
| 4.7 | Acceptance at zero specified; optimal offer exactly zero exists. |
| 4.8 | Final proposer keeps 12; round-1 responder reservation is 6, so offer 6. |
| 4.9 | y=δx and 1-x=δ(1-y) yield x=2/3,y=1/3. |
| 4.10 | Product (u1-2)(10-u1) maximized at u1=6,u2=4, feasible and individually rational. |
| 5.1 | Type-contingent mapping rather than realized action. |
| 5.2 | Entry expected utility 5-6p; entry iff p≤5/6, including indifference. |
| 5.3 | Posterior 0.4/0.5=0.8. |
| 5.4 | Provider utility 1-c; abstainer utility t; cutoff t=1-t=1/2. |
| 5.5 | Pointwise rival-bid comparison supports weak dominance with equal split at ties. |
| 5.6 | Profit 2b(v-b), derivative 2v-4b; b=v/2; bids above support cannot improve. |
| 5.7 | Integral of (1-z)^2 is 1/3; distinguishes second order statistic from maximum. |
| 5.8 | Eligibility 9≥6>5; price max(6,5)=6. |
| 5.9 | Selection on winning may change valuation; no assertion every winner loses. |
| 5.10 | Risk neutrality is substantive for benchmark equivalence; unit/name changes are not. |
| 6.1 | Type-weighted message masses both 1/6; posterior 1/2. |
| 6.2 | Off-path 0/0 does not impose Bayes posterior; action optimality still required. |
| 6.3 | Invest value 5μ-2; threshold 2/5 with equality included. |
| 6.4 | H:3>1, L:1>0; both signals positive probability and beliefs separating. |
| 6.5 | Pooling wage 2.5; off-path wage 1, deviations -1,-3. Weak PBE qualification explicit. |
| 6.6 | Low type imitation 2>1 invalidates separation despite high-type IC. |
| 6.7 | Low-state sender mimics high-state message; not a generic impossibility of cheap talk. |
| 6.8 | Sequential consistency uses limits of completely mixed profiles, not full support at the limit. |
| 6.9 | Any ε>0 on R makes U=1>D=1-ε; DL fails perfection though U only weakly dominates D originally. |
| 6.10 | L cannot improve on equilibrium 2 under any response; H can earn 3 if inferred and Invest follows. Intuitive criterion rejects specified pooling. |

No runtime files, activation imports, commits, or Agent Log entries were changed by this authoring subtask. Parent owns final integration and Agent Log.
