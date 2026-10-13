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
