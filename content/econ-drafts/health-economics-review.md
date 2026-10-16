# Health Economics draft review

Status: draft only. Sixty original multiple-choice questions, six units of ten. No runtime files, tests, navigation, or activation were changed. All numeric cases are constructed; these are economic education exercises, not treatment recommendations.

## University syllabus provenance

Verified by opening these official university sources on October 12, 2026:

- UC Davis, Colin Cameron, ECN 132 Health Economics, Spring 2023: https://cameron.econ.ucdavis.edu/e132/e132syl_S23.html . The course outline covers risk pooling, risk aversion, moral hazard, adverse selection, economic evaluation, Grossman health demand, physicians, hospitals, pharmaceuticals, and government roles.
- University of Chicago, Introduction to Health Economics, PBHS 38010/28010 and PPHA 38290, Winter 2018: https://harris.uchicago.edu/files/intro_to_health_economics_syllabus_winter_2018_draft.pdf . The official two-page syllabus covers health demand, Grossman, socioeconomic disparities, insurance, selection, provider supply, hospitals, technology assessment, and health externalities. The filename labels this historical syllabus a draft; it is used as a scope reference, not as a current course policy.

Both institutions are R1 research universities. Sources establish curricular alignment. They are not sources of the numerical scenarios, questions, answer choices, or asserted empirical effects. No source examinations were used.

## Review performed

Read all sixty stems, keys, distractors, explanations, and hints for single-key validity, economic assumptions, and unit consistency. Conceptual items distinguish financial incentives from guaranteed behavior; observed associations from causal effects; utilization from welfare; marginal from average cost; and cost-effectiveness from affordability. No empirical magnitudes, current legal rules, or clinical claims are asserted.

Structural validation passed: 60 unique ordered IDs, 10 questions per unit, exact field-name agreement with financial-economics.json, three distinct distractors and a distinct key for every item, populated hints, draft reviewStatus, and constructed scenarioType. The outline reproduces the question topics.

Executed 29 arithmetic assertions covering stock transitions, replacement investment, time cost, elasticity, expected claims, pooling, cost sharing, pooled premiums, margins, input costs, marginal costs, opportunity-cost differences, reimbursement, HHI and merger changes, spending per unit, ICER, net monetary benefit, QALYs, discounting, extended dominance, threshold gain, assignment effects, external benefits, equity weights, and expenditure shares. All passed with a numerical tolerance of 1e-10 where appropriate.

## Corrections and qualifications

- u3-10: replaced an incorrectly described $40 distractor with “$40, the difference between the alternatives.” This now tests the distinction between opportunity cost ($130) and loss relative to the forgone alternative ($40).
- u4-09: parent review identified a second possible answer to the negative stem in the original distractors. Replaced the three distractors with algebraic implications of marginal-cost pricing, leaving recovery of sunk development expenditure as the sole nonguaranteed outcome. This avoids relying on unstated efficiency assumptions.
- u6-07: strengthened “reduces variation” to “mean-preserving contraction of consumption risk.” A smaller variance alone need not establish an expected-utility ranking for every concave utility function.
- u1-07 fixes the return schedule and states an interior solution; u1-08 identifies only the wage-return channel, not an unconditional comparative static.
- u2-08 does not equate additional utilization with waste. u3-04 and u4-04 describe potential incentive problems without claiming observed misconduct.
- u5-08 explicitly allows mixtures; u6-08 states the exercise-specific catastrophic-spending definition rather than implying a universal threshold.

Remaining gate: instructor/editor approval and any release checks required by the parent task. Self-review and parent feedback do not change draft status.
