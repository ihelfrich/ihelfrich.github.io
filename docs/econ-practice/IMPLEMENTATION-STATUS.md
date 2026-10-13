# Adaptive economics platform: working status

Working root: /Users/ian/Developer/agent-playground/economics-practice
Branch: codex/adaptive-economics
Base site: ihelfrich/ihelfrich.github.io
Agent Log: 3f808471-6405-8177-9fd4-db6c6d4478b3

## User decisions

- Budget below five million tokens; active Codex goal owns continuation.
- Cloudflare Worker plus D1 backend.
- Anonymous practice plus optional sign-in; assigned assessments require verified sign-in.
- Track every submitted answer, including attempts and revisions, with private instructor reporting.

## Implemented locally

- 1,292 AP Micro items / 142 families, 443 AP Macro / 29, 360 college micro / 15, 288 college macro / 12.
- Stable IDs and family metadata, authored numerical and choice items, a small initial SVG graph set.
- EAP grid posterior, IRT probability/information functions, hard initial unit coverage, family-level randomized selection with propensities; provisional versus approved parameter distinction.
- Worker handlers for anonymous profiles, sessions, server-selected presentations, scoring, append-only attempt receipts, idempotency, hints, completion, reports and private instructor exports.
- SQLite adapter exercises the same Worker handlers locally. Local synthetic test data are excluded from git.
- Astro student interface with consent, session selection, numeric/choice inputs, feedback, report download, outbox and explicit retry.
- Teaching catalogue record; full navigation/sitemap integration remains to check.

## Verification evidence

- 32 focused tests pass: item shape/coverage, selected independent economic oracles, IRT math/extreme patterns, family exclusion, calibration gating, API storage/replay/privacy, delayed feedback and private export.
- Astro fast build passes with identity and instructor pages; required whole-site checks and production build remain.
- Browser walkthrough answered consumer-surplus item with 400, saw correct feedback and saved receipt, completed session, and inspected report. Separate SQLite count confirmed one persisted synthetic response.

## Still required (do not claim complete)

- Exercise configured Google sign-in end to end; improve expired credential recovery and unlinked anonymous history restoration. Google JWT verification, one-time challenges, explicit linking, expiring credentials and revocation are implemented and locally tested.
- Browser-review the implemented instructor dashboard and assignments; add pagination and complete assignment lifecycle controls. Membership, opening/closing windows, attempt limits and signed-in gates have server tests.
- Cloudflare deployment configuration/account setup, live database provisioning and end-to-end production verification. No live backend or site deployment exists.
- Complete psychometric validation and operational activation. Calibration, dimensionality, DIF and simulation scripts exist (see continuation below); empirical validation and approval remain outstanding.
- More conceptual variety and graph-production/FRQ support, substantive review of every family and variants, independent answer oracles beyond the current subset, coverage depth and AP exam-format checks. Many current variants only vary numbers and some have invariant answers; the item count is not a count of independently authored conceptual questions.
- Improve adaptive prerequisite remediation and spaced review, long histories/checkpoints (current service refuses >10,000 first attempts), content/exposure constraints and stopping integrated into live service.
- Reliability/security review: session concurrency, transactional hint/response history, server events/timing validation, abuse limits, retention/export/deletion, instructor authorization review, payload and ownership regressions, queue recovery and multi-tab behavior.
- The local development runner now uses development-v2.sqlite with transactional migrations, preserving the earlier synthetic browser database. Production D1 migrations remain unapplied.
- Mobile/desktop visual and accessibility tests, browser outage/reload tests, CI integration and complete site checks.

## Runtime handles at write time

Local response dev process session 97731, Astro dev process session 83319. Revalidate handles before using. The server does not auto-reload Worker code; restart when needed. Browser smoke used in-app browser tab 1. Do not assume handles remain live across turns.

## Continuation: calibration and content variety

- Bank version 2026.10.12.2 now has AP Micro 1,292 items / 142 families, AP Macro 443 / 29, undergraduate micro 360 / 15, undergraduate macro 288 / 12. Removed cosmetic conceptual replicas and added 71 individually authored AP Micro conceptual cases. The bank remains under substantive review.
- Added preparation, candidate 1PL/2PL fitting, held-out item prediction, S-X²/BH and Q3 diagnostics, exploratory dimensionality, optional anchored DIF, synthetic calibration/DIF/CAT fixtures and candidate review validation. No operational calibration is activated.
- mirt installed from CRAN; synthetic 1,000-person calibration and 1,000-person DIF fixtures executed. `verify-synthetic.mjs` checks parameter recovery, injected DIF detection and finite CAT results. Summary in audits/synthetic-verification.json. Two-factor exploratory fit did not converge on the unidimensional fixture; reports preserve this rather than declaring a pass.
- CAT smoke test (30 repetitions per trait/method) found shrinkage and undercoverage at extreme traits. Prior/grid/design sensitivity and larger Monte Carlo study remain required. The simulation uses known synthetic parameters and one dimension, not the operational six-unit bank.
- New regressions cover conceptual answer-position balance, generator-index leakage, long decimal artifacts, first-six-unit coverage and rejection of synthetic/unreviewed operational candidates. All 23 focused tests pass; Astro fast build passes.
- Content-review failures caught: cosmetic conceptual count reduction made all answer keys first (fixed with deterministic per-item option permutation); seven explanation families leaked generator notation (replaced with instantiated values); golden-rule/debt prompts showed floating-point tails (formatted). Structural audit now scans all items; audit inventory explicitly leaves substantive review pending.
- Optional DIF execution initially failed on group labels containing hyphens; internal neutral group labels now preserve an explicit label map. R AIC/BIC generic calls returned empty vectors; replaced with mirt extraction and synthetic checks requiring finite criteria.

## Continuation: identity and assignments

- Google ID token verification uses pinned jose, issuer/audience/signature/nonce checks and verified email. Challenge replay and expired/wrong-issuer tokens are rejected. No Google client is configured yet.
- Anonymous linkage is explicit. Linked sessions/responses move to the verified account and anonymous credentials are revoked; declining leaves history separate. Account credentials expire after 12 hours; anonymous credentials after 180 days.
- Assignments enforce membership, opening/closing times, maximum attempts and distinct-family availability. A unique attempt-slot index prevents concurrent requests from exceeding the limit. Instructor access uses a verified subject-hash allowlist.
- Student identity/assignment controls and private instructor reporting, assignment creation and paged ledger download are implemented. Live Google flow and UI remain unverified.
- All 32 focused tests and Astro fast build pass. Wrangler production bundle dry run passes (158.71 KiB, 47.44 KiB gzip). This does not deploy or validate a live database.
- wrangler.jsonc contains an explicit placeholder D1 ID. Cloudflare CLI is unauthenticated; no production resource created. Needed setup: account connection, actual D1 ID, Google web client ID and instructor subject allowlist, then approved deployment and live verification.
- Package installation reported 14 dependency vulnerabilities across the tree; determine applicability before deployment rather than applying blanket upgrades.

