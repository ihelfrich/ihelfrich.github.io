# Field-course release review

Bank 2026.10.12.18 includes 30 introductory econometrics, 30 labor economics, and 30 public economics questions, each an original singleton family. These are selected introductory/intermediate topics, not complete field coverage. Source files retain their authoring status; separate byte-pinned release manifests authorize the exact reviewed contents. Build checks reject changed source bytes or mismatched inventories.

The parent reviewed every prompt, correct option, distractor and explanation after the authors’ self-reviews. Econometrics corrections specify a nonconstant outcome for R-squared rescaling and textbook conditions for prediction intervals. Labor corrections narrow the wage substitution question to a within-period leisure-consumption model and make sharp training receipt explicit. Public economics corrections require interior provision choices for the spillover comparison and state-independent concave consumption utility for the insurance comparison.

Fourteen arithmetic checks passed: childcare, phaseout, marginal hiring profit, elasticity, competitive wage floor, training NPV, monopsony, steady-state unemployment, difference-in-differences, Wald estimate, weighted welfare, tax equilibrium, deadweight loss and public marginal benefits. A separate employment grid from 0 to 30 in steps of 0.01 confirms the monopsony minimum-wage optimum at 15. All 137 unit tests and the 131-page static build pass. Browser inspection confirms the seven course names in the curriculum directory. Full authenticated student flows have not been reverified for these additions.

Review remains provisional, not empirical calibration or external expert approval. Seeded difficulty is not a measured item parameter. No student response evidence establishes discrimination, dimensionality, invariance, distractor functioning or learning effectiveness. The platform-wide target remains more than 5,000 useful active questions with broader formats and deeper field coverage.

## Guidance and coverage follow-up

All 90 released field items now have question-specific method hints (topic-scaffolds-v6), authored separately from answer keys. Prompt review corrected two econometrics scaffolds: the residual item uses the supplied fitted value rather than a nonexistent regressor value, and the prediction comparison uses validation loss without incorrectly requiring validation to be separate from model selection. Hint requests retain the existing practice-only restrictions and server event ledger.

The public curriculum directory now discloses active item and family counts and unit counts per course. Browser inspection exposed field-registration duplication after development hot reload: source-module re-evaluation appended to a surviving bank registry. Field registration now validates and replaces the owned courses, preserving deterministic order. A regression test reimports the module and compares every item ID in order. Browser verification confirmed 30 labor questions, 30 families and five items per unit after the fix. New drafts for other fields are excluded from these active counts.

## Industrial Organization release — bank 2026.10.12.19

Released 60 singleton questions, ten per unit, after parent review of every prompt, key, distractor and explanation. Corrections require positive Bertrand demand at cost and a credible punishment equilibrium for collusion; clarify the two-part tariff profit objective; remove dependence on a preceding question; limit the spatial example to an indifference location rather than an unstated customer distribution; and make the merger welfare setting explicit. Two firm-count explanations now spell out the calculation rather than leave a symbolic expression implicit.

Every IO question has a separate authored method hint in topic-scaffolds-v7. An additional executable numerical review checks pricing, quantity games, welfare, entry inequalities, the collusion threshold, vertical pricing, bundle revenues, concentration and the stipulated merger screen. All 141 tests pass, structural audit has zero errors/warnings, and the static build produces 131 pages. Browser inspection confirms 60 IO questions and ten in each unit. Bank total is 2,589 questions / 382 families across eight courses. Trade and development remain unactivated drafts pending parent review. These checks do not establish empirical calibration or full authenticated student-flow validation.

## International Trade release — bank 2026.10.12.20

Released 60 singleton questions after parent review of every prompt, key, distractor and explanation, with ten questions in each of six units. Clarified proportional wage/price comparisons, the fixed other-good price, specific-asset complementarity, absolute demand elasticity, nondistortionary subsidy financing, exponentiated fitted log trade, fixed remaining-stage input use, and the hypothetical nature of the final evidence comparison.

All 60 have authored method hints (topic-scaffolds-v8). Independent executable numerical checks cover costs and comparative advantage, consumption after trade, specific-factor allocation, exact real income, factor prices/content, scale and selection arithmetic, tariff/quotas, effective protection, gravity and offshoring. The byte-pinned release manifest matches the reviewed source. All 143 tests and the 131-page build pass; structural audit has zero errors/warnings. Browser verification shows 60 trade questions with ten in every unit. Active bank total: 2,649 items / 442 families across nine courses. Development Economics remains a 60-item draft pending parent review. Calibration and full authenticated browser-flow validation remain separate incomplete gates.

## Development Economics release — bank 2026.10.12.21

