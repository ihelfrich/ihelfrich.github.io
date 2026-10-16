# Measurement specification

The platform supports formative learning and low-stakes diagnostic assessment. It does not claim an AP scaled score, a standardized percentile, or validated mastery thresholds. Authored parameters are not empirical calibrations.

## Constructs and occasions

Separate course scales and six content dimensions per course prevent treating microeconomics, macroeconomics, and undergraduate extensions as interchangeable. A unit-level posterior is a routing approximation until dimensionality is tested. Topic performance and spaced review are formative indicators, not IRT trait scores. Report sample size, number of distinct families, posterior uncertainty, model version and calibration status together.

Practice includes explanations and repeated attempts. Assessment suppresses feedback until the session ends, samples distinct families, and records first exposure. Never pool coached practice and unassisted assessment as exchangeable evidence of a stable trait. Learning across occasions requires longitudinal models or separate occasion estimates.

## Item construction

Every item has a stable ID, version, family ID, content target, response format, answer key, explanation and authored difficulty. Numeric tolerance is explicit. Parameterized siblings share a family, and their counts remain visible. Family variants are not automatically parallel forms or locally independent items. Review changes produce a new bank version and invalidate incompatible calibrations. Graph interpretation is distinct from producing and labeling a graph; machine-scored graph reading alone does not establish full AP graphing proficiency.

## Initial routing

An author-seeded Rasch response curve (a=1, b=difficulty−2, c=0) supplies a transparent provisional heuristic. It is not fitted IRT. Correct guessing is not modeled by assigning 1/K mechanically to c. Multiple-choice and numeric items require format-aware model checks before linking. A normal prior on an explicit quadrature grid supports EAP estimates and credible intervals, including all-correct and all-incorrect patterns. Boundary mass is monitored. Repeated family exposure and hints do not update measurement posteriors.

Content constraints, family exclusions, randomized selection and recorded selection probabilities accompany information-based selection. Sampling occurs at family level before selecting a variant, so a family with more variants does not receive proportionally greater exposure. First-use diagnostics cover all units. Provisional assessments use a bounded fixed length; precision stopping is enabled only for an approved model and after coverage and minimum distinct-family requirements. Maximum-length stops do not imply adequate precision.

## Calibration and validation gates

1. Freeze an item version and extract server-verified, first-family-exposure, unassisted assessment responses. Retain omissions as missing, not wrong; retain rapid responses with validity flags and run sensitivity analyses rather than quietly deleting them. Record exclusions and data hashes.
2. Examine item response counts, difficulty, discrimination, distractor selection, response time, position effects, missingness, exposure concentration and coverage. Use persons, not response rows, as the independent split unit. Split families too when evaluating generalization to new templates.
3. Fit Rasch/1PL and 2PL candidates with marginal maximum likelihood; only fit guessing or testlet parameters with sufficient identifying data. Check convergence, standard errors, extreme parameters, item/test information, posterior predictive fit and residual dependence. Treat a minimum sample threshold as a screening rule, not proof of adequate calibration. Determine required sample size with simulations matching the planned design.
4. Assess dimensionality and local dependence, particularly within item families and repeated students. Compare unit, multidimensional and testlet models where supported. Do not assume one economics ability explains every item.
5. Evaluate item fit (for example S-X²), residual correlations (for example adjusted Q3), held-out predictive log loss and calibration curves. Evaluate DIF only with suitable voluntarily supplied grouping data, adequate group sizes and multiplicity control. Do not infer sensitive groups from names, IP addresses or browsing behavior. Distinguish statistical flags from substantive bias review.
6. Use anchor items and explicit linking when comparing versions or cohorts. Adaptive missingness and content constraints require appropriate likelihood/design handling; recorded selection propensities support design diagnostics and sensitivity analysis, not a blanket claim that inverse weighting solves all selection bias.
7. Simulate CAT bias, RMSE, interval coverage, test length, content coverage, exposure, stopping behavior and failure cases across the trait range. Compare against fixed-form/random baselines. Check all-correct, all-incorrect, prior sensitivity and boundary behavior.
8. An instructor approves a candidate with documented evidence before operational use. Never automatically promote a fitted model because a script returned successfully. Retain previous models and rollback support.

## Response ledger

Record every submitted attempt, including incorrect answers, retries and answers after feedback. Store the presented item snapshot, selection policy and probability, model version, session mode, hint exposure, timing, first family exposure and server-computed score. Idempotency keys prevent network retries from inflating attempts; the same key with a different payload is rejected. A server receipt establishes persistence. A browser queue alone does not.

Anonymous identity means a pseudonymous browser participant, not a verified unique person. Authentication is required for dependable cross-device linkage. No fingerprinting. Display the collection notice before starting. Instructor access is authenticated and private. Export and deletion procedures must cover linked responses, presentations, sessions and backups according to the adopted retention policy. “Every answer” cannot promise collection before deployment, on other sites, after consent refusal, or when an unsent local queue is destroyed.

## References

- Chalmers (2012), mirt: https://www.jstatsoft.org/article/view/v048i06
- Chalmers (2016), mirtCAT: https://www.jstatsoft.org/article/view/v071i05
- College Board, AP Microeconomics CED, effective fall 2026: https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf
- Cloudflare D1 documentation: https://developers.cloudflare.com/d1/

## Implemented occasion boundary

Engine `content-constrained-v6` stores provisional unit posteriors separately for each session. Assessment routing and report estimates use the requested session only. Reports include the estimation scope and count of eligible measurement responses. A prior-only estimate is possible when a session contains no fresh eligible evidence; it must not be interpreted as demonstrated ability. Lifetime topic summaries remain formative inputs to practice and spaced review. Prior exposure anywhere in the participant history still prevents a repeated family from becoming new binary IRT evidence. Session separation does not itself establish comparability across sessions, fit a learning model, or validate the authored item parameters.

Diagnostic report output now returns `estimate: null` for no eligible evidence and identifies authored-parameter results as `provisional`. It includes model versions and suppresses estimates combining different versions without an established link. An approved-parameter status identifies the parameter source; it is not a blanket claim that every use or interpretation of the resulting estimate is validated. Internal routing may still use the prior before evidence is available.

Engine `content-constrained-v7` additionally rejects posterior updates and assessment information selection when the incoming model ID differs from the model of the existing session/unit posterior. Rejection occurs before learning-state mutation. Legacy state must have recoverable, unambiguous model provenance. This guard depends on immutable model IDs; an operational model registry and explicit version linking/rebuild procedure are still required before calibrated models are activated.
# Measurement replay integrity

Each new presentation retains the exact IRT parameter tuple, parameter status and model ID used during selection (`measurement_parameters_json`, migration 0007). Replay validates and uses this snapshot; it does not replace it with current calibration lookup results. A mismatched model ID or unavailable unknown-model snapshot stops replay. Only legacy author-seeded Rasch v1 records have an explicit reconstruction rule. Instructor exports include the snapshots for audit. Parameter preservation does not itself establish validity, approve a calibration or pin the complete scoring algorithm across software versions.