## Continuation: late delivery and durable receipts

- Fixed rejection of valid, owned outstanding answers arriving after a deadline or session completion. They now receive durable, idempotent receipts and explicit `late-receipt`/`after-completion` classifications. Client-reported submission times do not override server deadlines.
- Classification and measurement eligibility are calculated in the insert statement against current session state, preventing a completion between request validation and insertion from creating eligible evidence.
- Late/post-completion answers remain visible in history/exports but are excluded from adaptive evidence, instructor assessment counts/accuracy, and calibration. Student reports distinguish retained from counted answers.
- Added regression coverage for both conditions, receipt replay, persistent row count, ineligible calibration flags and no new question after closure. All 33 focused tests pass.
- Fixed a client validation failure that left Submit disabled even when no answer had been queued. Browser outage/reload and multi-tab tests remain required; localStorage outbox concurrency and expired credential recovery are still open.

## Continuation: first substantive content pass, core Units 1–2

- Bank version advanced to 2026.10.12.3. Eight numeric families now vary substantive answers instead of merely changing numbers around an invariant key: PPF slope, output/input opportunity cost, discrete marginal choice, demand/supply elasticity, producer surplus and demand-shift equilibrium.
- Reviewed 33 original core families (585 items): nine conceptual cases and 24 numeric families. The family-level rationale and exact content hashes are in audits/ap-micro-core-units-1-2.json. This is a first Codex self-review, not independent human validation; additional conceptual families and remaining units are outside this pass.
- New independent economic identities parse student-visible prompt quantities for all 576 numeric variants in these families. Tests additionally verify decision variety and elasticity classifications. All 35 focused tests and structural checks pass; count remains 1,292 AP Micro items /142 families.
- Clarified the positive-trade assumption in tax incidence. Fixed a dimensional wording error in competitive output: price, rather than output, must exceed minimum AVC.
- Several other families intentionally or currently retain invariant keys (e.g., midpoint elasticity and price controls); the review record flags this limitation. Second substantive pass, other families, diagram/FRQ expansion and live setup remain pending.

## Continuation: original core Units 3–6 review

- Bank version 2026.10.12.4 adds explicit operating/capacity assumptions to monopoly quantity/price and no-other-distortions assumptions to the externality-output prompt.
- First substantive self-review covers the remaining 38 original core families (636 items), recorded with family-specific reasoning and content hashes in audits/ap-micro-core-units-3-6.json. Together with the prior review this covers all 71 original core families, not the 71 additional conceptual families.
- Student-visible-data arithmetic checks now cover all 50 AP Micro numeric families and 1,200 numeric variants. All 36 focused tests and structural checks pass. These checks do not establish empirical item quality or AP skill coverage.
- Remaining invariant-answer families, adversarial second review, additional concepts, diagrams/FRQs and all operational/deployment gates remain open. Prior-version review artifacts are retained as versioned historical evidence, not assertions that later content hashes match.

## Continuation: diagram geometry and accessible descriptions

- Replaced sampled straight-line paths with analytically clipped segments, preserving exact axis intercepts for positive, negative and zero slopes.
- Moved curve labels into a separate line-style legend to avoid obscuring intersections. Accessible names/descriptions now include all equations and axis ranges; labels are escaped.
- Added tests for clipping edge cases, every existing bank diagram's bounds/equation consistency, escaped markup and accessible equations. All 39 focused tests pass. This verifies mathematical geometry and generated markup, not visual layout; desktop/mobile visual review remains open.

## Continuation: conceptual assumptions review

- Reviewed 30 additional conceptual families, from own-price-supply through constant-cost-entry. Six prompts needed tighter assumptions: upward-sloping supply; next-unit rather than current marginal product; positive fixed cost/output; output along LRAC rather than arbitrary input scaling; an available next-best salary alternative; and unconstrained interior marginal output adjustment.
- Bank version 2026.10.12.5. Findings and per-item hashes are in audits/ap-micro-concepts-middle.json. All 39 focused tests and structural checks pass. These tests do not validate conceptual interpretation; the recorded substantive self-review is separate evidence.
- Forty-one additional conceptual families remain outside this recorded first pass. Second review, further content/format expansion, psychometric operations and deployment gates remain open.

## Continuation: remaining conceptual first pass

- Reviewed the remaining 41 added conceptual families and clarified five prompts: divisible goods for local utility reallocation; positive common MC/interior solutions and percentage markup for the inverse-elasticity rule; no offsetting distortions/interior optima for positive-externality underproduction; downward MR for the monopoly-tax comparative static; nonnegative incomes/positive mean for the conventional Gini.
- Bank version 2026.10.12.6. Findings and current item hashes are in audits/ap-micro-concepts-remainder.json. All 39 focused tests and structural checks pass.
- First substantive self-review now covers all 142 AP Micro families (71 core plus71 added concepts). The four review records retain their original bank versions/hashes, so this is historical review coverage, not automatic current-hash certification. A second pass must consolidate current content and review evidence before publication. Item metadata deliberately still says draft-awaiting-content-audit.
- No empirical validation is implied. Content breadth/format expansion, second pass, other-course reviews, psychometric operation, reliability/security and live setup remain open.

## Continuation: adaptive scheduling and propensities

- Fixed a hinted-correct response setting streak zero and indexing the review schedule at −1, producing NaN. Assisted responses now get the same finite early-review interval as incorrect responses without increasing unassisted streaks.
- Selection engine v2 uses mean exponential utility per family, then conditional utility-weighted sampling within the selected family. Previously the first sibling’s utility determined family mass and siblings were uniform, ignoring variant-specific calibrated information. Exact joint propensities are retained; equal-utility large families still receive no family-size advantage.
- Regressions cover finite assisted review, no psychometric evidence from practice, unequal within-family information, probability normalization and family-size neutrality. All 41 focused tests pass. Operational calibration is still not activated; this change is not empirical validation.

## Continuation: reporting list pagination