Released 60 singletons after full parent review of prompts, keys, distractors and explanations. Corrected the irrigation explanation to distinguish its two pure equilibria from the additional mixed equilibrium. Added no-defiers for the scholarship-completion comparison, specified net farm income rather than receipts, held household prices/opportunities fixed, used common-price real value added, included repayment in the stated total audit penalty, and clarified package-trial follow-up and spillovers. Removed repetitive hypothetical prefixes from abstract constructed scenarios; empirical-style examples retain explicit hypothetical labels. All 60 records carry constructed-scenario metadata.

All questions have authored method hints in topic-scaffolds-v9. Numerical review checks poverty measures, asset dynamics, lending, certainty equivalents, farm margins, irrigation best responses and mixing, schooling, migration, reallocation, ITT/LATE/DiD and audit deterrence. All 145 tests and the 131-page build pass; structural checks report no errors or warnings. Browser confirms ten questions per unit. Active bank now 2,709 items / 502 families across ten courses. All three recent 60-item batches are integrated, but course depth, additional disciplines, graph and multi-step task coverage, operational calibration and deployment remain incomplete.

## IO numerical extensions — bank 2026.10.12.22

Activated 256 numeric items across 16 existing IO families, with 80 diagrams and exact variant-specific hints. Reviewed monopoly quantity/Lerner/DWL/tax pass-through, Cournot, spatial indifference, advertising contribution, entry NPV/integer entry, grim-trigger incentives, menu IC, successive/integrated monopoly, utility deficit, HHI and a stipulated merger incentive screen. Preserved explicit assumptions and avoided treating a screen as an equilibrium price prediction. Source bytes and extension bytes are separately pinned.

Independent prompt-parsed checks reconstruct all 256 saved answers. Browser review covered representative diagrams in all five graphical families; initial isolated harness lacked the application's curve styling, so it was corrected before judging rendering. No application renderer defect was found. The temporary harness was removed. All 148 tests, structural audit, review reconciliation and 131-page static build pass. Review remains provisional content review, not empirical calibration or external expert validation.

## Trade numerical extensions — bank 2026.10.12.23

Released 256 numeric variants across 16 existing trade families, with 64 diagrams and exact variant hints. All 256 serialized answers pass independent prompt-parsed calculations. Assumptions, formulas and explanations reviewed in the preceding checkpoint. Reviewed representative final variants for all four graph families in browser. This caught an overlap between six-digit dollar ticks and the vertical axis title; the shared renderer now sizes its left margin from tick-label length, with a regression check. Corrected rendering was visually verified and saved in trade-variants-diagram-proof.png. Temporary review page removed before build.

Active inventory is 3,221 items / 502 families; trade is 316 / 60. Exact expansion bytes are pinned in the release manifest. All 150 tests and review reconciliation pass, with no bank audit errors or warnings. No empirical calibration or production deployment is implied; full authenticated student-flow testing remains separate.

## Development numerical extensions — bank 2026.10.12.24

Released 256 variants across 16 existing development families, including 32 diagrams. Parent review covered poverty headcount and poverty gap, inclusive asset thresholds, stable asset dynamics, risky lending, certainty equivalents, marginal agricultural profit, transport pass-through, schooling opportunity cost, migration, sectoral employment/productivity, ITT, LATE, DiD and audit deterrence. Questions explicitly distinguish constructed scenarios from empirical findings. Causal questions retain their identifying assumptions. Audit-payment questions include restitution in the stated payment rather than double-counting it.

A separate test reconstructs all 256 answers from saved prompts; all pass within 1e-7. Representative final variants for both diagram families inspected visually with the application renderer; labels and intersections are readable (development-variants-diagram-proof.png). Source bytes pinned, exact variant hints registered, family IDs preserved. The temporary browser review page was removed before build. Active inventory: 3,477 items / 502 families; development 316 / 60. These are provisional content-reviewed items, not calibrated parameters or independent new families.

## Runtime review gate hardening

The browser-safe registration gate now explicitly validates base review status, hash syntax, course membership, unique base IDs, exact unique reviewed-ID membership, and corresponding extension evidence before mutating the family registry. Previously base review status was carried through without an explicit runtime approval check, and duplicate entries appended to reviewed-ID arrays could evade set-size-only checks. Regression cases now reject these states. This is an inventory/status gate; only the existing build audit verifies hashes against actual file bytes, and neither mechanism substitutes for substantive review. Active bank content and hash are unchanged.

## Financial content review checkpoint (not activated)

Parent inspected all 60 financial-economics prompts, keys, distractors, explanations and hints. Requested explicit positive strike in the American-call early-exercise item and replaced social-welfare language with total financial value in the debt-overhang explanation. Independent regression checks now cover 41 numerical keys plus portfolio hedge/diversification results. All checks pass. Author is completing final self-review and those wording corrections; source pinning and runtime integration must wait for the final saved version. Behavioral course has delivered 60 draft items with author review; independent parent review remains pending.

