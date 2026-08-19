# Reasoning Transformation Website Design

**Status:** Proposed implementation contract

**Date:** 2026-08-18

**Scope:** Website only. This specification does not change or publish CV files.

## 1. Outcome

The site will become a working demonstration of how Ian Helfrich approaches difficult questions. Its signature is not a decorative animation. It is a reversible transformation in which one analytical state passes through five useful representations:

1. a consequential question in ordinary language;
2. the variables, comparison, population, timing, assumptions, and decision rule inside that question;
3. a causal or measurement structure;
4. a live estimate with uncertainty and diagnostics;
5. a bounded explanation or decision brief.

Every visible change must reveal a real relationship in that state. A visitor can move forward, move backward, change an input, and trace any conclusion back to the evidence and assumptions that support it.

The result should feel unmistakably authored: intellectually serious, warm, experimentally minded, and useful. The site must communicate Ian's range through records and tools rather than superlatives.

## 2. Design thesis

The central visual idea is **state lineage**. A word in a question does not disappear and get replaced by an unrelated graphic. It keeps a stable identity as it becomes a variable, a node, a plotted mark, and part of a final sentence.

Examples:

- “increase” becomes the estimand, then an arrow or coefficient, then a point estimate, then the numerical phrase in the interpretation;
- “enough” becomes a decision threshold, then a rule on the plot, then the qualification in the decision brief;
- “for whom” becomes the target population, then a filter or grouping variable, then a distribution or subgroup comparison;
- an unverified assumption remains visibly unresolved and constrains the final language.

Stable `data-mark-id` values connect these forms. FLIP and Web Animations move the same conceptual objects across layouts. Color, position, line weight, and opacity have fixed meanings; they are never assigned merely to make a scene busier.

The site's most distinctive interaction is **reverse claim tracing**. Focusing or selecting a phrase in the final explanation illuminates the estimate, assumption, source, and question fragment from which it came. Selecting an earlier mark highlights every downstream representation it affects.

## 3. What the site will not become

- No particle field, cursor trail, generic parallax, floating blobs, decorative 3D scene, WebGL spectacle, or fake analytical dashboard.
- No large yellow semicircle, portrait overlay, colored portrait filter, or abstract shape competing with Ian's photograph.
- No infinite animation, scroll hijacking, inaccessible horizontal carousel, or interaction that requires a mouse.
- No motion whose only explanation is “it looks futuristic.”
- No public client, learner, or student-specific artifact.
- No invented paper, inflated contribution, unsupported result, or causal claim.
- No language calling Ian revolutionary, world-class, a secret, uniquely brilliant, or indispensable.
- No presentation of the NMTC paper as Ian's flagship, primary, or defining work. It is one public record among several.
- No use of the pink-shirt image at `public/people/ian.webp`.

## 4. Visitor experience

### 4.1 Human opening

The homepage opens with Ian's existing editorial portrait, `public/people/ian-editorial.webp`, shown clearly in a calm rectangular composition. It receives no distortion, clipping gimmick, color wash, or parallax. The portrait is the stable human anchor while the analytical material changes around it.

The opening copy is direct:

> I help people work through consequential questions by building models, tools, and explanations they can use.

The following sentence names the actual range in ordinary language: research, economic and policy analysis, quantitative design, teaching, and coaching. It does not stack slogans.

### 4.2 Signature transformation

Immediately after the introduction, a bounded “reasoning transformation” section presents one clearly labeled synthetic program-evaluation question:

> Did the program change completed applications enough to support expansion?

This example is generic and contains no client or administrative record. It is chosen because the full calculation, uncertainty, decision rule, and explanation can be shown honestly in the browser.

The five stages are:

1. **Question.** The sentence is readable as normal prose. Key phrases can receive focus, but the line remains a sentence.
2. **Design.** Phrases move into named fields: outcome, intervention, comparison, population, time, threshold, and assumptions. Missing information remains an explicit gap.
3. **Structure.** The fields organize into a causal or measurement diagram and a compact analysis table. Controls change only facts that are part of the synthetic scenario.
4. **Estimate.** The same state produces an interval plot, baseline comparison, decision threshold, diagnostics, and technical table.
5. **Explanation.** The system generates a technical sentence and a plain-language decision sentence. The wording changes when uncertainty or assumptions change. Claim tracing connects each phrase back to its source.

A stage rail, Previous/Next buttons, direct stage links, and keyboard shortcuts make the sequence reversible. Normal page scrolling remains intact. The component may use a sticky canvas within its own bounded section on desktop, but it releases the page before and after the sequence. Mobile uses a normal stacked layout with a compact stage control; it does not pin the viewport.

### 4.3 Initial choreography

When the signature first enters the viewport and `prefers-reduced-motion` is not set, the question performs one short, 2.4-second preview:

- the sentence's key phrases separate;
- a faint lineage connects them to their design fields;
- they return to the complete question;
- the interface rests at Stage 1.

The preview runs once per page visit, stops immediately on interaction, and never loops. The visitor controls all subsequent movement.

### 4.4 Four entry perspectives

The site offers four quiet entry perspectives without turning the homepage into four separate products:

- **Research collaborator:** questions, methods, contribution, status, evidence, and limits.
- **Organization or client:** decision, constraints, design, deliverable, result, and limit.
- **Learner:** question, representation, calculation, diagnostic, and explanation.
- **Hiring team:** range of work, role in each record, public evidence, teaching, service, and availability.

Changing perspective reorders and labels public records; it does not alter facts. The default perspective is a general overview. The selection is encoded in the URL so a visitor can share it.

## 5. Whole-site application

The signature logic becomes a shared design language, not a homepage-only demo.

### Homepage

- Keep the editorial portrait and concise identity copy.
- Replace the competing homepage research-force graph with the reasoning transformation.
- Follow it with a visual evidence browser that groups real records by question, status, role, method, and limit.
- Preserve an obvious route to Work, Research, Teaching & Coaching, CV, and Contact.

### Research

- Begin with research questions, not a wall of titles.
- Let records organize by verified metadata when the visitor changes topic or stage.
- Use motion to show why records are connected: a shared method, subject, data form, or question. Do not imply one unified research program where none exists.
- Each detail page shows question, status, role, method, evidence, and limit before the abstract.
- The existing research graph can live here after its grammar and accessibility defects are corrected.

### Work and consulting

- Each case moves through question, structure, what Ian built or contributed, what the public record shows, and the current limit.
- Motion reveals the relationship among these fields; it does not manufacture a result.
- KSA-focused analysis, Toyota Research Institute/Carnegie Mellon location strategy, NNCTA contribution, spatial work, research software, and other verified experience receive proportionate space.

### Teaching & coaching

- Adapt the existing representation relay so one quantity remains synchronized across words, equation, table, graph, and code.
- Present university teaching, online teaching, tutoring, and executive-level quantitative research-design coaching as one coherent practice without naming individual learners.
- Keep `1,035+` Wyzant hours and `Over 1,000` private-practice hours as separate records with dates and sources. The numbers support sustained experience; they are not the page's visual thesis.

### Applied Statistics and practical tools

- The Applied Statistics detail page remains a real tool, not a showcase card.
- Connect the question, derivation, pooled and Welch estimators, binary OLS with HC2, diagnostics, identification boundary, code, and interpretation.
- Add keyboard-equivalent point editing to the least-squares interaction before calling it fully accessible.
- List software versions only after they are implemented and tested.

### About

- Keep the portrait, biography, service, martial arts, ThirdSpace, and personal context restrained and human.
- Use only quiet entrance motion and state-preserving navigation. The About page is not another laboratory.

### CV, contact, and archival pages

- Use the same typography, spacing, navigation, and route transitions.
- Avoid analytical animation where it does not help the visitor.
- Keep archival and learner-specific materials out of primary discovery.