- Removed silent 101-record limits from instructor students/assignments and student assignments. APIs now return bounded pages with stable-ID cursors and explicit hasMore/nextCursor; client lists retrieve all pages and reject repeated cursors.
- Integration test seeds205 synthetic account profiles and verifies all appear once across three pages; malformed cursor and nonadvancing client cursor regressions added. All43 focused tests pass.
- Lists are live rather than snapshot exports: concurrent new records can require refresh. Rendering/search for very large student rosters remains a usability consideration; no real student data were used.

## Continuation: calibration boundary and stopping claims

- Approved item parameters now require an explicit finite discrimination/difficulty pair and model ID, plus valid asymptotes. Validation occurs before recordAnswer mutates student state. Missing difficulty can no longer silently default to zero in an approved model.
- Maximum-length stopping reports precisionMet only when the same minimum evidence, coverage, finite positive SD and posterior boundary checks used by precision stopping are satisfied. A short SD alone is insufficient.
- Regression tests verify malformed calibrations leave state unchanged and max-length stops do not make false precision claims. All45 focused tests pass. The live service still requires operational calibration activation and stopping integration; these are mathematical-engine safeguards, not a claim of deployed calibrated CAT.

## Continuation: AP Macro numerical review

- Added independent student-visible-data checks for all18 current AP Macro numeric families (432 variants): national accounts, labor statistics, prices/interest, multipliers, simplified banking, debt/growth, exchange conversion and current-account signs. All46 focused tests pass.
- Clarified closed-economy/no-income-tax/unchanged-autonomous-investment assumptions for fiscal multipliers and willing borrowers/redepositing for maximum deposit expansion. Bank version2026.10.12.7.
- No arithmetic defects found in this numeric set. Invariant-answer patterns remain common and need diversification. AP Macro still has only29 families/443 items, and curriculum breadth, conceptual distractor review, diagrams and model diversity remain incomplete. Passing these arithmetic tests is not a claim of complete course coverage or empirical quality.

## Continuation: AP Macro conceptual expansion

- Added20 original single-instance conceptual families spanning all six broad course units: GDP treatment of used goods/transfers/inventories, CPI versus deflator, discouraged workers/natural unemployment, inflation redistribution, stabilizers/self-correction, money/bonds/bank capital, monetary models, growth, real exchange rates, saving-investment and risk-sensitive flows.
- AP Macro now463 items/49 families, including31 conceptual items and432 numeric variants. Bank2026.10.12.8. All46 focused tests and structural checks pass.
- Authoring self-check clarified positive (not merely diminishing) marginal product in capital deepening. New cases still require a separate recorded substantive review and alignment/diagram checks. Broader testing/platform/deployment gates remain open.

## Continuation: participant answer-history export

- Added an authenticated, owner-filtered, paginated participant history endpoint and Download my answer history control for anonymous and signed-in profiles. Exports include submissions, attempts, timing, hints, receipts and validity flags across sessions.
- Unfinished assessment scoring/key/explanations remain omitted; completed assessment and practice feedback are available. Pending browser answers are flushed before export; failed pagination produces no partial download.
- Added ownership, feedback-withholding, cursor and completion regressions. All47 focused tests pass. Account recovery, retention/deletion policy implementation, browser/multi-tab reliability and production setup remain open.

## Continuation: undergraduate numerical audit

- Added independent prompt-quantity checks for all27 undergraduate numeric families/648 variants, covering consumer/producer theory, strategic interaction, externalities, growth, Euler/PV, policy rules and open-economy conventions. All48 focused tests pass.
- Clarified continuous-time Solow convention for golden-rule capital, growth-accounting approximation, and constant-purchasing-power payment for a real discount rate. Bank2026.10.12.9.
- Test development initially misread the signed negative target in the displayed Taylor rule; corrected the independent parser calculation and reran successfully. No key error found in current undergraduate set.
- Across tracks, all2280 current numerical variants now have prompt-based economic checks. This is arithmetic/model-identity evidence, not full substantive certification, variety or course completeness. Undergraduate courses remain thin (15 micro/12 macro families) and need conceptual breadth and review.

## Continuation: per-event browser outbox

- Replaced the shared read-modify-write pending-answer array with one durable localStorage entry per event ID. Independent tab submissions no longer overwrite an unrelated queued event, and receipt removal affects only the acknowledged event.
- Existing legacy arrays migrate before retrieval; malformed data and conflicting event payloads are preserved with explicit errors. Matching durable server receipts remain mandatory for removal.
- Three regressions cover interleaved independent tabs, acknowledgment/conflict safeguards and legacy preservation. All51 focused tests pass. This does not prove full multi-tab reliability: two tabs answering the same presentation can still produce an attempt conflict, cross-tab account changes/recovery and real browser outage tests remain open. Browser storage can be cleared by its owner; server receipts distinguish durable uploads from local pending work.

## Continuation: session bank-version integrity

- Prevented new-version questions entering an older session after a deployment. An outstanding presentation remains answerable from its stored snapshot; the next selection initially returned bank-version-changed. Superseded by the bank archive implementation: registered historical banks now continue, and missing archives return a recoverable error instead of shortening the assessment.
- Reports expose session/current bank versions and explain the update to students. Regression verifies outstanding presentation reuse, durable answer, no added presentation and retained scored report. All52 focused tests pass.
- This is a transitional integrity safeguard, not seamless pinned-bank hosting: continuing old assessments to full length across releases still requires retaining deployable historical banks or a rollout policy that drains active assignments. Assigned sessions ended by an update may be shorter than their target; instructors can see the count.

## Continuation: whole-site integration gate

- Full existing npm check pipeline passed: copy/fieldbook/navigation/tokens/components, city and teaching-model tests, Astro build, rendered-style checks and public-CV safety. Local output /tmp/econ-whole-site-check.log. This is broader integration evidence, not browser interaction or production verification.
- Added check:econ-practice to the regular npm check chain and GitHub deployment workflow so economics regressions participate in future releases. Workflow YAML parses and includes the gate.
- Build now accepts PUBLIC_ECON_API_URL from the repository variable of that name. It remains unset; absent configuration keeps practice disabled. No GitHub setting, live service, push or deployment was changed.
- Workflow verification initially caught a duplicated env mapping introduced beside the existing Cesium configuration. Merged the new variable into the existing mapping and reran the YAML parser successfully before finishing. Existing Cesium configuration is preserved.

## Continuation: undergraduate conceptual breadth

