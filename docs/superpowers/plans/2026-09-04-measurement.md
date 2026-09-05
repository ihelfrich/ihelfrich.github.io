# Measurement investigations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Publish a substantive measurement investigation with narrative, undergraduate and doctoral reading experiences, and two mathematically inspectable browser experiments.

**Architecture:** A separate Astro measurement collection extends the existing twelve-chapter course without misrepresenting its scope. Pure calculation functions drive server-rendered figures and progressively enhanced controls. The public site remains the canonical edition.

**Tech Stack:** Existing Astro 7, Markdown/KaTeX, browser JavaScript, native SVG and Node tests. No new dependencies.

**Spec:** MEASUREMENT-RESEARCH-BRIEF.md and the user's approved three-layer architecture in the conversation.

## Global Constraints

- Work only in the existing isolated econometric-argument-site worktree. Preserve unrelated edits.
- Synthetic profiles only; no accounts, uploads, external model calls, private learner records or psychological scoring.
- Source every attributed theoretical result. Label new research and teaching hypotheses untested.
- No em dashes, 'rather than', or 'not X but Y' in Astro source (existing copy gate).
- Retain twelve chapters and their existing checks. Add four measurement routes and check them independently.
- Use apply_patch for edits. Do not push until local checks, rendered UI, and independent review pass.

## Design system and self-review

The signature visual is a comparison that refuses to collapse: two endpoints bracket every possible score gap, while a movable weight shows how the same evidence supports opposing decisions. This is a working mathematical diagram, not a decorative chart.

Palette: ink #142B49, ice #F4F7FB, clear blue #2459D3, violet #6845B7, pale lilac #EAE6F6, white #FFFFFF. Violet carries unresolved model possibilities; blue carries a selected comparison. Keep original self-hosted Geist for navigation and figures, Newsreader for narrative prose. No new font dependency.

Layout: a large, left-aligned question faces a vertically open interval figure. The graph shares the page surface, with its controls below. Three unequal reading entries follow: a prominent narrative opening, then calculation and theory entrances. Long-form pages use a restrained side rail for switching depth without losing the shared case.

Self-review: rejected another boxed dashboard hero, metric tiles, fake scientific textures, and constant animation. The distinctive element must compute something. Story readability and keyboard access remain stronger constraints than novelty of decoration.

### Task 1: Calculation engine

**Files:** Create src/lib/measurement.mjs and tests/unit/measurement.test.mjs.

**Interfaces:** Export `profiles(audit=false)` -> `{A:{access:[lo,hi],control:[lo,hi]},B:...}`; `ordinal(q)` -> `{values:[number,number,number,number],meanA,meanB,gap,superiority}`; `compare(A,B,weights)` -> `{lower,upper,status}`; `eligibility(interval,floor)` -> `'guaranteed'|'excluded'|'unresolved'`. Status names: A, B, weak-A, weak-B, equal, unresolved.

- [ ] Write independent literal tests first, including `compare(profiles().A,profiles().B,[.5,.5])` -> lower -25, upper 10; .9 -> 3,34; .1 -> -53,-14; audit .5 -> -20,5. Wrong endpoint selection must fail a negative-slope case: A access[0,0], control[10,10]; B access[2,8], control[3,7]; weights[.2,.8] -> [-5.8,5.2].
- [ ] Run `node --test tests/unit/measurement.test.mjs` and observe the missing-feature failure.
- [ ] Implement exact extrema by evaluating lower and upper affine corner functions at BOTH weight endpoints. Reject malformed, nonfinite, reversed and out-of-rubric intervals. Reject weights outside [0,1] and q outside [.25,4]. Use stable expm1 for anchored recoding. No empty-domain certainty.
- [ ] Verify .5/1/2 recodings have negative/zero/positive gaps and all four pairwise comparisons preserve superiority .5. Test equality at threshold, malformed input and nested-set narrowing across a weight grid. Run tests and report actual results.

### Task 2: Doctoral companion

**Files:** Create src/content/measurement/technical.md; review existing story.md and field-guide.md.

**Interfaces:** Frontmatter title, description, order:3. Links `/econometrics/measurement/{story,field-guide,technical}/`; source heading `## Sources`.

- [ ] Use the verified source spine `/Users/ian/Developer/agent-playground/measurement-source-spine-20260904.md` and adversarial report `/Users/ian/Developer/agent-playground/measurement-adversary-20260904.md`.
- [ ] Write explicit assumptions/proofs for anchored recoding, box bounds, fixed-domain refinement, and noncompensatory constraints; connect inverse problems and current prior-free experiment comparisons without claiming equivalence or priority.
- [ ] Include three doctoral exercises with complete expandable solutions, a precisely delimited active-measurement proposal, and a falsifiable teaching hypothesis. Research proposals are distinct from established results.
- [ ] Check all equations with the existing KaTeX path; review source attribution and mathematical boundary cases independently before publication.

### Task 3: Interactive reading surface

**Files:** Create src/pages/econometrics/measurement/{index,[slug]}.astro, src/components/econometrics/MeasurementLab.astro, src/styles/measurement.css, src/scripts/measurement-lab.mjs, tests/unit/measurement-ui.test.mjs. Modify src/content.config.ts, src/layouts/Econometrics.astro, course index, edition, teaching page, chapter06, sitemap and release checks.

**Interfaces:** Consume Task 1 functions. Initialize with `initializeMeasurement(document)`. Controls use data-m-weight, data-m-spread, data-m-audit, data-m-veto, data-m-q; output data-m-verdict and data-m-gap. Export a versioned JSON record via button data-m-export with assumptions, synthetic profiles, weights, recoding and conditional conclusions.

- [ ] Write failing real-DOM tests before the controller: default gap [-25,10], weight90 -> [3,34], audit -> [4,33], recoding2 -> A mean advantage, reset restores defaults, export record contains synthetic status and selected assumptions. Test event effects, not source text.
- [ ] Build the open interval figure with static initial values and visible limits, two weight controls (center and allowed disagreement), audit toggle, hard-floor toggle, anchored ordinal ladder and recoding control. Include preset buttons for learning comparisons and a no-JavaScript explanation.
- [ ] Add collection schema and three reader routes. Existing twelve-chapter claims stay unchanged. Add a prominent measurement entry on course home and a navigation link; all source/proof links remain reachable.
- [ ] Verify model uncertainty is never labeled sampling confidence, ordinal arithmetic is labeled conditional, ties differ from unresolved rankings, veto differs from weighted preference, and exports preserve all assumptions.

### Task 4: Release verification

**Files:** scripts/check-econometrics.mjs, package.json, this plan/progress record.

- [ ] Expand route assertion to22, retain old twelve-chapter tests, add measurement collection frontmatter/math/exercise checks. Add both new test files to check:econometrics so deployment gates them.
- [ ] Run `npm run check:copy`, `npm run check:components`, `npm run check:fieldbook`, `npm run build:fast`, `npm run check:econometrics`, `npm run check:styles`, `npm run check:public-cv`, `npm run pagefind`, `npm run check:discovery`.
- [ ] Inspect desktop and narrow rendered output in the browser, use controls and exports, inspect console failures. Fix genuine defects and rerun relevant gates.
- [ ] Independent whole-change review: mathematical meaning, source accuracy, accessibility, false novelty and portfolio exposure. Execute reported bugs before fixing.
- [ ] Commit only scoped files. Recheck remote ancestry, publish the approved site extension with a normal fast-forward push, verify hosted route and deployment status, report actual scope and remaining research limitations.