## 6. Visual system

### 6.1 Palette

The interface uses a bright, high-contrast field rather than cream, navy, copper, or teal:

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F7F8FC` | Primary background |
| Graphite | `#111318` | Text, rules, primary marks |
| Sky | `#78BDE8` | Secondary grouping and hover lineage |
| Electric blue | `#1F5BFF` | Active state, links, selected evidence |
| Sun | `#FFD43B` | Small numerical/focus accents only |
| Signal red | `#E84749` | Assumption warning or failed boundary only |
| White | `#FFFFFF` | Figure and control surfaces |

Sun yellow may occupy no more than 8% of a viewport and is never used as a large decorative field or semicircle. Signal red is semantic, not ornamental.

### 6.2 Typography

All fonts are self-hosted with licenses stored in the repository:

- **Onest Variable** for body copy, navigation, controls, and labels;
- **Instrument Serif Variable** for major editorial headings and selected question text;
- **Commit Mono Variable** for numbers, equations, code, provenance, and diagnostic labels.

The type system uses no browser fallback as a design state. Major headings stay between 8 and 12 words per line, never break a word, and use optical sizing where supported. Body text targets 18px/1.58 with a 62–68 character measure. Data text never drops below 12px; controls never below 14px.

### 6.3 Geometry

- The base grid is rectilinear and precise.
- Organic character comes from paths derived from actual relationships: confidence envelopes, causal paths, residual arcs, and shared-metadata connections.
- Corners are mostly square or subtly softened. There is no generic pill-card system.
- Large empty areas provide rhythm and keep analytical scenes legible.
- Rules and connectors use variable weight to indicate hierarchy or uncertainty, never decoration.

## 7. Motion language

Motion has a small, explicit vocabulary:

| Motion | Meaning |
| --- | --- |
| Translate | A concept retains identity in a new representation |
| Gather | Several observations form a summary or model |
| Separate | A comparison, subgroup, or assumption becomes explicit |
| Widen/narrow | Uncertainty changes |
| Fade to outline | Evidence is unavailable, unverified, or outside scope |
| Trace | A claim is linked to its source |
| Settle | A model or explanation reaches its current bounded state |

Implementation uses CSS transforms, SVG path interpolation where both paths share a tested topology, FLIP, and the Web Animations API. Spring or elastic easing is prohibited for statistical values. Default easing is restrained and short: 180–520ms for direct manipulation, up to 900ms for a stage transformation.

Animated numerical values update monotonically between valid endpoints. Uncertainty bands and thresholds cannot overshoot their true state. Completed values are announced only after motion settles; live regions do not narrate every frame.

## 8. Component and state architecture

The site remains Astro 7 and statically rendered. No React, Vue, animation framework, WebGL runtime, or client-side router is added.

### New boundaries

- `ReasoningTransformation.astro`: semantic server-rendered shell and slots.
- `reasoning-scenarios.mjs`: adapters over canonical research and work records plus labeled synthetic scenarios.
- `reasoning-reducer.mjs`: pure state transitions and derived estimates, diagnostics, and claims.
- `QuestionGrammar.astro`: sentence and named design fields.
- `DesignDiagram.astro`: causal/measurement structure and analysis table.
- `LiveModelPlot.astro`: interval, threshold, baseline, and diagnostics.
- `DecisionReadout.astro`: technical language, plain-language brief, and claim tracing.
- `reasoning-motion.ts`: state-lineage FLIP/WAAPI only.
- `reasoning-url.mjs`: versioned, allow-listed URL serialization.

### Canonical state

```js
{
  version,
  perspective,
  scenarioId,
  stage,
  question,
  outcome,
  intervention,
  comparison,
  population,
  time,
  assumptions,
  baseline,
  estimate,
  standardError,
  interval,
  threshold,
  diagnostics,
  interpretation,
  limit
}
```

