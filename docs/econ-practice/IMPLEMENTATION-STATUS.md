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