- Added six original conceptual questions to each undergraduate track, one per broad unit. Micro covers ordinal utility, compensated demand, cost envelopes, welfare, credible threats and adverse selection. Macro covers accounting versus behavior, Solow level/growth effects, constraints, structural identification, Ricardian assumptions and currency risk premia.
- Undergraduate micro now366 items/21 families; macro294/18. Bank2026.10.12.10. All52 focused tests and structural checks pass; numeric verification continues to cover648 undergraduate variants separately from the new concepts.
- These additions require a separate substantive review and do not make either course comprehensive. Remaining content/format, psychometric, browser/security/reliability and live setup gates persist.

## Continuation: multipart scoring foundation

- Added weighted numeric-part rubric scoring, per-part feedback, strict response-shape validation and key-safe public item projection. Worker persists raw object answers and normalized partial scores; assessment feedback remains withheld until completion.
- Multipart responses are explicitly excluded from binary IRT updates and calibration eligibility pending a validated polytomous/testlet model. Ordinary choice/numeric grading now shares the same scoring module.
- All56 focused tests pass, including an actual Worker/D1 partial-credit fixture, durable raw responses, withheld keys and no binary calibration evidence.
- This is backend/scoring infrastructure only: no multipart bank items are yet served, and the student input/report UI and instructor partial-score summaries still need integration before enabling the format. It is not full AP free-response or graph-production support.

## Continuation: multipart student and instructor integration

- Added reusable numeric/choice/multipart form rendering, validated per-part collection and readable object-response formatting. Student feedback/reports show part-level credit/explanations and aggregate rubric points; instructor assignment reports add normalized credit (0–1 per item) alongside fully correct counts.
- Added24 multipart AP Micro items in two12-variant families: competitive equilibrium/tax/revenue and monopoly quantity/price/welfare. AP Micro now1316 items/144 families. Bank2026.10.12.11. Rubric parts remain excluded from binary calibration and are not treated as independent IRT items.
- Added DOM form tests plus independent prompt-data checks of all new rubric answers. All58 focused tests and Astro fast build pass. Structural audit understands multipart fields.
- New families need substantive second review and browser layout testing. This is numeric partial credit only; written justification, drawing/graph production, error-carried-forward rules and validated polytomous models remain unfinished.

## Continuation: partial-credit formative adaptation

- Enginev3 accumulates normalized rubric credit separately from fully correct counts and uses credit for practice difficulty/prerequisite routing. A partially correct response no longer has the same formative accuracy contribution as a wholly incorrect one.
- Full-correct streaks still require every part correct without hints. History/progress preserve score and rubric totals; multipart responses remain excluded from binary IRT evidence.
- Regression verifies actual selection probability shifts toward medium difficulty for partial understanding compared with all-wrong history, as well as separate streak/credit accounting. All60 focused tests pass. This is a formative heuristic, not a validated polytomous ability model.

## Continuation: local multipart browser walkthrough

- Restarted the verified old local dev server (it still served bank.1) with current code. Preserved the old development.sqlite; current server uses development-v2.sqlite. Live local handle28218 at write time; revalidate before reuse.
- Used a fresh localhost-origin synthetic anonymous session, selected Unit4, then deliberately seeded its sole unanswered presentation with monopoly-sequence variant1 for reproducibility. This is a fixture-based UI test, not evidence of random sampler selection.
- Browser entered20,60,399; observed saved receipt and per-part scores1/1,1/1,0/1. Finished session and observed2/3 rubric points with0/1 fully correct. Separate SQLite query confirmed one response, score2/3, calibration eligibility0.
- Narrow mobile viewport displayed the report without apparent horizontal overflow; screenshot multipart-browser-proof.png. No real student data. Full desktop, keyboard/accessibility, network outage/reload and configured Google sign-in tests remain.
- Browser tab1 is now localhost:4321/economics-practice and marked for continuation. The prior127.0.0.1-origin profile points to the preserved older synthetic DB and is not valid in the new fixture database; production recovery behavior remains an open gate.

## Continuation: malformed request handling

- JSON request parsing now requires a non-null object and valid UTF-8 before route-specific access. Scalar/null/array payloads no longer trigger misleading internal-server errors.
- Regressions cover malformed JSON, scalar/array/null bodies and oversized payloads, confirming explicit400/413 responses and no participant/response side effects. All61 focused tests pass.

## Continuation: course-specific prerequisite routing

- Fixed AP Micro prerequisite IDs being reused for every course even though topic numbers have different meanings. Added separate authored maps for AP Macro and undergraduate micro/macro; enginev4 resolves only the selected course map.
- Regression verifies poor macro GDP performance does not apply the AP Micro demand-to-elasticity penalty to macro unemployment. All62 focused tests pass.
- These prerequisite maps are formative author judgments, not empirically identified prerequisite structures. The current mechanism still penalizes advanced selections rather than providing a full explicit remediation sequence; that remains open.

## Continuation: signed-account reauthentication

- API client retains HTTP status. Expired signed-account refresh exposes reauthentication instead of trapping the user behind a pre-login queue flush; an answer-save401 returns to setup with the queue preserved.
- Reauthentication creates a temporary challenge profile, retains the prior participant target/session, skips premature upload, and requires Google verification to resolve to the same account before saving queued answers. The backend rejects a different verified account before creating/linking it; original histories are not transferred to the temporary profile.
- Regression covers wrong-account rejection and successful same-account credential issuance without linking temporary anonymous history. All63 tests pass; identity module syntax checked.
- Live Google/browser recovery remains unverified because OAuth is unconfigured. Anonymous expired-credential recovery, mid-session failures outside submission and cross-tab switching remain open. Temporary challenge profiles currently require eventual housekeeping.

## Continuation: explicit formative prerequisite step

- Enginev5 inserts a prerequisite-review selection after two consecutive same-topic practice responses below half credit. It uses the selected course’s map and only candidates already within the requested unit/topic coverage.
- After the prerequisite response, ordinary routing resumes unless another qualifying pattern occurs. Assessment selection is unchanged. The selection reason identifies the remediated topic and propensity is conditional on the narrowed eligible pool.
- Regressions verify triggering, release after review, strict topic-filter preservation and assessment separation. All65 focused tests pass. Threshold and effectiveness remain formative author choices requiring student-data evaluation.

## Continuation: current-bank review reconciliation