## Financial Economics — bank 2026.10.12.25

Activated 60 distinct reviewed families across discounting/fixed income, portfolios, asset pricing, derivatives, information/efficiency and corporate finance. Both requested parent corrections verified in final source. Individual method hints extracted into the hint registry; source bytes pinned. Parent numeric test covers41 numerical keys plus two portfolio results; author reports47 arithmetic assertions. All156 tests pass including six-unit selection coverage and stable reload registration. AP Micro remains the default first course. Inventory is3,537 active items/562families across11courses. Authenticated student/instructor browser verification of this course remains outstanding; no empirical calibration or deployment claimed.

## Behavioral Economics — bank 2026.10.12.26

Parent reviewed all60 prompts, keys, distractors, explanations and hints. Corrected four assumptions/standalone issues: explicit quasi-hyperbolic evaluation in preference reversal; restated guessing-game rules instead of referring to a previous item; clarified randomized announcement versus control; added well-defined treatment/no spillovers to LATE. Questions distinguish models from empirical claims and behavioral changes from welfare judgments. Independent numeric/inequality checks cover loss valuation, present bias/commitment, Bayesian updating, social preferences, logit learning, causal estimates and welfare arithmetic.

Activated60 distinct families and exact hints in six units. Byte-pinned release and158tests pass; bank/review audits show zeroerrors. Inventory3,597items/622families/12courses. Browser/authenticated flow verification remains separate; no empirical calibration or production deployment claimed.

## Environmental and Resource Economics — bank 2026.10.12.27

Parent reviewed all60 prompts, keys, distractors, explanations and hints. Clarified that the instrument-equivalence cap uses competitively traded permits and that DiD assumes no anticipation. Removed the repeated opening phrase from each question while retaining constructed-scenario metadata and explicit hypothetical-study wording where needed. Independent checks cover21 numerical keys plus cost allocation, leakage, rebound, forest timing, DiD and cost-effectiveness. Activated60 distinct families with exact hints and source-byte release evidence. Inventory3,657items/682families/13courses. Production deployment, empirical calibration and authenticated browser flow verification remain separate gates.

## New field directory browser verification

Browser inspection of the actual local curriculum page confirms Financial Economics, Behavioral Economics and Environmental and Resource Economics each show60questions/60families and six correctly named units with10questions each. Native disclosures expand successfully; the environmental view screenshot is saved as new-fields-coverage-proof.png. This verifies visible directory integration, not authenticated student sessions, instructor permissions or production deployment. New bounded agents are drafting60families each for health, political and urban economics; they have no activation authority.

### Health, political economy, and urban economics release

Bank 2026.10.12.28 adds 180 original questions in 180 families across three six-unit courses. The active bank now contains 3,837 questions and 862 families across 16 courses. Authors researched official university syllabi and reviewed all records; the parent independently reviewed every prompt, key, distractor and explanation. Parent checkpoints document corrections and independent arithmetic/model checks. Private family hints accompany every new item. All parameters remain provisional; content review is not empirical calibration or exhaustive disciplinary coverage. The full check suite passes 169 tests and the bank audit reports no errors or warnings.

### Advanced micro, advanced macro, and game theory release

Bank 2026.10.12.29 adds 180 original questions in 180 families. Active totals are 4,017 items / 1,042 families / 19 courses. Official MIT, Berkeley and Yale course sources inform these collections. All 180 records received author and independent parent content review; source hashes match the reviewed artifacts. Corrections specify theorem assumptions, model timing, nonnegative auction values, and approximation conventions. Private hints v17 accompany every new item. Advanced-course levels are visible in the curriculum directory. The full check suite passes 176 tests, with no bank-audit or review-reconciliation errors. Parameters remain provisional; review does not establish empirical calibration, universal curricular coverage, or operational deployment.

## Monetary, international macro and causal inference release — 2026.10.13.30

Activated 180 independently reviewed questions: 60 each in Monetary Economics, International Macroeconomics, and Causal Inference and Applied Econometrics. Course titles, six-unit outlines, prerequisites and private method hints are integrated. Each source item matches its parent-review fingerprint; release manifests bind the source file bytes. Hint version is topic-scaffolds-v18.

The active bank has 4,197 items across 22 courses and 1,222 families. This remains below the requested total exceeding 5,000. Parent review includes 38 monetary, 39 international macro and 19 causal numerical/model checks. Assumption and answer-choice repairs are recorded in the course checkpoints. Parameters remain provisional, with no empirical calibration or claim of exhaustive disciplinary coverage.