All five views derive from this state. Components do not maintain competing copies of effect sizes, labels, statuses, or project metadata.

### Existing code to retain or extract

- Reuse the evidence contract from `EvidenceAperture.astro`: question, caption, status, method, role, limit, links, and live region.
- Reuse the tested synchronized-representation math from `RepresentationRelay.astro` and `src/lib/fieldbook-math.mjs`.
- Reuse and extend the tested least-squares logic from `LeastSquaresLab.astro` and `fitLeastSquares`.
- Extract the useful causal design and OLS adjustment from `ConfoundingLab.astro` into pure tested functions before reuse.
- Extract the estimate/interval/threshold/claim logic from `ModelToMessageRelay.astro` into the reducer before reuse.
- Use `CounterfactualAtlas.astro` only as a source of tested design ideas. Do not mount or expand its 1,797-line monolith.
- Continue to source research facts from `src/content.config.ts` records and work facts from `src/data/work-cases.mjs`.
- Replace the homepage `ResearchGraph`; do not run it beside the new signature component.

## 9. Progressive enhancement and accessibility

### Without JavaScript

All five stages render in the HTML as readable sections with the default values, table, interpretation, source note, and limit. Direct links work. The page never presents empty plots or zero placeholders as if they were results.

### Reduced motion

`prefers-reduced-motion: reduce` disables the preview, spatial morphs, animated counters, and state-preserving route transitions. Stage changes are immediate with a short opacity change. Content, values, focus order, and controls remain identical.

### Keyboard and assistive technology

- Every stage and scenario is reachable by keyboard.
- Every pointer manipulation has buttons or typed inputs that produce the same state.
- Touch targets are at least 44 by 44 CSS pixels at 320px width.
- SVGs have a useful title and description; decorative paths are hidden.
- Focus remains visible and is restored to the correct trigger after dialogs and mobile navigation close.
- IDs are unique after client scripts run.
- Status announcements occur on completed, user-requested changes only.
- Color is never the sole carrier of status or lineage.

## 10. Content and evidence rules

- Use natural nouns and complete sentences. Avoid slogan pairs, laboratory jargon in navigation, and repeated words such as “proof,” “instrument,” “defend,” “inspect,” “unlock,” and “turn.”
- Do not use “poorly framed.” Use constructive language about clarifying a question.
- Explain jargon once in plain language, then retain the correct technical term for expert readers.
- Label synthetic, simulated, development, working-paper, circulating, and archival material literally.
- Show role separately from authorship and project status.
- Preserve NMTC sole authorship and original-idea attribution; name Katia Antunes and Elizaveta Gonchar as contributors, not coauthors.
- Do not publish “Human or Machine? Out-of-Time Validation of Task-Level AI Exposure Ratings” as a completed paper unless a manuscript and authorship record are verified from Ian's files.
- Treat private consulting and teaching work generally unless a public, permissioned record supports specifics.
- Do not let a volatile metric become the visual anchor of a page.

## 11. URL, persistence, and failure behavior

- The URL stores only a version, public scenario ID, perspective, stage, and bounded numeric inputs.
- Unknown keys are ignored. Invalid values reset to the documented default and produce no exception.
- No free-form visitor text, client information, or personal data is written to a URL or storage.
- Shared-element route transitions preserve only public analytical state.
- If a calculation fails, the plot does not fabricate a mark. The static table remains, the component identifies the unavailable output, and the visitor can reset.
- If a referenced public artifact is unavailable, the page suppresses the action and identifies the record's current status.
- Clipboard failure leaves the brief selectable and reports the failure beside the button.

## 12. Performance budget

- New reasoning-transformation client code: at most 40 KB gzip.
- Total homepage application JavaScript, excluding on-demand Pagefind: at most 75 KB gzip.
- No new code is added to the global bundle unless every route uses it.
- Hydrate the transformation only near the viewport; run `requestAnimationFrame` only during active motion or manipulation.
- Prefer DOM and SVG. Canvas is allowed only when the visible record count makes DOM/SVG measurably slower.
- Self-host fonts; no runtime font or analytics request is required to render the page.
- Target mobile Lighthouse: performance at least 90, accessibility at least 95, CLS below 0.05, and no long task above 200ms during the signature interaction.