- Added a reproducible reconciliation script and review-current.json. It reconstructs the four committed historical banks, verifies every stored review hash, and compares current item content while excluding only the global version field.
- All142 previously reviewed AP Micro families match their first self-review content;90 other families have no recorded substantive review. No hash errors. Missing families, duplicate evidence and invalid single-item review cardinality fail visibly.
- Matching evidence does not establish second review, independent review, empirical validation or release approval. This closes the stale-version bookkeeping gap without upgrading content release status. Run `node scripts/econ-practice/reconcile-reviews.mjs` after content changes; historical commits must be available locally.

## Continuation: additional AP Macro conceptual review

- Recorded substantive first-pass reasoning for all20 additional AP Macro conceptual cases, inspecting keys, distractors, assumptions and boundary cases. Clarified capital deepening by holding all other production determinants fixed, rather than technology alone. Bank2026.10.12.12.
- All65 focused tests pass and structural audit reports no errors/warnings. Historical review reconciliation now handles multiple courses:162 families match recorded first reviews;70 lack recorded substantive review. No historical hash errors.
- Remaining AP Macro original concepts/numeric families, undergraduate content and multipart families still need recorded substantive review; arithmetic oracle tests alone do not satisfy that gate. Independent review, second passes and empirical validation remain open.

## Continuation: AP Macro core substantive review and variation

- Completed recorded first substantive review of all29 original AP Macro families (432 numeric variants,11 concepts). Together with the additional20 concepts, all49 AP Macro families now have a current first review.
- Eight numeric families now yield varied answers rather than invariant results: opportunity cost, unemployment, participation, inflation, real interest, bond yields, quantity-theory inflation and productivity growth. Independent prompt-based numeric checks pass for all432 variants; a new regression requires at least five distinct outcomes per revised family.
- Clarified average opportunity cost, frictionless mutually beneficial trade, closed-economy loanable-funds supply/demand, and fixed inflation expectations plus floating exchange for initial capital-flow pressure. Repaired deposit-multiplier punctuation.
- Bank2026.10.12.13;66 focused tests pass. Reconciliation verifies191 current family reviews without hash errors;41 families remain without recorded substantive review (39 undergraduate and2 multipart). This does not establish complete curricular breadth, second/independent review or empirical validation.

## Continuation: undergraduate conceptual first review

- Recorded substantive first review of all12 undergraduate conceptual cases, six per course. Keys/distractors checked against ordinal utility, duality/envelope conditions, welfare, subgame perfection, hidden types, accounting identities, Solow transitions, constrained optimality, identification, Ricardian assumptions and risk premia.
- Corrected the borrowing-constraint explanation: a binding constraint alone need not have a positive multiplier. The stem's strict desire to borrow more supports the constrained Euler condition under usual regularity.
- Bank2026.10.12.14;66 focused tests pass. Reconciliation now handles two review artifacts sharing one source commit.203 families match current first-review evidence;29 remain without recorded substantive review (27 undergraduate numeric,2 multipart). No historical hash errors.
- Undergraduate coverage is still limited despite these reviewed examples. Second/independent review, richer formats and empirical validation remain open.

## Continuation: multipart substantive review

- Recorded first substantive review of both multipart AP Micro families:24 items/72 numeric parts. Checked equilibrium/interiority, monopoly optimization, tax revenue and welfare identities, and actual scoring rules.
- Regression now tests every one-part error across all24 variants, plus selected internally consistent carried-forward errors. Parts receive separate keyed credit; the scorer does not award error-carried-forward credit. All67 focused tests pass.
- Current first-review evidence covers205 families;27 undergraduate numeric families remain pending. All144 AP Micro families now have a recorded first pass. No content change or bank version bump in this continuation.
- These multipart exercises are not complete AP free-response rubrics. Written reasoning, graph production, carried-forward credit and empirically validated polytomous scoring remain unfinished. Shared-stem parts remain excluded from binary IRT calibration.

## Continuation: undergraduate micro numeric first review

- Recorded first substantive review of all15 undergraduate micro numeric families/360 variants. Added credible stage-equilibrium punishment, best-deviation, symmetric relevant payoffs and perfect monitoring to the repeated-collusion problem; clarified no-other-distortion/interior/unique-equilibrium assumptions for Pigouvian implementation.
- MRS, point elasticity, mixing probabilities, collusion thresholds and insurance premiums now vary across variants. Independent prompt-based oracles verify all undergraduate numeric answers; new variation regression guards against constant-outcome families.68 focused tests pass.
- Bank2026.10.12.15. Reconciliation verifies220 current family reviews with no errors. Only12 undergraduate macro numeric families remain without a first substantive review. Course breadth, second/independent reviews and empirical validation remain separate open gates.

## Continuation: undergraduate macro first review complete

- Recorded substantive first review of all12 undergraduate macro numeric families/288 variants. Clarified the primary-deficit ratio denominator as next-period GDP, consistent with the provided debt-dynamics equation.
- Solow saving rates and real-exchange price ratios now produce24 distinct keyed answers per family.69 focused tests pass, including independent prompt-based calculations for all648 undergraduate numeric variants.
- Bank2026.10.12.16. Historical reconciliation verifies all232 existing families against recorded first reviews, with no errors or pending first-review families. This is first self-review coverage, not independent/second review, curricular completeness or empirical calibration.
- Next development priorities remain reliability of long-lived answer histories, version-pinned assignments, operational calibration/precision stopping, richer question formats, fuller curriculum coverage and deployment configuration. Live Cloudflare/Google setup is still outstanding; nothing pushed or deployed.

## Continuation: remove lifetime replay cutoff

- Replaced the10,000-answer hard failure with server-side keyset paging in batches of500. Replay captures a participant-specific maximum ledger sequence, then reads only through that watermark in durable receipt order. New receipts cannot indefinitely extend the replay.
- Added a SQLite-backed regression reconstructing10,005 valid first attempts, retaining the final answer and full topic count, while excluding another owner's response and a late receipt.70 focused tests pass.
- This removes an artificial lifetime cutoff, not all scaling limits. Full history still occupies memory and recordAnswer scans existing events/families; persistent versioned checkpoints and indexed incremental state remain required for substantially larger histories. Concurrent sign-in migration consistency also needs review. No production deployment occurred.

## Continuation: efficient and bounded history reconstruction