Verification: 180 automated tests pass; bank audit reports zero errors and warnings; review reconciliation reports zero errors; production site build generates 131 pages successfully. This release has not been deployed to production Cloudflare and does not establish authenticated end-to-end browser behavior.

## Education, growth and contracts release — 2026.10.13.31

Activated 180 reviewed questions: Economics of Education, Economic Growth, and Information and Contract Theory, each with 60 families. Added six-unit course outlines, prerequisite levels and private method hints (topic-scaffolds-v19). All released source items match their independent parent-review fingerprints. Review included 41 education, 40 growth and 31 contract checks; the contract multitasking defect and growth parameter-domain omissions were corrected before release.

Active bank: 4,377 items, 1,402 families, 25 courses. The >5,000 target remains incomplete. All185 automated tests pass; bank audit and review reconciliation have zero errors; production site build succeeds with131 pages. Content approval remains distinct from empirical calibration, and all new parameters remain provisional. No production deployment or authenticated browser verification is implied by these checks.

## Statistics, Advanced Econometrics and Market Design — bank 2026.10.13.32

Released 180 singleton families after author and parent review, bringing the active bank to 4,557 questions, 1,582 families and 28 courses. Each new course has six units with ten questions each, explicit prerequisites and private practice hints in topic-scaffolds-v20. Source-byte manifests and per-item parent-review hashes bind the released records.

Parent checks include 45 statistics calculations/design checks, 36 advanced-econometrics calculations and conditional-likelihood checks, and 20 market-design allocation/incentive checks. Review repaired a missing Gaussian measurement-noise assumption, replaced a repeated Cauchy example with a Lindeberg counterexample, clarified a guaranteed matching-market lower bound, and made sample-size notation explicit. Integration clarified the Cauchy explanation without changing its mathematical claim.

All 191 tests pass; the full structural bank audit reports zero errors and warnings; review reconciliation reports 232 legacy self-reviewed and 1,350 authored/parent-reviewed provisional families, with no reconciliation errors. The static build produces 131 pages. These checks do not establish empirical item calibration, authenticated end-to-end browser behavior or production deployment. More than 5,000 active useful questions and broader discipline coverage remain required.

## Law, Economic History and Empirical Macroeconomics — bank 2026.10.13.33

Released 180 singleton questions across three courses after author and parent review. Active bank: 4,737 items / 1,762 families / 31 courses. Each course includes six units, prerequisites and private authored hints (topic-scaffolds-v21). Review checkpoints bind every released record; manifests bind exact source bytes.

Parent verification records 48 law checks, 37 history checks and 24 empirical-macro checks. Revisions include complete expenditure-component accounting, Gaussian measurement-noise assumptions, a VAR variance decomposition replacing repetitive arithmetic, and distinct historical production/organization cases. Final demographic, portfolio and archival wording changes were rereviewed; additional macro measurement citations were verified to change sources only.

All 202 tests pass. Structural audit and review reconciliation report no errors; build produces 131 pages. Questions retain provisional psychometric parameters. Authenticated browser behavior and production deployment have not been established by these checks. The >5,000-item and broader coverage requirements remain open; principles courses and history of thought are being authored separately.

## Principles courses — bank 2026.10.13.34

Released 60 Principles of Microeconomics and 60 Principles of Macroeconomics questions under separate general undergraduate course titles. Both use fresh non-calculus scenarios and have source outlines, author self-reviews, full parent reviews and byte-pinned release manifests. Micro review verified 28 numerical/strategic checks and clarified unchanged equilibrium quantity, otherwise-identical job attributes and future money versus purchasing power. Macro review verified 24 numerical checks; final appended primary banking citations were checked without accepting unreviewed question changes. Method hints are private, version topic-scaffolds-v22.

Active inventory is 4,857 items / 1,882 families / 33 courses. All204 tests pass; bank audit has zero errors/warnings; review reconciliation has zero errors; static build completes131 pages. Parameters remain provisional and these checks do not establish empirical calibration or authenticated browser behavior.

## History, mathematical and computational economics — bank 2026.10.13.35

Released180 singleton questions across three new general course titles after author and parent review. History includes primary-text attribution checks and32 independent calculations; parent corrected sufficient versus necessary monetary restrictions and reviewed the quasilinear compensation clarification. Mathematics has39 parent checks plus author symbolic verification; computational economics has36 parent checks plus40 author calculations. Integration removed an unexplained iteration index and expanded one terse hint. Exact source and item hashes record the reviewed versions; hint version is topic-scaffolds-v23.

Active inventory:5,037 questions,2,062 families,36 courses. All207 economics tests and the complete site check chain pass; review reconciliation has zero errors; static build completes131 pages. These are content-review and implementation checks, not empirical calibration or proof of exhaustive economics coverage. Separate focused review identified credential recovery and response-order eligibility defects under repair.
