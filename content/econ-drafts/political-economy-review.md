# Political Economy draft review

Status: draft only. Sixty original constructed questions, six units of ten. No runtime, tests, release configuration, activation, or existing course files changed. Parent session owns the Agent Log.

## Curriculum evidence

Both official syllabi were opened and read through the web tool on 2026-10-12. They guide topic coverage; neither supplies these questions, answer choices, numerical examples, or hypothetical findings.

- MIT, Benjamin Olken, *14.75 Political Economy and Economic Development*, Fall 2012: https://ocw.mit.edu/courses/14-75-political-economy-and-economic-development-fall-2012/pages/syllabus/ . Verified voting, agency, commitment, collective action, conflict, corruption, and empirical-method coverage.
- Harvard, Vincent Pons and Jesse Shapiro, *Political Economy of Electoral Democracies*, Spring 2024: https://shapiro.scholars.harvard.edu/sites/g/files/omnuum7731/files/shapiro/files/syllabus.pdf . Verified legislative behavior, collective choice, elections, information, redistribution, special interests, and close-election identification coverage. The syllabus is explicitly preliminary; its role here is curricular orientation.

All items list these course-level source URLs. They are provenance for curriculum scope, not citations claiming the hypothetical numerical results occurred in either course or in reality.

## Content and option audit

Reviewed all 60 prompts, keys, 180 distractors, hints, and explanations for one defensible correct answer under the stated assumptions. Checked ordered preferences, majority counts, electoral ties, private versus social marginal returns, thresholds, continuation payoffs, enforcement, equilibrium deviations, and causal estimands. Mathematical conclusions are conditional on the specified models. Observational correlations are not presented as identified causal effects. No political party, actual politician, or partisan factual claim is used. Normative objectives appear only when explicitly defined, such as maximizing summed utilities or total monetary surplus.

- Unit 1: ten questions on majority cycles, median voting, single-peakedness, sincere agendas, plurality, Borda, unanimity, Arrow’s domain, supermajorities, and strategic ballots. Sincere versus strategic voting is specified separately; strict passage rules are explicit.
- Unit 2: ten questions on commitment, citizen-candidates, participation, probabilistic responsiveness, spatial votes, valence, entry, seats, selection, and information acquisition. Downsian convergence is stated with office motivation, binding platforms, and a unique median; it is not generalized to all elections.
- Unit 3: ten questions on free riding, welfare, coordination, selective benefits, concentrated interests, contest effort, resource loss, repeated cooperation, penalties, and endogenous lobbying access. Transfers are distinguished from real costs; punishments are stipulated credible.
- Unit 4: ten questions on effort, term limits, Bayesian competence, selection, noise, audits, careers, pooling, randomized publication, and pandering. Terminal-term claims explicitly exclude other future rewards; detected outcomes and latent behavior are distinguished.
- Unit 5: ten questions on hold-up, enforcement, veto players, bargaining, effective constraints, persistence, delegation, common-pool spending, and endogenous institutions. Strict versus weak acceptance and one-round proposal rules prevent bargaining ambiguities.
- Unit 6: ten questions on conflict bargaining, future commitment, opportunity costs, two redistribution models, regression discontinuity, difference-in-differences, exclusion, spillovers, and detection measurement. Identification assumptions and local scope are explicit; no spillover-bias direction is asserted without assumptions.

## Executed checks

A bounded standard-library Python check verified: JSON parsing; exactly 60 items; 10 per unit; unique IDs; three distinct distractors per item, all different from the key; nonempty hints and explanations; draft and constructed metadata. Executed arithmetic checks covered Borda totals (12, 11, 7), turnout net benefit (−0.5), incumbent effort net gain (1.8), Bayesian posterior (0.8), expected penalties (−3, 4, −4), contest best response and sampled deviations (25), repeated-game threshold (1/2), conflict outside options (50 and 25), mean income (50), district vote average (37.3333%), and difference-in-differences (7 points). All passed. Remaining analytic comparisons and distractors were reviewed directly, including the spatial midpoint, private/social contribution derivatives, veto intersections, quadratic policy preferences, and common-pool marginal cost.

## Corrections during drafting

An initial Borda profile with bloc counts 4, 3, 2 accidentally tied A and B at 10. Before completion it was replaced with counts 5, 3, 2, and the prompt, answer, distractors, and explanation were updated together. Executed scores now yield the unique winner A with 12 versus B’s 11 and C’s 7. No unresolved key or option defect was found in the completed self-review.

This is author self-review, not independent expert approval. The files remain drafts for parent review; nothing is activated.