- Added an owned replay recorder with event-ID and course/family sets. Server reconstruction no longer scans the entire growing history for duplicate events and first exposure on every answer. The ordinary recordAnswer API retains existing behavior.
- Equivalence regression compares indexed and ordinary reconstruction across first/repeated families, assisted assessment responses and duplicate IDs, then verifies resumption from serialized state. A separate boundary test supplies a receipt beyond the captured watermark and confirms it is excluded from the two-page replay.
- All72 focused tests pass, including the10,005-answer SQLite replay case. No bank content change. Recorder contract prohibits external history mutation while it owns appends; persistent checkpoints and bounded-memory aggregates remain unfinished.

## Continuation: concurrent first-exposure correction

- Found a check-then-insert race: concurrent sessions could both mark the same participant/course/family as first exposure. Moved the existence check into the presentation INSERT SELECT, so serialized database writes determine first exposure atomically.
- Added a deterministic concurrency barrier holding both presentation writes until both requests finish preliminary reads. Verified the regression fails on the prior committed worker (two first exposures) and passes on the revised worker (one). Subsequent assessment answers yield only one calibration-eligible receipt.
- Added concurrent same-event retry verification plus conflicting-event rejection; the accepted receipt remains one durable row.74 focused tests pass. This does not yet preserve conflicting alternate submissions as separate non-scoring events; that broader tracking requirement remains open. No deployment.

## Continuation: hint receipt-time race correction

- Reproduced a race where a hint committed after the answer handler read the presentation but before receipt insertion was omitted from response.hints_used. Answer insertion now joins the current presentation and stores its hint count atomically; calibration eligibility also checks the current count.
- Deterministic regression injects an actual hint request immediately before the response write. It fails on the prior worker (zero hints instead of one) and passes on the fix. A subsequent hint leaves the saved response count unchanged.
- All75 focused tests pass. Receipt ordering establishes recorded assistance, not proof the student read a delivered hint. No deployment or bank change.

## Continuation: full integration verification

- Ran the complete configured npm run check pipeline against commit3b6a48fb: passed, including75 economics tests, static build (130 generated pages), rendered-style verification (132 pages) and the site's other configured test suites.
- Cloudflare Wrangler4.149.0 deploy dry run passed; Worker bundle191.90KiB, gzip57.75KiB. This verifies local packaging only, not account access, actual D1 bindings, OAuth or deployed behavior.
- Existing site build reports Markdown plugin configuration deprecation and large-chunk warnings. No tracked source changes resulted from the build. Saved bounded verification evidence in audits/integration-verification.json.
- Goal remains incomplete: content/format breadth and further review, operational psychometrics, checkpointing, version continuity, tracking conflicts, privacy/security and live deployment gates remain open.

## Continuation: assessment occasion separation

- Corrected lifetime pooling of unit measurement posteriors. Enginev6 keys posteriors by session/course/unit; information-based selection uses the current occasion. Report progress now explicitly carries sessionId, estimationScope=session and eligible measurement-response counts, with attempts/credit restricted to that session.
- Lifetime topic learning/review state remains formative. Lifetime family exposure still excludes previously practiced families from fresh binary evidence; starting a new session does not erase exposure history.
- Regressions verify a new occasion starts at the prior, later responses do not alter earlier estimates, current routing matches an isolated occasion, and previously practiced families remain excluded.77 focused tests pass. No bank change; no empirical calibration or longitudinal linking claim. Persisted checkpoints, when implemented, must use state version2 or rebuild.

## Continuation: evidence-qualified diagnostic reports

- Report estimates are null when the requested session/unit has no eligible evidence; an untouched routing prior is no longer exposed as measured performance. Reports include measurementStatus and modelVersions. Authored-parameter evidence is explicitly provisional.
- Records preserve parameter status. Reports suppress numerical estimates for mixed model versions without linking. This is a reporting guard; operational model activation/pinning and protection against mixed-model routing remain unfinished and must precede deployment of calibrated models.
- Regression covers no-evidence, provisional, synthetic approved-model and mixed-version cases.78 focused tests pass. No empirical calibration or bank change.

## Continuation: reject incompatible model updates and routing

- Enginev7/statev3 stores the model ID for each session/course/unit posterior. A new eligible response using another model is rejected before topic/history/posterior mutation. Assessment information selection likewise rejects candidates whose parameter model conflicts with accumulated evidence.
- Legacy state without posteriorModels derives the existing model from eligible history; ambiguous or missing provenance fails closed. New indexed replay retains its efficient model metadata path.
- Extended regression verifies update/routing rejection and exact state preservation, while retaining suppression for externally supplied legacy mixed history.78 tests pass.
- This assumes model IDs identify immutable parameter sets. Operational immutable model storage, session-level model assignment, parameter hashes and explicit linked rebuild procedures remain unfinished; no approved model is activated in the live service.

## Continuation: dependency security updates

- Fresh npm audit found16 affected packages (8 high,3 moderate,5 low). Applied compatible transitive updates and advanced the existing sharp override from0.35.4 to0.35.5, including matching native/libvips packages.
- Audit now reports6 affected packages (0 high,2 moderate,4 low). Remaining chains are KaTeX/math-rendering and UUID/ExcelJS; require targeted API/reachability review instead of the audit tool's suggested forced downgrades. Registry counts are not a complete application-security assessment.
- Full npm run check passes after updates, including78 economics tests, static build and rendered styles. Wrangler local deploy dry run also passes. Saved dependency-review.json with advisory data and exact lock hash. No deployment.

## Continuation: remaining dependency findings resolved

- Advanced KaTeX to0.18.2 and overrode transitive renderers to the same version so CSS/rendered markup remain aligned. Scoped ExcelJS's UUID dependency to11.1.1, which preserves its CommonJS v4 import. These cross upstream declared ranges and need rechecking on future upgrades.
- Fresh npm audit reports zero findings. Verified the actual ExcelJS extended conditional-formatting UUID path plus synthetic workbook write/read. Full site check passes (78 economics tests); dedicated econometrics/math checks pass against rebuilt output, including691 source expressions. Wrangler dry run passes.
- Updated dependency-review.json with final lock hash and validation scope. Zero registry findings does not establish full application security. No deployment.

## Continuation: atomic new-presentation session gate

- Reproduced next-question selection racing with session completion. The old worker could create and return a new presentation after completion because it used the session state read before selection.
- Presentation INSERT SELECT now checks current session ownership, no completion and future expiry using database time. A zero-row insert returns409 and no fabricated presentation ID. Existing unique-sequence race recovery remains intact.
- Deterministic tests inject actual completion or expiry immediately before the write. Previous code fails with200 instead of409; revised code leaves presentation count unchanged.79 focused tests pass. No deployment.

