# Economics practice: final usability review

Reviewed 2026-10-13 against the running local preview at `http://127.0.0.1:4321/economics-practice/` and working-tree source (HEAD `f2118e49`). The rendered application’s API attribute was `http://127.0.0.1:8787`. No production endpoints, sign-in bypass, session submissions, server restarts, application changes or imported participant data were used. Only this audit file was written.

## Evidence and boundaries

CUA browser inspection covered student setup, the curriculum directory, and the unsigned-in instructor workbench. The first snapshot arrived during ongoing integration; subsequent DOM and accessibility observations confirmed **36 course options**, including History of Economic Thought, Mathematical Economics and Computational Economics. Findings below use that later state, not the initial smaller list.

At a 375 × 812 viewport, student setup had document scroll width 375 px; the Course control was 315 px wide with right edge 345 px. Selecting Causal Inference and Applied Econometrics populated its six matching units, and Tab from Course focused Session (`mode`). The Computational Economics disclosure opened with Enter and displayed prerequisites and six units. The temporary viewport override was reset. These are positive bounded checks, not a full mobile or assistive-technology certification.

Native labels are present for Course, Session, Coverage and the file input. Source provides visible focus rings, 44 px buttons, a single-column setup breakpoint, answer/report heading focus, live feedback and receipt status, and instructor loading/analysis status regions. No screen reader was run. Signed-in instructor views and populated workbench results were reviewed in source only; no suitable existing synthetic response-ledger file was imported in this pass.

## 1. Course discovery does not carry the chosen course into practice — P2, observed browser workflow

**Reproduction:** Open the curriculum directory, press Enter on “Computational Economics: 60 questions,” inspect the six units, then follow “Choose a practice session.” The destination shows AP Microeconomics selected. The expanded course has no course-specific practice link; the only lower practice link follows all 36 course disclosures. The active course list has no group navigation or filter, while the later planned curriculum does have area links.

**Evidence:** `src/pages/economics-practice/curriculum.astro:14–25` renders course/unit disclosures, followed by one `/economics-practice/` link; `src/pages/economics-practice/index.astro:16` renders the ungrouped native select. Browser observation confirmed the AP Microeconomics default after the directory handoff.

**Impact:** A student who has just selected a suitable advanced course must locate it again in a 36-option list. Sharing an instructor-recommended course or unit cannot preserve the selection through this UI.

**Recommended fix:** Add a “Practice [course]” link inside each active course disclosure and accept a validated course identifier, optionally a unit, in setup. Add area jumps or a lightweight filter for active courses if the directory remains this long. Preserve the accessible native select.

**Acceptance check:** Open Computational Economics from its directory entry, verify that setup retains the course and appropriate coverage, and verify invalid identifiers fall back safely. Confirm keyboard activation and Back behavior.

## 2. Disabled sign-in does not explain its unmet condition — P2, observed locally with source confirmation

**Reproduction:** Open the unsigned-in instructor page. It says “Sign in on the practice page with your instructor account” and links there. Follow that link: “Sign in with Google” is disabled and the response-service status says connected. There is no visible explanation that sign-in is unavailable in this environment. The DOM reports an empty `data-signin` and no `aria-describedby` on the sign-in button. The consent checkbox was unchecked; no consent or sign-in was submitted.

**Evidence:** `src/scripts/econ-practice.mjs:20` disables sign-in for any of unavailable service, unchecked consent, busy state or missing `data-signin`. Line 59 sets that attribute from `health.signInConfigured`, but always reports “Response service connected” on successful health response. `src/pages/economics-practice/index.astro:22–24` places sign-in before the later consent explanation. `src/pages/economics-practice/instructor/index.astro:11–12` instructs the user to sign in without knowing whether configuration permits it.

**Impact:** Disabled controls are skipped in ordinary keyboard tab order, and neither keyboard nor pointer users can determine whether to acknowledge storage, wait, or report configuration trouble. The instructor entry becomes a loop in this local configuration. This is **not** evidence that production sign-in is unconfigured.

**Recommended fix:** Show an adjacent, programmatically associated reason: acknowledge storage first; connecting; or sign-in unavailable in this environment. Keep service availability separate from identity availability. On the instructor page, avoid directing users into an unavailable identity flow when that state is known.

**Acceptance check:** Exercise configured/unconfigured identity, consent on/off, connection failure and loading states. Each disabled state should have a visible reason and an actionable next step when one exists.

## 3. Workbench screening results expose internal codes instead of actionable explanations — P2, source-confirmed usability concern

**Evidence:** `src/scripts/econ-irt-workbench.mjs:31` displays `m.blockingReasons.join(', ')` and every exclusion as `${key}: ${n}`. `src/lib/econ-practice/prepare-calibration.mjs:8–22,30–44` produces codes such as `invalid_assistance_metadata`, `too_few_person_responses`, `sparse_or_constant_item`, `constant_items_after_person_filter`, and `disconnected_item_design`. The file correctly preserves the caveat that passing screening does not validate a model, but no code-to-explanation mapping or relevant observed-versus-required value accompanies these result labels.

**Impact:** A knowledgeable instructor can recognize the statistical ideas but still has to consult implementation details to distinguish deficient data collection, invalid records and a chosen threshold. “Sparse or constant” merges different reasons for exclusion. The initial summary of retained people/items does not explain each failed screen.

**Recommended fix:** Translate codes to plain labels with specific counts and thresholds where available, retaining exact codes in the downloadable manifest or a technical disclosure. Distinguish invalid records from analyst choices and design limitations. Explain remedies as choices—collect additional responses, inspect excluded records, or review connectedness—without recommending threshold reduction merely to pass.

**Acceptance check:** Load a synthetic fixture with insufficient people, constant items and disconnected item administration; verify the rendered message explains each issue and matches the manifest. This pass did not browser-reproduce a populated result.

## 4. Results-table scrolling has no explicit keyboard-region contract — P2, source-only cross-browser accessibility risk

**Evidence:** `src/pages/economics-practice/instructor/index.astro:28–29` uses plain `div` containers for `irt-items` and `irt-answers`, with no focusability or accessible region names. `src/styles/econ-practice.css:19` gives those containers horizontal scrolling and a 650 px minimum table width. `src/scripts/econ-irt-workbench.mjs:7` correctly emits column headers with `scope="col"`, but rows contain only text cells, so there is no descendant control to make the overflow area naturally keyboard reachable.

**Impact:** At phone width or high zoom, the table necessarily requires horizontal scrolling. Some browsers automatically focus scrolling containers; this source does not ensure that behavior across supported browsers or identify the region’s purpose. It would be inaccurate to claim keyboard scrolling failed in the tested Chrome session: no populated table was loaded.

**Recommended fix:** Provide focusable, named scrolling regions when overflow is present, with a visible focus indicator and concise scrolling help if needed. Preserve table semantics and column headers. Alternatively provide a narrow-screen record layout while preserving comparability.

**Acceptance check:** Using populated synthetic tables, verify Tab reaches each overflow area and arrow keys reveal all columns in supported Chrome, Safari and Firefox at 375 px and 200% zoom. Test with a screen reader before calling the issue resolved.

## Suggested order

Fix course handoff and identity-state explanations first; they are visible in the tested workflow. Then verify populated-table keyboard behavior and improve screening-result labels using a synthetic fixture. This review changes no application behavior and makes no claim about authenticated instructor or production flows.