The current global CSS is already large. The redesign must remove or route-scope obsolete fieldbook and instrument styles rather than stacking another permanent design layer on top.

## 13. Verification and release gate

### Pure logic

- Reducer transitions, interval math, thresholds, derived language, URL parsing, and scenario adapters have unit tests.
- Property tests verify that every final claim phrase has a valid source lineage and that invalid inputs cannot produce a quantitative claim.
- Existing OLS and representation-equivalence tests remain green.

### Rendered behavior

- Test 1440×900, 390×844, and 320×568.
- Test keyboard-only, touch/pointer, JavaScript disabled, reduced motion, forced colors, and 200% zoom.
- Test stage reversal, reset, deep links, malformed links, claim tracing, and cross-route state restoration.
- Run axe and an explicit duplicate-ID scan after all client scripts execute.
- Require zero console errors, unhandled rejections, broken images, and horizontal overflow.
- Verify that every visible numerical mark matches the reducer state after resize and animation cancellation.

### Factual, privacy, and voice checks

- Continue the existing discovery, CV-safety, archive, and public-record checks.
- Add website assertions for separate `1,035+` Wyzant and `Over 1,000` private-practice wording.
- Add assertions that learner-specific names and withheld research titles do not enter indexed pages.
- Add a copy scan for prohibited superlatives and the rejected “poorly framed” phrase.
- Review every research record's title, authorship, role, status, result, and limit against its canonical source.

### Production verification

Local success is insufficient. After deployment, crawl every public route and asset from `https://ihelfrich.github.io/`, verify Pagefind results, and compare the deployed commit to the intended commit. This gate must catch missing assets such as the three currently broken `/gis/` portfolio links.

Known defects to close during implementation:

- `/gis/` currently exposes two dead PDF links and one broken image in production.
- the research-map readout says “1 records” for a single result;
- `/teaching/` creates a duplicate `id="representation-relay"` after the field-rail script runs;
- closing the Site Index from mobile navigation with Escape returns focus to `<body>` instead of the Menu button.

## 14. Delivery sequence

This architecture is delivered as three bounded subprojects. Each receives its own implementation plan and review gate.

1. **Foundation and signature:** replace the homepage research graph with the reasoning transformation; add canonical state, reducer, motion, no-JS rendering, perspective routing, visual tokens, portrait composition, and tests.
2. **Route integration:** migrate Research, Work, Teaching & Coaching, and Applied Statistics to the shared state-lineage language; correct the known runtime and copy defects; remove obsolete global styles.
3. **Release hardening:** full browser matrix, performance work, factual/privacy review, clean build, deployment, and post-deployment crawl.

No production deployment occurs between subprojects. The complete redesign is published only after the final clean-build and live-site gates pass and Ian approves the resulting site.

## 15. Acceptance criteria

The redesign is ready for implementation when all of the following are agreed:

- The editorial portrait is the stable human anchor and the pink-shirt image never appears.
- The signature interaction shows one state changing through question, design, structure, estimate, and explanation.
- Any conclusion can be traced backward to evidence and assumptions.
- Motion is reversible, semantically fixed, keyboard accessible, and fully reduced when requested.
- The site describes Ian's full verified range without making NMTC the center of his identity.
- The visual system uses bright paper, graphite, sky/electric blue, sparing sun yellow, and semantic red; it does not use cream, navy, copper, or teal.
- Typography is Onest, Instrument Serif, and Commit Mono, self-hosted and licensed.
- Copy is natural, constructive, specific, and modest.
- Public tools remain useful without animation and without JavaScript.
- Local and deployed-site verification both pass before publishing.