## Continuation: database receipt-time deadline classification

- Reproduced an answer write delayed beyond expiry that the old handler classified as valid using its earlier application timestamp. The database now generates server_received_at and compares expiry with the same statement's database time.
- API receipt comes from the persisted row. Late answers retain raw responses and receive late-receipt status, no result credit and no calibration eligibility. Identical retries return the original persisted timestamp/classification.
- Regression delays the write past a newly set deadline: prior code fails (valid instead of late-receipt), current code passes and retains the answer.80 focused tests pass. Client submission time remains contextual metadata, not the deadline authority. No deployment.

## Continuation: current-engine CAT simulation and undercoverage

- Found simulator coupling to the obsolete course/unit posterior key after occasion separation. Replaced manual state injection with actual recordAnswer calls; every step now verifies operational report theta against an independently updated posterior. Simulation records enginev7.
- Ran200 replications at seven theta points for adaptive and random selection (2,800 synthetic administrations). Known synthetic parameters, one dimension,48-item bank only; not real-bank validation.
- Adaptive nominal95% interval coverage is89.5% at theta-3 and89% at+3 (Monte Carlo SE about2.2 percentage points), with biases+.399 and-.358 and mean length47.7 at both extremes. Random baseline shows similar shrinkage/undercoverage. Central coverage is higher. This is an unresolved validation result, not a passed precision gate.
- Saved full results in audits/cat-current-engine.json.80 focused tests still pass. Next psychometric work: prior/grid/item-bank sensitivity, greater extreme-trait information, parameter uncertainty and multi-unit design simulations. No operational calibrated/precision-stopping deployment.

## Continuation: prior and bank sensitivity experiment

- Extended the current-engine simulator with explicit baseline, wide-prior (SD2), wide-bank (difficulty span±4.5), and combined scenarios. All retain81 grid points on[-4,4],48 items and known parameters. Experimental prior seeding is checked against the operational posterior after each answer; production defaults unchanged.
- Ran200 replications per seven theta points, two methods and four scenarios (11,200 synthetic administrations). Saved cat-sensitivity.json. Baseline reproduces the prior run exactly.
- At theta±3, widening the prior reduces adaptive absolute bias from.36–.40 to.07–.08 and raises observed coverage to98–98.5%, but all such cases reach48 items without precision. Spreading the same48 items over a wider range worsens extreme coverage to83.5–85% and no scenario-wide wide-bank precision stops occur. This changes difficulty density, not bank size; it is not a test of adding more well-targeted items.
- Evidence supports substantial prior sensitivity and inadequate information for the precision target. It does not justify selecting a new production prior or claiming nominal coverage. Next: targeted bank expansion, grid sensitivity, parameter uncertainty and multi-unit simulations.

## Continuation: larger and tail-enriched bank simulations

- Added192-item uniform and tail-enriched synthetic scenarios while retaining48-response maximum and the existing selector. Tail enrichment preserves baseline48 plus72 additional independent families per tail at absolute difficulty2.4–3.2. Added guard requiring identical joint discrimination/absolute-difficulty distributions across the new tails; corrected an alternating-index confound before saving final results.
- Final scenarios contain8,400 synthetic administrations (200 per trait/method/scenario). Uniform expansion still has adaptive extreme coverage89.5–90.5% and bias about.33–.37. Balanced tail enrichment reaches precision stops in191/200 and182/200 extreme cases, but coverage remains89%/88%, while theta0 reaches the cap in every case.
- Tail enrichment plus SD2 prior reduces extreme bias to.109/-.131, coverage98.5%/94%, with161/163 precision stops; center remains cap-limited. Saved cat-bank-expansion.json. These results show the posterior-SD stop is not a uniform coverage guarantee and identify center/tail information tradeoffs.
- Production settings unchanged. Actual variant counts do not imply these independent-family/information assumptions. Parameter uncertainty, grid sensitivity, multi-unit design and empirical validation remain open.

## Continuation: attributable instructor access audit

- Replaced the generic instructor actor on response exports with the authenticated participant ID (or explicit local-bootstrap identity in local mode). Export details include cursor/count, not answer copies.
- Added audit records for student-directory reads and assignment-report reads before returning those private results. Student emails are not copied into audit metadata. Existing assignment creation attribution retained.
- Regression verifies two distinct instructors' export/directory actors, assignment creation/report attribution and denial to an anonymous outsider.81 focused tests pass. This is application access logging, not tamper-proof external audit storage or full privacy compliance. No deployment.

## Continuation: bounded response exports under incoming traffic

- Added versioned response cursors carrying last sequence and fixed upper ledger boundary. Student-history and instructor exports capture the boundary on their first page and retain it across later pages; new receipts appear in a fresh export. Existing numeric starting cursors remain accepted for starting a new window.
- Both routes validate cursor syntax/ranges; owner filtering still applies independently of cursor values. Instructor export audit includes the ledger boundary. Existing browser loops already treat cursors as opaque strings.
- Regression uses501 synthetic receipts and inserts another between pages on each route, verifying fixed membership and fresh-export inclusion, plus malformed-range rejection.82 focused tests pass.
- This freezes receipt membership, not all mutable joined metadata: session completion/identity linkage can still change during an export. Full transactional export snapshots and account-link concurrency remain open. No deployment.

## Continuation: indexed participant ledger access

- Added migration0003 with response_participant_ledger(participant_id,ledger_sequence), supporting participant-owned export/replay ranges and maximum-sequence lookup. Existing time index retained for its separate access pattern.
- Query-plan regression demonstrates the pre-migration temporary ordering step, then verifies the new bounded read uses the ledger index without temporary sorting and the high-water lookup uses its covering index. This is plan evidence, not a production latency benchmark.
- Response/auth integration fixtures now discover and execute every SQL migration in sorted order rather than stopping at0002.83 focused tests pass. Migration is prepared and tested locally; not applied to any remote database. Persistent checkpoints remain open.

## Continuation: interpretable instructor aggregate statistics

- Replaced pooled course-only accuracy with course/mode summaries. API distinguishes total receipts, counted attempts, excluded late/after-completion receipts, all-attempt accuracy, first-attempt accuracy, first-attempt mean normalized credit and assisted first attempts. Counts of calibration-eligible responses remain separate.
- Instructor summary labels now include practice/assessment mode. API explicitly describes these as descriptive response statistics, not ability estimates. First-attempt statistics can still include hinted responses; assisted count makes this visible rather than silently treating all first attempts as unassisted.
- Regression constructs wrong-first/correct-retry practice, a correct assessment and a retained after-completion receipt. Verifies separate denominators and no retry/late inflation of first-attempt accuracy.84 focused tests pass. No deployment.

