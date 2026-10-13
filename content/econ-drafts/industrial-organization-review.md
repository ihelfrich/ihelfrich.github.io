# Industrial Organization draft review

Reviewed 2026-10-13. This is an authoring self-review, not independent approval or activation.

## Inventory and scope

60 original single-best-answer items, exactly 10 in each of six units. Every item remains `reviewStatus: draft`. Units cover (1) market power, demand and cost; (2) Cournot, Bertrand and Stackelberg; (3) differentiation, search and advertising; (4) entry, dynamic competition and collusion; (5) discrimination and vertical relations; and (6) regulation, mergers and platforms.

The questions use undergraduate/intermediate algebra, incentives and interpretation. The curriculum anchor is MIT's official [Industrial Organization I calendar](https://ocw.mit.edu/courses/14-271-industrial-organization-i-fall-2022/pages/calendar/), opened during authoring. This is a graduate syllabus used to establish field coverage; these questions deliberately exclude its graduate estimation methods. Sources support topic provenance, not the invented scenarios or quantitative answers. All examples are constructed, and no item asserts an empirical finding or a current legal rule.

33 items involve substantive quantitative reasoning (including two numerical price/arbitrage comparisons): u1: 01,02,04,07,08,10; u2: 01,02,05,08,09,10; u3: 01,02,03,05,07; u4: 01,02,04,08,09; u5: 01,02,03,05,06,07,10; u6: 01,02,04,06. The other 27 assess assumptions, interpretation or mechanisms.

## Review performed

Read all 60 keys and all 180 distractors against the maintained assumptions. Checked that alternatives are distinct, that the key answers the actual question, and that conceptual items do not turn a possible mechanism into an unconditional prediction. Numeric distractors reflect wrong denominators, omitted opportunity costs, transfer/resource confusion, timing errors or the wrong strategic model. Negative distractors were retained only where they identify a particular misconception.

Executed 35 numerical equality checks plus free-entry inequalities and the collusion incentive inequality using a bounded local Python check. All passed. Coverage includes monopoly output, margins, welfare, fixed-cost duplication and tax pass-through; quantity games and price responses; spatial indifference, search, switching, quality and advertising; entry, collusion and incremental investment; two-part tariffs, screening, vertical pricing and bundling; regulation, HHI and the stated merger screen. JSON validation passed: 60 unique identifiers, ten records per unit, three wrong options and four distinct options in every record, populated required strings.

Correction made during review: u5-01 now explicitly requires *strictly positive* common marginal cost. Without that restriction, the elasticity-based comparison does not justify the stated strictly higher price under the interior formula. Other assumption protections were built into the draft: tie acceptance for surplus extraction/bundling, interior equilibria for cost responses, capacity and tie rules for Bertrand, no binding commitment for the entry threat, a unique stage equilibrium for finite repetition, and a stated total-surplus criterion for merger welfare. The merger screen explicitly is not a predicted equilibrium price change.

## Candidate parameter families

Good candidates, after independent content review, are linear monopoly output/pass-through; Cournot best responses and equilibrium; Stackelberg leadership; spatial indifference; one-step search; advertising contribution; integer entry; grim-trigger incentives; two-part tariffs; incentive-compatible menu prices; successive monopoly; bundle-versus-separate revenue; regulated deficit/break-even checks; HHI changes; and the explicitly defined merger screen. Do not vary parameters unless interior solutions, feasible shares, credible timing, strict answer separation and unchanged economic regimes are checked. Search gains should avoid accidental equality; spatial cutoffs must stay inside the line; entry counts require adjacent-integer inequalities; collusion thresholds must lie in [0,1); bundling requires recomputing optimal separate prices.

Several related items intentionally connect methods without being coefficient variants: Cournot levels versus response slopes versus asymmetric costs; vertical double marginalization versus integrated pricing; entry NPV versus endogenous integer entry. These should not be inflated into an inflated family count merely because they have distinct identifiers.

## Remaining gates and limitations

No independent second reviewer, learner calibration, browser rendering, accessibility review or answer-order audit has been performed here. Difficulty is author judgment. One official curriculum anchor does not establish exhaustive curriculum coverage. Parent integration owns activation and any shared code changes. No variants were generated, no shared code was edited, and no commits were made.
