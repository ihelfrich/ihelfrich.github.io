# Design tokens and the Property Lab recomposition

Date: 2026-09-17. Status: approved in conversation by Dr. Helfrich. Part 1 (token layer) deployed 2026-09-17 (PR #10); Part 2 (Property Lab recomposition) implemented on branch property-lab-recomposition.

## Problem

The hub declares six brand colors in `src/styles/fieldbook.css`, but its stylesheets and components use 556 distinct hex values plus about 280 `rgba()`/`hsl()` literals. Nothing enforces the token layer, so every subproject invented colors. Restyling the site means editing thousands of lines.

The St. Louis Property Lab (`/st-louis/`) is the most visible symptom: eleven dedicated stylesheets (about 3,000 lines), its own typeface (Space Grotesk), a dark glass palette, and overlapping floating panels. Dr. Helfrich's verdict: it reads as a pile of subprojects rather than a designed product, it does not look like the rest of the site, and it is too dense.

## Goals

1. One file defines how the site looks. Changing a color, a type role, a spacing step, or a motion duration happens in `src/styles/tokens.css` and nowhere else.
2. The boundary is enforced by the release gate, so drift cannot return.
3. The Property Lab is recomposed on that layer in the Evidence Fieldbook language, calmer, with every existing function preserved.
4. The token vocabulary mirrors `~/Developer/templates/typst/tokens.typ` (ink, muted, hairline, accent, highlight, wash) so print and web share one mental model.

## Non-goals

- No change to the Property Lab's data, scripts, analysis, or element ids. The 7,500 lines under `src/scripts/city/` and the 81 `city-*` unit tests are untouched.
- No feature removal in the Property Lab.
- No framework change. Astro and hand-authored CSS stay.
- The econometrics course keeps its distinct layout in this pass; it adopts the token file but is not redesigned.

## Part 1: the token layer

### File and tiers

`src/styles/tokens.css` is imported first by `Base.astro`, `Econometrics.astro`, and the St. Louis page. It has three tiers.

**Tier 1, primitives.** A named palette derived from the colors the site actually uses today, clustered so that every existing color maps to a primitive within a perceptual distance of ΔE ≤ 2 (CIE76 on Lab). Names are descriptive of hue family and lightness, not of use: `--p-neutral-07`, `--p-blue-47`, `--p-teal-42`, `--p-red-45`, `--p-gold-80`, where the number is CIE L\* rounded to two digits and a letter suffix disambiguates collisions. The six brand colors keep readable aliases (`--p-ink`, `--p-paper`, `--p-figure`, `--p-signal`, `--p-teal`, `--p-oxide`). The count is whatever ΔE ≤ 2 yields from today's colors; the migration report includes a consolidation table proposing merges at ΔE ≤ 6 within a family for Dr. Helfrich's approval, since merging is a visible design decision and not part of the mechanical pass. Alpha variants are expressed as `color-mix(in srgb, var(--p-x) N%, transparent)` at use sites, never as new primitives.

**Tier 2, semantic roles.** The only tier components may reference for color. Light palette on `:root`; dark palette under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. Roles:

| Role | Meaning | Typst analogue |
| --- | --- | --- |
| `--surface` | page ground | wash |
| `--surface-raised` | figures, tables, code, panels | (white) |
| `--surface-sunken` | wells, inputs at rest | |
| `--ink` | body text, rules that carry meaning | ink |
| `--ink-muted` | secondary text, captions, labels | muted |
| `--rule` | hairline dividers | hairline |
| `--rule-strong` | structural rules | |
| `--accent` | links, focus, selection, live calculation | accent |
| `--accent-ink` | text placed on `--accent` | |
| `--highlight` | sparing emphasis | highlight |
| `--positive` | comparative or positive annotation | |
| `--caution` | limits, caveats, negative annotation | |
| `--focus-ring` | keyboard focus | |

The existing `--ef-*` names remain as aliases of these roles for one release so nothing breaks; `DESIGN_SYSTEM.md` marks them deprecated and the lint forbids new uses.

**Tier 3, scales.** Type roles (`--font-display`, `--font-text`, `--font-data`), the type scale, the semantic spacing steps already documented (4, 8, 12, 20, 32, 52, 84, 136 px as `--space-1` … `--space-8`), radii, motion durations and easings, and layout constants. These move from `fieldbook.css` into `tokens.css` unchanged in value.

### Surfaces

A surface is a bounded region with its own semantic palette. It is declared with `data-surface="<name>"` on the region root and defined in `tokens.css` as an override of Tier 2 roles only. Two surfaces ship: `lab` (the Property Lab) and `course` (the econometrics layout, mapping its current navy palette so it does not change visually). A surface may not introduce a primitive; it recombines existing ones.

### Migration

A script, `scripts/migrate-colors.mjs`, run once and kept for audit:

1. Collects every hex, `rgb()`, `rgba()`, `hsl()` literal in `src/styles`, `src/components`, `src/pages`, `src/layouts`.
2. Clusters them to primitives at ΔE ≤ 2. Alpha literals map to `color-mix(... transparent)` of the matched primitive with the same alpha.
3. Rewrites each literal to `var(--p-…)` or the `color-mix` form, and writes a report listing every replacement with file, line, original, and target.
4. Pure-white and pure-black literals inside SVG `fill`/`stroke` attributes in components are left alone when the SVG is a data figure whose colors are semantic to the figure (the report flags them for hand review).

The migration intends no visible change. It is verified by rendering every page before and after with the same happy-dom pipeline `check-rendered-styles.mjs` already uses and comparing the computed `color`, `background-color`, and `border-color` of every element; any element whose color moved by more than ΔE 2 fails the check. That comparison is a one-off script in `scripts/`, not a permanent gate.

After the mechanical pass, `instrument.css`, `global.css`, and the component styles are re-pointed from primitives to roles by hand where the role is clear (text to `--ink`, page ground to `--surface`, links to `--accent`). Where it is not clear, the primitive reference stays; the report lists these for later.

### Enforcement

`scripts/check-tokens.mjs` (new, wired into `npm run check` and the deploy workflow as `check:tokens`):

- No hex, `rgb()`, `rgba()`, `hsl()`, or named CSS color literal outside `src/styles/tokens.css`. Allowed exceptions are listed in the script with a reason (for example, the `theme-color` meta and the Cesium canvas clear color).
- No new `--ef-*` declarations outside `tokens.css`.
- Component CSS may reference Tier 2 and Tier 3 tokens. A Tier 1 reference outside `tokens.css` is a warning during the migration release and an error afterwards.
- `tokens.css` parses, every role is defined on bare `:root`, and every role redefined in a dark block or a surface exists on `:root`.

### Documentation

`DESIGN_SYSTEM.md` gains a "Tokens" section that replaces the "Palette" table: how the tiers relate, how to add a surface, and the rule that a new color starts as a primitive in `tokens.css` and is exposed through a role. The "Property Lab workspace" section is rewritten after Part 2.

## Part 2: Property Lab recomposition

### Principle

The map is the figure. Everything else is margin evidence. One thing is open at a time.

### Structure

The DOM keeps every id the scripts bind to. The page is regrouped into four regions:

1. **Masthead** (`.city-header`): the hub's brand mark returning to `/`, the lab title in Geist, the address search, and the conditions readout as a single quiet line. No glass, no floating card.
2. **Figure** (`#city-viewport`): the Cesium scene, full bleed, light sky. Camera controls sit in one vertical cluster at the bottom right, drawn as the hub's controls (6 px radius, `--surface-raised`, `--rule` border).
3. **Rail** (`#explorer`): a single inspector rail on the right, `--surface-raised`, one `--rule` edge, 24 rem wide on desktop, a bottom sheet on phones. It hosts the four destinations as a segmented control at its top: Map, Activity, Notebook, Tools. Exactly one destination is visible. Tools shows Site, Inventory, Pro forma, Develop as a list; choosing one opens it in the same rail with a back affordance. `#panel-content` and every panel section keep their ids; only their container and styling change.
4. **Record prose**: property records, evidence notes, and methods text set in Newsreader at the hub's body size; labels, values, dates, and codes in Geist Mono at the data size. The `.eyebrow`, `.small-note`, `.range-label` classes are restyled, not renamed.

### Palette

`data-surface="lab"` on `#city-app`. Roles map to the hub's light palette with one difference: `--surface` is the hub paper so the rail and masthead read as the same site, while the Cesium canvas keeps its own sky and terrain rendering. Source semantics used by the map layers (ownership, development, utilities colors) become Tier 1 primitives named for their meaning (`--p-layer-ownership`, and so on) and are exposed through a small set of `--layer-*` roles defined inside the `lab` surface, so the legend and the renderer read the same variables.

### Type

Geist for interface and headings, Newsreader for record prose, Geist Mono for data. Space Grotesk is removed from the page; the font file and its licence stay in `public/fonts/` until the provenance record is updated in the same PR.

### Motion

Five transitions, all on the existing motion tokens, all disabled under `prefers-reduced-motion`:

- rail destination change: cross-fade 140 ms;
- record arrival: rise 8 px and fade, 240 ms with the enter easing;
- rail open and close on phones: slide, 240 ms;
- camera focus: unchanged (owned by the scene script);
- loading: the existing orbit indicator, recolored to `--accent`.

Every other transition and keyframe in the eleven stylesheets is dropped.

### Stylesheets

The eleven `st-louis*.css` files are replaced by three: `st-louis-surface.css` (surface tokens and page frame), `st-louis-rail.css` (destinations, panels, records), `st-louis-map.css` (viewport, camera controls, legend). Each uses only Tier 2 and Tier 3 tokens. Target under 1,200 lines total.

### Verification

- The 81 `city-*` unit tests and `check:city` pass unchanged.
- `check:styles` passes, including its existing Property Lab assertions, and `check:tokens` passes.
- Browser verification at 1440 px and 375 px: load, search an address, open a record, switch all four destinations, open each tool, keyboard through the rail, and confirm no horizontal page scroll. Screenshots are attached to the PR.
- `DESIGN_SYSTEM.md` "Property Lab workspace" rewritten to describe the new structure and to record the typeface change as a September 17 decision superseding the earlier Space Grotesk preference.

## Delivery

Two pull requests, each merged and deployed independently:

1. **Token layer** (`design-tokens` branch): `tokens.css`, migration and its report, `check-tokens.mjs`, aliases, docs. No visible change intended; verified by the before/after computed-color comparison and the full gate chain.
2. **Property Lab** (`property-lab-recomposition` branch): the four-region recomposition, three stylesheets, `lab` surface, motion set, docs. Verified as above.

## Risks

- Other agents push to `main` daily. Both branches rebase before merge, and the token lint will flag any raw color that lands in between.
- The Cesium scene reads some colors from JavaScript (materials, tone presets). Those stay in JavaScript in this pass; the lint scope is CSS and Astro styles. A follow-up can move them to `getComputedStyle` reads of the `--layer-*` roles.
- The 12 city tests that inspect `classList` depend on class names, which are preserved.