## Continuation: fresh-family diagnostic preference

- Enginev8 narrows assessment selection to previously unexposed families when available after unit/topic filters and uncovered-unit requirements. If only familiar families remain within coverage, it allows them with explicit exposureStatus; existing calibration exclusions still apply.
- Worker supplies lifetime presentation-family exposure, including unanswered presentations, in addition to answered history. Atomic insertion remains the final authority under concurrent selections. Selection probability is conditional on the resulting eligible pool.
- Regression verifies fresh preference, unanswered-presentation input, unit-filter preservation, uncovered-unit priority and exhausted-fresh-bank fallback. Updated occasion test to compare identical eligible pools.85 focused tests pass. Freshness is not empirical item calibration or proof of independence across different families.

## Continuation: descriptive item screening diagnostics

- Extended the existing preparation manifest rather than creating a second response tracker. Added sample facility, working-binomial Wilson intervals, constant-response flags, timing/propensity distributions and response frequencies. Observed pre-item-screen counts are distinguished from retained matrix counts.
- Constant and sparse items remain diagnostically visible; missing timing is not treated as zero. Interpretation explicitly limits results to the adaptively selected observed sample, not population facility or IRT difficulty.
- Regression covers constant items excluded from fitting, partial missing timing, counts, no participant/session identifiers in the new aggregate section, and closed-form interval edge cases.87 focused tests pass. No real student data analyzed or empirical approval claimed.

## Continuation: final-matrix calibration variation gate

- Found that removing respondents with too few remaining items could turn a previously varying item constant after the initial item screen. The old preparation result could still report readyForCandidateFit=true.
- Added finalItemStats (observed/correct/constant) on the actual exported matrix and a constant_items_after_person_filter blocking reason. Constant items are retained in evidence for review rather than silently discarded through repeated pruning.
- Regression constructs this exact filtering cascade, reproduces the old false-ready result and verifies explicit blocking.88 focused tests pass. This adds a screening condition, not proof of identifiability or sufficient sample size.
# Calibration metadata validation follow-up

The calibration importer now requires explicit valid assistance and attempt metadata before testing eligibility. Null, missing, string, boolean hint counts, and invalid numeric counts cannot be coerced into clean first-attempt evidence. Boolean feedback indicators remain supported alongside database 0/1 values. Exclusions distinguish malformed metadata from valid assisted/repeated responses. All 89 focused economics tests pass, and the unchanged 2,439-item bank passes structural checks. This does not supply empirical calibration or operational model approval.

# Conflicting answer retention

Valid, authenticated submissions for an owned presentation are now retained even when an event ID conflicts, an attempt is out of sequence, or an assessment answer is locked. Migration `0004_unscored_submissions.sql` adds a separate ledger with database receipt times, canonical submitted fields, payload hashes, exclusion reasons, and stable receipt IDs. Exact retries return the original receipt. A previously excluded submission cannot become scored on a later retry; the original scored response remains unchanged.

The browser acknowledges these durable receipts and explains the exclusion, allowing the pending queue to advance. Participant and instructor downloads include `unscoredSubmissions` separately from calibration-compatible `rows`. Both new export routes enforce authorization; instructor reads are audited. Each ledger export has its own fixed upper boundary, so a combined download is not an atomic snapshot across both ledgers. Explicit anonymous linking transfers the additional records.

Verification: 93 focused tests pass, including concurrent duplicate retention, score isolation, private exports, stable pagination, and receipt preservation through account linking. Astro builds all 130 pages; the Cloudflare Worker dry-run bundle succeeds. These checks do not establish live deployment or real-browser outage behavior. Malformed requests, invalid answer shapes, unauthorized requests, and traffic that never reaches the service are not claimed as stored answers. Storage quotas, abuse protection, identity-link concurrency, and retention/deletion remain follow-up work.

# Answer writes during account linking

Both scored-response and separately retained-submission inserts now check session ownership inside the database write. If anonymous linking occurs after request authorization but before insertion, the old request receives HTTP 401 without a persistence receipt; its queued payload can be retried with the signed-in account. This prevents a new answer from being stranded under the disabled anonymous profile after the linking transaction has already moved existing records. A deterministic regression test injects actual account linking immediately before each ledger insert and verifies zero old-owner rows plus successful new-owner retry. All 94 focused tests and the unchanged bank structural audit pass. This covers answer insertion, not every possible concurrent identity operation or automatic cross-tab recovery.

# Historical question-bank continuity

Migration `0005_bank_archive.sql` adds bank manifests and course/unit chunks. Before creating a session or assignment, the service registers the current bank transactionally. A version cannot be reused for different content; update triggers protect stored manifests/chunks. Each chunk is limited to 512 KiB by application validation. The current complete bank is approximately 1.53 MB serialized, with its largest chunk approximately 282 KB.

Selection loads the session's registered bank, verifies manifest and chunk hashes, and preserves that version through completion. Existing assignments can start against their registered historical bank after a deployment. Missing or damaged archives return HTTP 503 without falsely ending an assessment; already-presented questions remain answerable from presentation snapshots. Current-version sessions created before this migration can register the currently bundled bank on their next selection. Earlier versions that were never registered require restoration from their original source; this change does not reconstruct them automatically.

A regression starts an assigned assessment on an archived fixture version that differs from the deployed version, answers all six questions, and verifies six correct records plus normal length completion. Archive tests reject changed content under an existing version, reject direct chunk updates, and detect a missing chunk. All 96 focused tests and the structural bank audit pass. The archive pins question content, not historical engine code or a future operational calibration policy; those remain separate versioning requirements. Apply all D1 migrations before deploying this Worker.

# Binding calibration review to model content

Candidate reviews now match the SHA-256 of the entire canonical report as well as the source-data hash, selected model, bank version, course and unit. The validator returns the report hash and its serialization format. This closes the previous gap where changed fitted parameters or diagnostics could retain a technically matching source-data review. Canonical serialization rejects non-finite or unsupported values instead of silently coercing or dropping them. Tests confirm parameter/diagnostic changes invalidate review, object key order preserves the hash, scope mismatches fail, and synthetic reports remain ineligible. All 98 focused tests and bank structural checks pass. This is review-artifact integrity, not an operational model registry, reviewer authentication or empirical validation.

