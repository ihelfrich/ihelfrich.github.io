# Evidence Fieldbook design system

The site is one evidence fieldbook across research, teaching, software, and advisory work. Its visual authority comes from legible hierarchy, disciplined evidence, and explicit limits—not page-specific brands or decorative effects.

## Palette

The brand layer has exactly six colors.

| Token | Value | Role |
| --- | --- | --- |
| `--ef-ink` | `#11131D` | Text, rules, and dark fields |
| `--ef-paper` | `#F1F3F2` | Cool mineral page field |
| `--ef-figure` | `#FFFFFF` | Figures, tables, code, and focused reading |
| `--ef-signal` | `#3156E8` | Links, focus, current selection, and live calculation |
| `--ef-teal` | `#28706B` | Positive or comparative annotation |
| `--ef-oxide` | `#9E4D38` | Limits, caveats, and negative annotation |

Derived rules and muted text use `color-mix()` from these six tokens. Do not add named brand colors. No gradient is part of the brand layer. Color never carries status alone; pair it with text, shape, line style, or an icon.

## Typography

Typography is local, variable, and role-based.

| Token | Local family | Use |
| --- | --- | --- |
| `--font-display` | Geist Variable | Page titles, masthead, navigation, and high-level headings; usually 500–650 |
| `--font-text` | Newsreader Variable | Explanations, abstracts, case narratives, essays, and long reading |
| `--font-data` | Geist Mono Variable | Status, dates, roles, methods, coefficients, citations, code, captions, and controls |

`fieldbook.css` declares the WOFF2 files with `font-display: swap`, explicit weight ranges, and durable system fallbacks. The assets, checksums, pinned sources, and licenses are recorded in `public/fonts/PROVENANCE.md`.

Legacy `--font-serif`, `--font-sans`, `--font-mono`, and `--ih-*` names are compatibility aliases only. New CSS must use the canonical roles directly. Owned shared styles already do so; component-local aliases disappear as those components migrate.

Type scale:

- H1: `clamp(3rem, 7vw, 7.5rem)`, line-height about `0.94`, one oversized title per page.
- H2: `clamp(2rem, 4vw, 4rem)`, line-height about `1.04`.
- Question/deck: `clamp(1.3rem, 2vw, 1.8rem)` in Newsreader.
- Body: `clamp(1rem, 1.1vw, 1.125rem)`, line-height `1.67`, target measure `68ch`.
- Data/caption: `0.72–0.82rem`, line-height at least `1.4`; uppercase only for short labels.

Large type signals hierarchy. It is not a substitute for a claim, and it does not repeat as a billboard in every section.

## Grid and spacing

Desktop uses a 12-column grid within 1440px, fluid outer padding `clamp(1.25rem, 4vw, 4rem)`, and gutters `clamp(1rem, 2vw, 1.5rem)`.

- Narrative: columns 2–8, capped at `68ch`.
- Evidence/status/limit margin: columns 9–11.
- Figures: columns 2–11 when their evidence needs the width.
- At 960px: eight columns, narrative 1–5 and margin 6–8.
- At 720px: one reading column; margin evidence follows the paragraph it supports.

Spacing is semantic: 4, 8, 12, 20, 32, 52, 84, and 136px. Figures and tables use square corners. Controls may use a 6px radius when a tactile boundary helps. Universal cards, floating shadows, and page-level horizontal overflow are excluded.

## Evidence aperture

The signature element is a bounded evidence aperture joining:

1. a consequential question in ordinary language;
2. a real figure, model, map, dataset, lesson, or interface;
3. a result or current status;
4. a plain interpretation;
5. an explicit limit;
6. a public artifact to inspect.

The shell is a semantic frame, not a decorative card. Important meaning remains in HTML outside canvas or SVG, and margin evidence is never hidden on mobile.

## Shell and navigation

Primary navigation is fixed in this order: Work, Research, Teaching, About, CV. Index is a utility; Contact is the single action. Job market and other records remain contextual and in the restrained footer.

On mobile, navigation opens as a full-width modal sheet below the masthead. The button visibly changes from Menu to Close and remains inside the managed focus order. Opening locks body scroll, isolates background regions with `inert` plus an `aria-hidden` fallback, and moves focus into the sheet; focus is trapped; Escape, backdrop, and selection close it; Escape and backdrop restore focus. Without JavaScript, the same navigation remains in normal flow. Primary links, secondary records, Index, and Contact are grouped rather than flattened into one list.

## Motion, accessibility, and print

Motion has two causes: a real calculation resolves, or a visitor changes state. Ambient drift, parallax, looping ornaments, and decorative page fades are excluded. Reduced-motion mode makes state changes immediate without removing content.

Focus is always visible in signal blue. Shell links and controls provide at least 44×44 CSS-pixel hit areas. Dark titles maintain at least 4.5:1 contrast. Forced-colors mode preserves control boundaries and focus. Print removes navigation and live chrome, uses black on white, and avoids breaking an aperture across pages when possible.

## Release contract

`npm run check:styles` blocks missing/malformed local fonts, remote font requests, incorrect palette values, unresolved canonical type roles, dark-title contrast failures, and regressions in the mobile navigation contract. The build remains readable when webfonts are blocked and functional when JavaScript is disabled; enhanced navigation behavior is verified with JavaScript enabled.
