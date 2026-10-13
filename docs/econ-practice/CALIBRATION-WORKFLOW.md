# Calibration workflow

The executable pipeline produces candidate models and diagnostics. It does not approve models, infer student identities, or turn a provisional score into an AP score prediction.

## Data preparation

Export the private response ledger using the authenticated instructor endpoint and retain all pages. Place real response exports outside the public site source, using a private working directory. Do not commit exports, group files, individual scores, or fitted person parameters.

Run `node scripts/econ-practice/prepare-calibration.mjs INPUT.json PRIVATE_OUTPUT ap-micro 2 BANK_VERSION`. The course, unit, and bank version must match the intended construct and item snapshot. The manifest records the input checksum, exclusions, screening thresholds, item counts, response times and observed answer distributions. Missing responses remain missing. Only a person's first eligible assessment occasion is used; repeated learning sessions are not concatenated into one trait measurement.

Initial screening requires 300 persons, 100 observations per retained item, at least three responses per person, five variable items, and connected item coadministration. These are implementation screening defaults, not universal sample-size requirements. Study-specific simulations and sensitivity checks determine adequacy. Passing screening does not authorize operational scoring.

## Candidate fitting

Install R packages `mirt` and `jsonlite` from CRAN. Run `Rscript scripts/econ-practice/calibrate.R PRIVATE_PREPARED PRIVATE_OUTPUT`. It fits unit-level 1PL and 2PL candidates, estimates parameter covariance, examines S-X² with multiplicity adjustment and adjusted Q3 residual correlations, and evaluates predictions in a separate person holdout.

For each held-out item, the prediction conditions only on the person's other responses. The item being predicted is excluded from the posterior used to predict it. The pipeline reports log loss, Brier score and calibration bins. An unavailable diagnostic is recorded as unavailable, not passed. With sparse adaptive patterns, S-X² may be unavailable after complete-case removal; that limitation needs a design-appropriate item-fit analysis before approval.

Run `Rscript scripts/econ-practice/dimensionality.R PRIVATE_PREPARED PRIVATE_OUTPUT` to compare one- and two-dimensional exploratory candidates. Nonconvergence is explicit. The routine checks whether the design contains coadministered sibling items. A first-family-exposure design generally cannot identify a testlet effect; the report does not claim one was estimated.

## Optional DIF analysis

Use only voluntarily supplied group data authorized for this purpose. The group file contains the prepared person key, group, and consented flag. A separate anchor file lists at least three substantively justified item IDs, one per line. Anchors must be examined for contamination; their mere inclusion is not evidence of invariance.

Run `Rscript scripts/econ-practice/dif.R PRIVATE_PREPARED PRIVATE_GROUPS.csv PRIVATE_ANCHORS.txt PRIVATE_OUTPUT.json`. The model frees focal-group latent means and variances while holding reviewed anchor parameters equal. Non-anchor slope/intercept tests use likelihood-ratio comparisons with Benjamini–Hochberg adjustment. Minimum group counts are screening only. Review effect sizes, convergence, selection, power and substantive content before interpreting a flag as bias. No sensitive group is inferred from names or browsing data.

## Reproducible synthetic checks

- `node scripts/econ-practice/simulate-calibration.mjs` prepares 1,000 synthetic persons with twelve known 2PL items.
- `Rscript scripts/econ-practice/calibrate.R .local/econ-calibration/synthetic .local/econ-calibration/synthetic-fit` tests fitting and held-out predictions.
- `node scripts/econ-practice/simulate-cat.mjs 30` compares adaptive and randomized selection at seven known trait values, including bias, RMSE, interval coverage, exposure and stopping length. Thirty replications per point are a smoke test, not adequate operating-characteristic validation.
- `Rscript scripts/econ-practice/simulate-dif.R` creates a synthetic grouping fixture with both a group trait-distribution difference and a known item difficulty shift. Run `dif.R` against its generated inputs to check conditional DIF detection.

Synthetic reports carry an explicit flag. They cannot authorize operational calibration. The first CAT smoke test showed substantial shrinkage and undercoverage at trait extremes; this remains an open validation finding, not a passed criterion.

## Review and activation

Run `node scripts/econ-practice/validate-candidate.mjs REPORT.json BANK_VERSION REVIEW.json` to check whether evidence is assembled for instructor review. A review identifies the reviewer, time, matching source hash, and evidence/rationale for content, dimensionality, local dependence, item fit, fairness, CAT simulation, linking, and score interpretation. A justified not-applicable decision is possible; missing evidence is not acceptance.

The validator emits `reportSHA256` using `sorted-json-sha256-v1`: recursively sort object keys, preserve array order, serialize finite JSON, then hash the UTF-8 bytes with SHA-256. This is a content hash, not the hash of the report file's whitespace. The review must include that exact `reportSHA256`, along with `model`, `bankVersion`, `course`, `unit`, a valid `reviewedAt`, reviewer identity and matching 64-character hexadecimal `sourceSHA256`. Changing any parameters, diagnostics or report metadata invalidates the existing review. Obtain a fresh review for the changed report; do not mechanically copy a new hash into an old review.

The validator leaves status as candidate even when the review is complete. Hash binding detects changes; it does not authenticate the reviewer or establish that the evidence is adequate. Actual immutable operational registration, authenticated activation and model rollback integration are still to be implemented. No fitted model is currently in production.

## Descriptive item screening

Instructor downloads contain scored-response ledger `rows` and a separate `unscoredSubmissions` array for valid submissions rejected by sequencing, answer-lock, or event-ID rules. Preparation consumes only `rows`; do not merge the separate array into a response matrix. These records are retained for answer-history completeness, never as additional scored attempts or calibration evidence.

Assistance and attempt metadata must be explicit: `hints_used` is a nonnegative safe integer, `feedback_before_answer` is a numeric 0/1 or boolean, and `attempt_number` is a positive safe integer. Missing, null, string-coerced, or otherwise invalid values are excluded under `invalid_assistance_metadata` or `invalid_attempt_metadata`; they never establish unassisted first-attempt evidence. Valid assisted and repeated responses retain their separate exclusion reasons.

The preparation manifest now includes `diagnostics.items`. These describe eligible first-family, unassisted responses from one occasion per person after the minimum-person-response screen, before sparse/constant items are removed. Each item reports observed and retained-matrix counts separately, sample facility, a working-binomial Wilson95% interval, constant-response flag, active-time and selection-probability distributions, and raw response frequencies. Raw response codes are not labeled distractors without matching the item format/key.

Keep the manifest private. Facility depends on who adaptively received an item; its interval does not adjust for adaptive selection, clustering or calibration-parameter uncertainty and is not a population or IRT-difficulty estimate. Missing/invalid timing values are counted separately, never converted to zero. An all-correct item remains in diagnostics even though it fails candidate-fit screening. No diagnostic automatically approves an item or model.
