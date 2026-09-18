# Design Token Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every color, type role, spacing step, and motion value the hub uses into one file, `src/styles/tokens.css`, migrate all 556 raw colors onto it with no visible change, and make the build fail if a raw color ever appears outside that file again.

**Architecture:** Three tiers in one stylesheet: primitives (`--p-*`, derived from the colors in use today by clustering at ΔE ≤ 2), semantic roles (`--surface`, `--ink`, `--accent`, …, the only color tier components may use), and scales (type, space, radius, motion, layout, moved verbatim from `fieldbook.css`). A migration script rewrites literals to primitives; six brand primitives are rewritten straight to roles; `var(--x, #fallback)` forms lose their fallback. A lint script guards the boundary. Surfaces (`data-surface="course"`) override roles only.

**Tech Stack:** Astro 7, plain CSS with `color-mix()`, Node 22 scripts (no new dependencies), `node --test`, happy-dom (already a devDependency) for the before/after check, the browser pane for screenshots.

**Spec:** `docs/superpowers/specs/2026-09-17-design-tokens-and-property-lab-design.md` (Part 1). Part 2 (Property Lab) gets its own plan after this one lands.

## Global Constraints

- No new npm dependencies.
- No visible change intended: every replaced literal resolves to a color within ΔE 2 (CIE76) of the original.
- Scope of the migration and the lint: `.css` files under `src/styles` and `<style>` blocks in `.astro` files under `src/components`, `src/pages`, `src/layouts`. JavaScript (including `<script>` blocks) and SVG attributes are out of scope for this pass and are reported, not rewritten.
- Element ids, class names, and the St. Louis scripts are untouched.
- Every existing gate keeps passing: `check:copy`, `check:fieldbook`, `check:navigation`, `check:components`, `check:city`, `check:macroeconomics`, `check:calculus`, `check:ols`, `build:fast`, `check:styles`, `check:econometrics`, homepage suites, `check:public-cv`, Pagefind, `check:discovery`.
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch: `design-tokens`, cut from `origin/main` on 2026-09-17. Rebase on `origin/main` before the PR; other agents push to main daily.

---

### Task 1: Color math library with tests

**Files:**
- Create: `scripts/lib/color.mjs`
- Test: `tests/unit/color-lib.test.mjs`

**Interfaces:**
- Produces: `parseColor(text) -> {r,g,b,a} | null` (0–255 channels, `a` 0–1; accepts `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()` with comma or space syntax), `toLab({r,g,b}) -> {L,a,b}`, `deltaE(lab1, lab2) -> number` (CIE76), `hexOf({r,g,b}) -> "#rrggbb"`, `familyOf(lab) -> "neutral"|"red"|"gold"|"green"|"teal"|"blue"|"violet"`, `primitiveName(lab, taken:Set) -> "--p-<family>-<LL>[a-z]"`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/color-lib.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseColor, toLab, deltaE, hexOf, familyOf, primitiveName } from "../../scripts/lib/color.mjs";

test("parses every literal form the stylesheets use", () => {
  assert.deepEqual(parseColor("#11131D"), { r: 17, g: 19, b: 29, a: 1 });
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("#3156E880"), { r: 49, g: 86, b: 232, a: 128 / 255 });
  assert.deepEqual(parseColor("rgba(16, 42, 67, 0.05)"), { r: 16, g: 42, b: 67, a: 0.05 });
  assert.deepEqual(parseColor("rgb(16 42 67 / 50%)"), { r: 16, g: 42, b: 67, a: 0.5 });
  assert.deepEqual(parseColor("hsl(0 0% 100%)"), { r: 255, g: 255, b: 255, a: 1 });
  assert.equal(parseColor("var(--ef-ink)"), null);
  assert.equal(parseColor("#12"), null);
});

test("lab distance separates brand colors and joins near-duplicates", () => {
  const ink = toLab(parseColor("#11131D")); const paper = toLab(parseColor("#F1F3F2"));
  assert.ok(deltaE(ink, paper) > 80);
  assert.ok(deltaE(toLab(parseColor("#8f8a83")), toLab(parseColor("#8f8b84"))) < 1);
  assert.ok(deltaE(toLab(parseColor("#f1f3f2")), toLab(parseColor("#f3f3f1"))) < 2);
});

test("families and names are stable", () => {
  assert.equal(familyOf(toLab(parseColor("#11131D"))), "neutral");
  assert.equal(familyOf(toLab(parseColor("#3156E8"))), "blue");
  assert.equal(familyOf(toLab(parseColor("#28706B"))), "teal");
  assert.equal(familyOf(toLab(parseColor("#9E4D38"))), "red");
  assert.equal(familyOf(toLab(parseColor("#f3cc78"))), "gold");
  const taken = new Set();
  const first = primitiveName(toLab(parseColor("#3156E8")), taken); taken.add(first);
  const second = primitiveName(toLab(parseColor("#3156E8")), taken);
  assert.match(first, /^--p-blue-\d\d$/);
  assert.equal(second, `${first}b`);
  assert.equal(hexOf(parseColor("#3156E8")), "#3156e8");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/unit/color-lib.test.mjs`
Expected: FAIL, cannot find module `scripts/lib/color.mjs`.

- [ ] **Step 3: Implement**

```js
// scripts/lib/color.mjs
const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));

export function parseColor(text) {
  const s = String(text).trim();
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/i.exec(s))) {
    const h = m[1];
    if (![3, 4, 6, 8].includes(h.length)) return null;
    const full = h.length <= 4 ? [...h].map((c) => c + c).join("") : h;
    const n = (i) => parseInt(full.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
  }
  if ((m = /^rgba?\(\s*([^)]+)\)$/i.exec(s))) {
    const parts = m[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const ch = (v) => (v.endsWith("%") ? (parseFloat(v) / 100) * 255 : parseFloat(v));
    const a = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    return { r: clamp255(ch(parts[0])), g: clamp255(ch(parts[1])), b: clamp255(ch(parts[2])), a };
  }
  if ((m = /^hsla?\(\s*([^)]+)\)$/i.exec(s))) {
    const parts = m[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360, sat = parseFloat(parts[1]) / 100, l = parseFloat(parts[2]) / 100;
    const a = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = l - c / 2;
    const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: clamp255((r1 + m0) * 255), g: clamp255((g1 + m0) * 255), b: clamp255((b1 + m0) * 255), a };
  }
  return null;
}

const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export function toLab({ r, g, b }) {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 1.0;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), b: 200 * (f(Y) - f(Z)) };
}

export const deltaE = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

export const hexOf = ({ r, g, b }) => "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");

export function familyOf(lab) {
  const chroma = Math.hypot(lab.a, lab.b);
  if (chroma < 8) return "neutral";
  const hue = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  if (hue < 40 || hue >= 340) return "red";
  if (hue < 105) return "gold";
  if (hue < 160) return "green";
  if (hue < 215) return "teal";
  if (hue < 300) return "blue";
  return "violet";
}

export function primitiveName(lab, taken) {
  const base = `--p-${familyOf(lab)}-${String(Math.round(lab.L)).padStart(2, "0")}`;
  if (!taken.has(base)) return base;
  for (const suffix of "bcdefghijklmnopqrstuvwxyz") if (!taken.has(base + suffix)) return base + suffix;
  throw new Error(`too many primitives near ${base}`);
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/unit/color-lib.test.mjs`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/color.mjs tests/unit/color-lib.test.mjs
git commit -m "Add color parsing and CIE Lab distance helpers for the token migration"
```

---

### Task 2: `tokens.css` with roles and scales, imported first everywhere

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/styles/fieldbook.css:25-83` (remove the `:root` block; keep `@font-face` rules and everything after the block)
- Modify: `src/layouts/Base.astro:2` (import `tokens.css` before `global.css`)
- Modify: `src/layouts/Econometrics.astro:2` (import `tokens.css` before `econometrics.css`)
- Modify: `src/pages/st-louis.astro:2` (import `tokens.css` before `st-louis.css`)
- Test: `tests/unit/tokens.test.mjs`

**Interfaces:**
- Produces: role names listed in the spec table plus `--ef-*` aliases; scale names `--font-display`, `--font-text`, `--font-data`, `--space-1` … `--space-8`, `--radius-control`, `--motion-fast|medium|slow`, `--ease-standard|enter`, `--layout-gutter|edge|grid-max|reading`. Consumed by Tasks 3 to 6.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/tokens.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
const block = (selector) => {
  const start = css.indexOf(selector); assert.ok(start >= 0, `${selector} block exists`);
  const open = css.indexOf("{", start); let depth = 0, i = open;
  for (; i < css.length; i += 1) { if (css[i] === "{") depth += 1; if (css[i] === "}") { depth -= 1; if (depth === 0) break; } }
  return css.slice(open + 1, i);
};
const declared = (body) => new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const ROLES = ["--surface", "--surface-raised", "--surface-sunken", "--ink", "--ink-muted", "--rule", "--rule-strong", "--accent", "--accent-ink", "--highlight", "--positive", "--caution", "--focus-ring"];
const SCALES = ["--font-display", "--font-text", "--font-data", "--space-1", "--space-8", "--radius-control", "--motion-fast", "--motion-medium", "--motion-slow", "--ease-standard", "--ease-enter", "--layout-gutter", "--layout-edge", "--layout-grid-max", "--layout-reading"];
const ALIASES = ["--ef-ink", "--ef-paper", "--ef-figure", "--ef-signal", "--ef-teal", "--ef-oxide", "--ef-space-1", "--ef-space-8", "--ef-motion-fast", "--ef-ease-enter", "--ef-gutter", "--ef-edge", "--ef-grid-max", "--ef-reading", "--ef-control-radius"];

test("every role, scale, and alias is declared on bare :root", () => {
  const root = declared(block("\n:root"));
  for (const name of [...ROLES, ...SCALES, ...ALIASES]) assert.ok(root.has(name), `${name} on :root`);
});

test("dark blocks redefine only roles that exist on :root, and both dark selectors are present", () => {
  const root = declared(block("\n:root"));
  for (const selector of [":root:not([data-theme=\"light\"])", ":root[data-theme=\"dark\"]"]) {
    const names = declared(block(selector));
    assert.ok(names.size > 0, `${selector} redefines something`);
    for (const name of names) assert.ok(root.has(name), `${selector} redefines unknown ${name}`);
    for (const name of names) assert.ok(!name.startsWith("--p-"), `${selector} must not redefine a primitive`);
  }
});

test("role values reference primitives or other roles, never literals", () => {
  const body = block("\n:root");
  for (const [, name, value] of body.matchAll(/(--(?!p-)[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (name.startsWith("--font") || name.startsWith("--space") || name.startsWith("--ef-space") || name.startsWith("--radius") || name.startsWith("--motion") || name.startsWith("--ease") || name.startsWith("--layout") || name.startsWith("--ef-motion") || name.startsWith("--ef-ease") || ["--ef-gutter", "--ef-edge", "--ef-grid-max", "--ef-reading", "--ef-control-radius"].includes(name)) continue;
    assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${name} must not hold a literal: ${value}`);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/unit/tokens.test.mjs`
Expected: FAIL, `tokens.css` does not exist.

- [ ] **Step 3: Write `tokens.css`**

The primitives section starts with only the six brand colors; Task 3 appends the rest.

```css
/* src/styles/tokens.css
   The one place the site's appearance is defined. Three tiers:
   1. Primitives  --p-*      raw colors. Only this file may declare them.
   2. Roles       --surface, --ink, --accent, ...   what components use.
   3. Scales      type, space, radius, motion, layout.
   Surfaces ([data-surface="..."]) override roles only. See DESIGN_SYSTEM.md. */

:root {
  /* 1. Primitives: brand */
  --p-ink: #11131D;
  --p-paper: #F1F3F2;
  --p-figure: #FFFFFF;
  --p-signal: #3156E8;
  --p-teal: #28706B;
  --p-oxide: #9E4D38;
  /* 1. Primitives: migrated (appended by scripts/migrate-colors.mjs) */
  /* @primitives */

  /* 2. Roles: light */
  --surface: var(--p-paper);
  --surface-raised: var(--p-figure);
  --surface-sunken: color-mix(in srgb, var(--p-paper) 92%, var(--p-ink));
  --ink: var(--p-ink);
  --ink-muted: color-mix(in srgb, var(--p-ink) 62%, var(--p-paper));
  --rule: color-mix(in srgb, var(--p-ink) 18%, var(--p-paper));
  --rule-strong: color-mix(in srgb, var(--p-ink) 38%, var(--p-paper));
  --accent: var(--p-signal);
  --accent-ink: var(--p-figure);
  --highlight: var(--p-signal);
  --positive: var(--p-teal);
  --caution: var(--p-oxide);
  --focus-ring: var(--p-signal);

  /* 2. Roles: deprecated aliases, kept one release. Do not add uses. */
  --ef-ink: var(--ink);
  --ef-paper: var(--surface);
  --ef-figure: var(--surface-raised);
  --ef-signal: var(--accent);
  --ef-teal: var(--positive);
  --ef-oxide: var(--caution);

  /* 3. Scales: type */
  --font-display: "Geist Variable", "Helvetica Neue", Arial, sans-serif;
  --font-text: "Newsreader Variable", Georgia, "Times New Roman", serif;
  --font-data: "Geist Mono Variable", "SFMono-Regular", Consolas, monospace;
  --font-serif: var(--font-text);
  --font-sans: var(--font-display);
  --font-mono: var(--font-data);
  --ih-display: var(--font-display);
  --ih-serif: var(--font-text);
  --ih-sans: var(--font-display);
  --ih-mono: var(--font-data);

  /* 3. Scales: space (4, 8, 12, 20, 32, 52, 84, 136 px) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1.25rem;
  --space-5: 2rem;
  --space-6: 3.25rem;
  --space-7: 5.25rem;
  --space-8: 8.5rem;
  --ef-space-1: var(--space-1);
  --ef-space-2: var(--space-2);
  --ef-space-3: var(--space-3);
  --ef-space-4: var(--space-4);
  --ef-space-5: var(--space-5);
  --ef-space-6: var(--space-6);
  --ef-space-7: var(--space-7);
  --ef-space-8: var(--space-8);

  /* 3. Scales: radius, motion, layout */
  --radius-control: 6px;
  --ef-control-radius: var(--radius-control);
  --motion-fast: 140ms;
  --motion-medium: 240ms;
  --motion-slow: 420ms;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ef-motion-fast: var(--motion-fast);
  --ef-motion-medium: var(--motion-medium);
  --ef-motion-slow: var(--motion-slow);
  --ef-ease-standard: var(--ease-standard);
  --ef-ease-enter: var(--ease-enter);
  --layout-gutter: clamp(1rem, 2vw, 1.5rem);
  --layout-edge: clamp(1.25rem, 4vw, 4rem);
  --layout-grid-max: 90rem;
  --layout-reading: 68ch;
  --ef-gutter: var(--layout-gutter);
  --ef-edge: var(--layout-edge);
  --ef-grid-max: var(--layout-grid-max);
  --ef-reading: var(--layout-reading);

  /* Legacy names still read by global.css and instrument.css; they resolve to roles. */
  --paper: var(--surface);
  --white: var(--surface-raised);
  --copper: var(--accent);
  --copper-dark: color-mix(in srgb, var(--accent) 78%, var(--ink));
  --muted: var(--ink-muted);
  --rule-dark: var(--rule-strong);
  --success: var(--positive);
  --content-max: var(--layout-reading);
  --wide-max: var(--layout-grid-max);
  --radius-sm: var(--radius-control);
}

/* Dark theme is not yet designed for the hub: keep light, but reserve the blocks
   so a future palette lands here and nowhere else. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --focus-ring: var(--p-signal);
  }
}
:root[data-theme="dark"] {
  --focus-ring: var(--p-signal);
}

/* Surfaces override roles only. */
[data-surface="course"] {
  /* filled in Task 5 from econometrics.css */
}
```

Then edit `fieldbook.css`: delete lines 25 through 83 (the `:root { … }` block) so only the `@font-face` rules and the rules from `html {` onward remain. Add the import lines: in `Base.astro` insert `import "../styles/tokens.css";` above `import "../styles/global.css";`; in `Econometrics.astro` insert `import '../styles/tokens.css';` above the `econometrics.css` import; in `st-louis.astro` insert `import '../styles/tokens.css';` above `st-louis.css`.

- [ ] **Step 4: Run the test and a build**

Run: `node --test tests/unit/tokens.test.mjs && npm run -s build:fast | tail -2 && npm run -s check:styles | tail -1`
Expected: 3 passing; build completes; style check passes (the values are unchanged, only their home moved).

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/fieldbook.css src/layouts/Base.astro src/layouts/Econometrics.astro src/pages/st-louis.astro tests/unit/tokens.test.mjs
git commit -m "Introduce tokens.css with roles, scales, and deprecated aliases"
```

---

### Task 3: Migration script, run once, report committed

**Files:**
- Create: `scripts/migrate-colors.mjs`
- Create (generated): `docs/superpowers/reports/2026-09-17-color-migration.md`
- Modify (generated): `src/styles/tokens.css` (primitives appended at `/* @primitives */`), every `.css` under `src/styles`, every `<style>` block in `.astro` under `src/components`, `src/pages`, `src/layouts`.
- Test: `tests/unit/migrate-colors.test.mjs` (tests the pure `rewriteCss` function on strings, not the file system)

**Interfaces:**
- Consumes: `scripts/lib/color.mjs` from Task 1.
- Produces: `rewriteCss(css, registry) -> { css, replacements[] }` exported for tests; `registry` is `{ primitives: Map<name,{hex,lab}>, lookup(color) -> name }`. The report format below is consumed by nothing but a human.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/migrate-colors.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRegistry, rewriteCss } from "../../scripts/migrate-colors.mjs";

test("brand literals become roles, other literals become primitives, alpha becomes color-mix", () => {
  const registry = createRegistry();
  const input = `a { color: #11131D; background: #f3cc78; border-color: rgba(16, 42, 67, 0.05); outline: 1px solid var(--ef-ink, #11131D); }`;
  const { css, replacements } = rewriteCss(input, registry);
  assert.equal(css, `a { color: var(--ink); background: var(--p-gold-84); border-color: color-mix(in srgb, var(--p-blue-16) 5%, transparent); outline: 1px solid var(--ef-ink); }`);
  assert.equal(replacements.length, 4);
  assert.deepEqual(replacements.map((r) => r.kind), ["role", "primitive", "alpha", "fallback"]);
});

test("near-duplicates share one primitive and exact duplicates never create a second", () => {
  const registry = createRegistry();
  rewriteCss(`a{color:#8f8a83} b{color:#8f8b84} c{color:#8F8A83}`, registry);
  assert.equal([...registry.primitives.keys()].filter((k) => k.startsWith("--p-neutral")).length, 1);
});

test("literals inside url(), data URIs, and comments are left alone", () => {
  const registry = createRegistry();
  const input = `a { background: url("data:image/svg+xml,%3Csvg fill='%23ff0000'%3E"); /* #123456 */ }`;
  const { css, replacements } = rewriteCss(input, registry);
  assert.equal(css, input);
  assert.equal(replacements.length, 0);
});

test("named colors white and black are rewritten, transparent and currentColor are not", () => {
  const registry = createRegistry();
  const { css } = rewriteCss(`a{color:white;background:transparent;border-color:currentColor;outline-color:black}`, registry);
  assert.equal(css, `a{color:var(--surface-raised);background:transparent;border-color:currentColor;outline-color:var(--p-neutral-00)}`);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/unit/migrate-colors.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the script**

```js
// scripts/migrate-colors.mjs
// One-shot migration of raw color literals to tokens. Safe to re-run: it only
// rewrites literals, never var() references. Usage: node scripts/migrate-colors.mjs [--dry]
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseColor, toLab, deltaE, hexOf, primitiveName } from "./lib/color.mjs";

const BRAND = [
  ["#11131d", "--ink", "--p-ink"], ["#f1f3f2", "--surface", "--p-paper"], ["#ffffff", "--surface-raised", "--p-figure"],
  ["#3156e8", "--accent", "--p-signal"], ["#28706b", "--positive", "--p-teal"], ["#9e4d38", "--caution", "--p-oxide"],
];
const TOLERANCE = 2;

export function createRegistry() {
  const primitives = new Map();
  for (const [hex, , p] of BRAND) primitives.set(p, { hex, lab: toLab(parseColor(hex)) });
  return {
    primitives,
    lookup(color) {
      const lab = toLab(color);
      let best = null, bestD = Infinity;
      for (const [name, p] of primitives) { const d = deltaE(lab, p.lab); if (d < bestD) { bestD = d; best = name; } }
      if (bestD <= TOLERANCE) return best;
      const name = primitiveName(lab, new Set(primitives.keys()));
      primitives.set(name, { hex: hexOf(color), lab });
      return name;
    },
  };
}

const roleForPrimitive = (p) => BRAND.find(([, , name]) => name === p)?.[1] ?? null;
const pct = (a) => `${Math.round(a * 1000) / 10}%`;

// Matches a literal color that is a CSS value token: not inside url(...), not in a comment.
const LITERAL = /(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\bwhite\b|\bblack\b)/gi;
const NAMED = { white: "#ffffff", black: "#000000" };

export function rewriteCss(css, registry) {
  const replacements = [];
  // Mask comments and url() bodies so the literal regex never sees them.
  const masks = [];
  const masked = css.replace(/\/\*[\s\S]*?\*\/|url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, (m) => { masks.push(m); return ` ${masks.length - 1} `; });
  // 1. var(--x, <literal>) -> var(--x)
  let out = masked.replace(/var\((--[a-z0-9-]+)\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|white|black)\s*\)/gi, (m, name, lit) => {
    replacements.push({ kind: "fallback", from: m, to: `var(${name})` }); return `var(${name})`;
  });
  // 2. remaining literals
  out = out.replace(LITERAL, (lit) => {
    const source = NAMED[lit.toLowerCase()] ?? lit;
    const color = parseColor(source);
    if (!color) return lit;
    const primitive = registry.lookup(color);
    let to;
    if (color.a < 1) { to = `color-mix(in srgb, var(${primitive}) ${pct(color.a)}, transparent)`; replacements.push({ kind: "alpha", from: lit, to }); }
    else if (roleForPrimitive(primitive)) { to = `var(${roleForPrimitive(primitive)})`; replacements.push({ kind: "role", from: lit, to }); }
    else { to = `var(${primitive})`; replacements.push({ kind: "primitive", from: lit, to }); }
    return to;
  });
  out = out.replace(/ (\d+) /g, (m, i) => masks[Number(i)]);
  return { css: out, replacements };
}

const walk = async (dir, ext) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async (e) => {
  const p = path.join(dir, e.name); return e.isDirectory() ? walk(p, ext) : ext.some((x) => p.endsWith(x)) ? [p] : [];
}))).flat();

async function main() {
  const dry = process.argv.includes("--dry");
  const registry = createRegistry();
  const report = [];
  const files = [...await walk("src/styles", [".css"]), ...await walk("src/components", [".astro"]), ...await walk("src/pages", [".astro"]), ...await walk("src/layouts", [".astro"])];
  for (const file of files.sort()) {
    if (file.endsWith("tokens.css")) continue;
    const text = await readFile(file, "utf8");
    let next, count = 0;
    if (file.endsWith(".css")) { const r = rewriteCss(text, registry); next = r.css; count = r.replacements.length; report.push(...r.replacements.map((x) => ({ file, ...x }))); }
    else {
      next = text.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, body, close) => { const r = rewriteCss(body, registry); count += r.replacements.length; report.push(...r.replacements.map((x) => ({ file, ...x }))); return open + r.css + close; });
      // Report, do not rewrite, literals outside <style> (scripts, SVG attributes, inline style attributes).
      const outside = text.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
      for (const m of outside.matchAll(/#[0-9a-f]{6}\b/gi)) report.push({ file, kind: "skipped", from: m[0], to: "(outside <style>: script, SVG, or inline attribute)" });
    }
    if (count && !dry) await writeFile(file, next);
  }
  // Append primitives to tokens.css
  const tokensPath = "src/styles/tokens.css";
  const tokens = await readFile(tokensPath, "utf8");
  const brand = new Set(BRAND.map(([, , p]) => p));
  const lines = [...registry.primitives].filter(([n]) => !brand.has(n)).sort((a, b) => a[1].lab.L - b[1].lab.L || a[0].localeCompare(b[0])).map(([n, p]) => `  ${n}: ${p.hex};`).join("\n");
  if (!dry) await writeFile(tokensPath, tokens.replace("  /* @primitives */", `  /* @primitives */\n${lines}`));
  // Report
  const byKind = report.reduce((acc, r) => ((acc[r.kind] = (acc[r.kind] ?? 0) + 1), acc), {});
  const consolidation = [];
  const prims = [...registry.primitives].filter(([n]) => !brand.has(n));
  for (let i = 0; i < prims.length; i += 1) for (let j = i + 1; j < prims.length; j += 1) {
    const d = deltaE(prims[i][1].lab, prims[j][1].lab);
    if (d <= 6 && prims[i][0].split("-")[2] === prims[j][0].split("-")[2]) consolidation.push(`| ${prims[i][0]} \`${prims[i][1].hex}\` | ${prims[j][0]} \`${prims[j][1].hex}\` | ${d.toFixed(1)} |`);
  }
  const md = [`# Color migration report (${new Date().toISOString().slice(0, 10)})`, "",
    `Files scanned: ${files.length}. Replacements: ${JSON.stringify(byKind)}. Primitives after migration: ${registry.primitives.size} (${prims.length} migrated + 6 brand).`, "",
    "## Proposed consolidations (ΔE ≤ 6, same family) — needs Dr. Helfrich's approval, not applied", "", "| Keep | Merge into it | ΔE |", "| --- | --- | --- |", ...consolidation, "",
    "## Every replacement", "", "| File | Kind | From | To |", "| --- | --- | --- | --- |",
    ...report.map((r) => `| ${r.file} | ${r.kind} | \`${r.from}\` | \`${r.to}\` |`)].join("\n");
  await mkdir("docs/superpowers/reports", { recursive: true });
  if (!dry) await writeFile("docs/superpowers/reports/2026-09-17-color-migration.md", md);
  console.log(`[migrate-colors] ${files.length} files, ${report.length} entries, ${registry.primitives.size} primitives${dry ? " (dry run)" : ""}`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) await main();
```

- [ ] **Step 4: Run the unit tests, then a dry run, then the real run**

Run: `node --test tests/unit/migrate-colors.test.mjs && node scripts/migrate-colors.mjs --dry && node scripts/migrate-colors.mjs && git diff --stat | tail -3`
Expected: 4 passing; the summary line prints; the diff touches the stylesheets and component styles, and `tokens.css` gains the primitives block. Read the report's consolidation table; do not apply it.

- [ ] **Step 5: Build and run the style gate**

Run: `npm run -s build:fast | tail -1 && npm run -s check:styles | tail -1 && node --test tests/unit/tokens.test.mjs`
Expected: build completes, style gate passes, tokens tests pass. If `check:styles` fails on a palette assertion, the migration replaced a brand literal it checks for; inspect the failure and, if the checker greps for a literal hex, update the checker to resolve the token instead (Task 4 covers the permanent rule).

- [ ] **Step 6: Commit**

```bash
git add -A src/styles src/components src/pages src/layouts scripts/migrate-colors.mjs tests/unit/migrate-colors.test.mjs docs/superpowers/reports
git commit -m "Migrate raw colors to tokens.css primitives and roles (no visual change intended)"
```

---

### Task 4: Token lint wired into the gate chain

**Files:**
- Create: `scripts/check-tokens.mjs`
- Modify: `package.json` scripts (`check:tokens`, and add it to `check` after `check:navigation`)
- Modify: `.github/workflows/deploy.yml:42-47` (add `npm run check:tokens` to the fieldbook step)
- Test: `tests/unit/check-tokens.test.mjs` (tests the exported `findViolations(text, file)` on strings)

**Interfaces:**
- Produces: `findViolations(text, file) -> [{file,line,literal,reason}]`; process exits 1 when any violation exists.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/check-tokens.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { findViolations } from "../../scripts/check-tokens.mjs";

test("raw colors outside tokens.css are violations; tokens.css, url(), comments, and script blocks are not", () => {
  assert.equal(findViolations(`a{color:#123456}`, "src/styles/x.css").length, 1);
  assert.equal(findViolations(`a{color:rgba(1,2,3,.5)}`, "src/styles/x.css").length, 1);
  assert.equal(findViolations(`a{color:white}`, "src/styles/x.css").length, 1);
  assert.equal(findViolations(`a{color:#123456}`, "src/styles/tokens.css").length, 0);
  assert.equal(findViolations(`a{background:url("data:image/svg+xml,%23fff")} /* #fff */`, "src/styles/x.css").length, 0);
  assert.equal(findViolations(`<script>const c = "#ff0000";</script><style>a{color:var(--ink)}</style>`, "src/components/X.astro").length, 0);
  assert.equal(findViolations(`<style>a{color:#ff0000}</style>`, "src/components/X.astro").length, 1);
  assert.equal(findViolations(`a{color:transparent;border-color:currentColor}`, "src/styles/x.css").length, 0);
});

test("new --ef- declarations outside tokens.css are violations", () => {
  assert.equal(findViolations(`:root{--ef-new:red}`, "src/styles/x.css").length, 2);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/unit/check-tokens.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
// scripts/check-tokens.mjs
// Release gate: raw colors live only in src/styles/tokens.css.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black|red|blue|green|gray|grey|gold|silver|orange|purple|yellow|navy|teal)\b/gi;

export function findViolations(text, file) {
  if (file.endsWith("tokens.css")) return [];
  const violations = [];
  const styleOnly = file.endsWith(".astro")
    ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
    : text;
  const cleaned = styleOnly.replace(/\/\*[\s\S]*?\*\/|url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, (m) => " ".repeat(m.length));
  cleaned.split("\n").forEach((lineText, index) => {
    for (const m of lineText.matchAll(LITERAL)) {
      // Named colors are only violations when used as a value (after ":" or a space in a value), not in selectors or property names.
      if (/^[a-z]+$/i.test(m[0]) && !/[:,\s(]\s*$/.test(lineText.slice(0, m.index))) continue;
      violations.push({ file, line: index + 1, literal: m[0], reason: "raw color outside tokens.css" });
    }
    for (const m of lineText.matchAll(/--ef-[a-z0-9-]+\s*:/g)) violations.push({ file, line: index + 1, literal: m[0], reason: "new --ef- declaration; declare roles in tokens.css" });
  });
  return violations;
}

const walk = async (dir, ext) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async (e) => {
  const p = path.join(dir, e.name); return e.isDirectory() ? walk(p, ext) : ext.some((x) => p.endsWith(x)) ? [p] : [];
}))).flat();

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const files = [...await walk("src/styles", [".css"]), ...await walk("src/components", [".astro"]), ...await walk("src/pages", [".astro"]), ...await walk("src/layouts", [".astro"])];
  const all = [];
  for (const file of files) all.push(...findViolations(await readFile(file, "utf8"), file));
  if (all.length) {
    console.error(`[check-tokens] ${all.length} raw color(s) outside tokens.css:\n` + all.map((v) => `  ${v.file}:${v.line}  ${v.literal}  (${v.reason})`).join("\n"));
    process.exit(1);
  }
  console.log(`[check-tokens] ${files.length} files clean; every color resolves through src/styles/tokens.css`);
}
```

Add to `package.json` scripts: `"check:tokens": "node --test tests/unit/tokens.test.mjs tests/unit/color-lib.test.mjs tests/unit/migrate-colors.test.mjs tests/unit/check-tokens.test.mjs && node scripts/check-tokens.mjs"`, and insert `npm run check:tokens && ` after `npm run check:navigation && ` in `check`. In `deploy.yml` add `npm run check:tokens` after `npm run check:navigation`.

- [ ] **Step 4: Run the lint against the migrated tree**

Run: `npm run -s check:tokens`
Expected: PASS. If it reports leftovers (a named color the migration did not cover, a literal in a selector-like position), fix each by hand: replace with the correct role or primitive, or extend the migration's `NAMED` map and re-run it.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-tokens.mjs tests/unit/check-tokens.test.mjs package.json .github/workflows/deploy.yml src
git commit -m "Gate the build on raw colors living only in tokens.css"
```

---

### Task 5: Course surface and Base theme-color from tokens

**Files:**
- Modify: `src/styles/tokens.css` (fill `[data-surface="course"]`)
- Modify: `src/styles/econometrics.css:1` (remove its `:root{--font-*}` line; fonts now come from `tokens.css`)
- Modify: `src/layouts/Econometrics.astro:25` (`<body class="ea" data-surface="course">`)
- Modify: `src/layouts/Base.astro:73` and `src/layouts/Econometrics.astro:14` (theme-color meta reads a constant exported from a new `src/data/theme.mjs` so the literal has one home outside CSS)
- Create: `src/data/theme.mjs`

**Interfaces:**
- Produces: `export const THEME_COLOR = { hub: "#F1F3F2", course: "#142b49", lab: "#181e20" }` used by the three layouts/pages' `<meta name="theme-color">`.

- [ ] **Step 1: Identify the course palette**

Run: `grep -o -E "var\(--p-[a-z]+-[0-9a-z]+\)" src/styles/econometrics.css | sort | uniq -c | sort -rn | head -12`
Expected: the migrated primitives the course uses most (its navy `#142b49`, `#0c2235`, blue `#2459d3`, gold `#f3cc78` families). Note their names.

- [ ] **Step 2: Define the surface**

In `tokens.css`, replace the empty course block with role overrides that point at those primitives, for example (names from Step 1):

```css
[data-surface="course"] {
  --surface: var(--p-blue-17);          /* #142b49 */
  --surface-raised: var(--p-blue-13);   /* #0c2235 */
  --ink: var(--p-neutral-98);           /* #fafafa */
  --ink-muted: color-mix(in srgb, var(--ink) 70%, var(--surface));
  --rule: color-mix(in srgb, var(--ink) 18%, var(--surface));
  --accent: var(--p-blue-42);           /* #2459d3 */
  --accent-ink: var(--p-neutral-98);
  --highlight: var(--p-gold-84);        /* #f3cc78 */
  --focus-ring: var(--highlight);
}
```

This pass does not re-point `econometrics.css` rules from primitives to these roles (that is a design change for a later brief); the surface exists so the roles are correct inside the course for any shared component rendered there.

- [ ] **Step 3: Theme colors**

```js
// src/data/theme.mjs
// Browser chrome colors for <meta name="theme-color">. The only color literals allowed outside tokens.css;
// they must match --surface for each surface in src/styles/tokens.css.
export const THEME_COLOR = Object.freeze({ hub: "#F1F3F2", course: "#142b49", lab: "#181e20" });
```

In `Base.astro` import `{ THEME_COLOR }` and render `<meta name="theme-color" content={THEME_COLOR.hub} />`; same for `Econometrics.astro` with `course` and `st-louis.astro` with `lab`. Add `tests/unit/tokens.test.mjs` assertion: each `THEME_COLOR` value equals the hex of the primitive that the corresponding `--surface` resolves to (read `tokens.css`, follow one level of `var()`).

- [ ] **Step 4: Verify**

Run: `npm run -s check:tokens && npm run -s build:fast | tail -1 && npm run -s check:econometrics | grep -E "^ℹ (pass|fail)" && npm run -s check:styles | tail -1`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/econometrics.css src/layouts src/pages/st-louis.astro src/data/theme.mjs tests/unit/tokens.test.mjs
git commit -m "Add the course surface and source theme-color metas from one module"
```

---

### Task 6: Before/after visual verification

**Files:**
- Create: `scripts/visual-diff.mjs` (one-off; kept for reuse)
- Uses: a build of `origin/main` served on port 4332 and the branch build on 4331.

**Interfaces:**
- Consumes: two directories of PNG screenshots with identical filenames.
- Produces: a table of per-page pixel difference ratios; threshold 0.5% of pixels differing by more than 8/255 in any channel.

- [ ] **Step 1: Capture "before"**

From a clean checkout of `origin/main` (use `git worktree add /tmp/hub-before origin/main`, `npm ci`, `npm run build:fast`), serve `dist` with `python3 -m http.server 4332 --directory /tmp/hub-before/dist`. In the browser pane, at 1440 px and 375 px, screenshot these pages and save through the pane's screenshot tool into `/tmp/visual/before/`: `/`, `/work/`, `/research/`, `/research/helfrich-2026-nmtc-rural-gap/`, `/teaching/`, `/projects/`, `/library/`, `/contact/`, `/econometrics/`, `/econometrics/03-projection/`, `/st-louis/`, `/404`.

- [ ] **Step 2: Capture "after"**

Same pages from the branch build via `astro preview` on 4331 into `/tmp/visual/after/`.

- [ ] **Step 3: Compare**

```js
// scripts/visual-diff.mjs  usage: node scripts/visual-diff.mjs before/ after/
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
// Minimal PNG decoder for 8-bit RGBA/RGB non-interlaced images (what the pane produces).
function decodePng(buf) {
  let pos = 8; const chunks = []; let width, height, colorType, data = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8); const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); colorType = body[9]; }
    if (type === "IDAT") data.push(body); pos += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(data)); const bpp = colorType === 6 ? 4 : 3; const stride = width * bpp; const out = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) { const filter = raw[y * (stride + 1)]; const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) { const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1; else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255; }
    line.copy(out, y * stride); prev = line; }
  return { width, height, bpp, data: out };
}
const [beforeDir, afterDir] = process.argv.slice(2);
for (const name of (await readdir(beforeDir)).filter((n) => n.endsWith(".png")).sort()) {
  const a = decodePng(await readFile(path.join(beforeDir, name))), b = decodePng(await readFile(path.join(afterDir, name)));
  if (a.width !== b.width || a.height !== b.height) { console.log(`${name}: size differs ${a.width}x${a.height} vs ${b.width}x${b.height}`); continue; }
  let diff = 0; const n = a.width * a.height;
  for (let i = 0; i < n; i += 1) { for (let c = 0; c < 3; c += 1) if (Math.abs(a.data[i * a.bpp + c] - b.data[i * b.bpp + c]) > 8) { diff += 1; break; } }
  const ratio = diff / n; console.log(`${name}: ${(ratio * 100).toFixed(2)}% pixels changed ${ratio > 0.005 ? "  <-- REVIEW" : ""}`);
}
```

Run: `node scripts/visual-diff.mjs /tmp/visual/before /tmp/visual/after`
Expected: every page under 0.5%. Pages flagged REVIEW get a side-by-side look; a legitimate difference (a live feed or timestamp) is noted in the PR, an unintended one is fixed by correcting the primitive mapping in `tokens.css`.

- [ ] **Step 4: Commit the script**

```bash
git add scripts/visual-diff.mjs
git commit -m "Add a pixel-diff helper for before/after style verification"
```

---

### Task 7: Documentation

**Files:**
- Modify: `DESIGN_SYSTEM.md` (replace the "Palette" section with "Tokens"; mark `--ef-*` deprecated; document surfaces and the lint)
- Modify: `README.md` structure list (add `src/styles/tokens.css`)
- Modify: `PUBLISHING.md` if it mentions palette values (grep first)

- [ ] **Step 1: Write the Tokens section**

Replace the "## Palette" section body with:

```markdown
## Tokens

`src/styles/tokens.css` is the one place the site's appearance is defined. It is imported first by every layout.

1. **Primitives** (`--p-*`) are raw colors. Only `tokens.css` declares them. Names describe hue family and CIE lightness (`--p-blue-47`), never use. The six brand colors keep readable aliases: `--p-ink`, `--p-paper`, `--p-figure`, `--p-signal`, `--p-teal`, `--p-oxide`.
2. **Roles** are what components use: `--surface`, `--surface-raised`, `--surface-sunken`, `--ink`, `--ink-muted`, `--rule`, `--rule-strong`, `--accent`, `--accent-ink`, `--highlight`, `--positive`, `--caution`, `--focus-ring`. A role points at a primitive or a `color-mix()` of primitives.
3. **Scales** carry type roles, spacing (`--space-1` … `--space-8`), `--radius-control`, motion durations and easings, and layout constants.

A **surface** is a region with its own role palette, declared with `data-surface="name"` on its root and defined in `tokens.css` as role overrides only. Surfaces: `course` (the econometrics layout) and, after the Property Lab recomposition, `lab`.

Rules enforced by `npm run check:tokens`: no hex, `rgb()`, `hsl()`, or named color outside `tokens.css`; no new `--ef-*` declarations. The `--ef-*` names are deprecated aliases kept for one release. To add a color: add a primitive in `tokens.css`, expose it through a role or a surface, then use the role.

The vocabulary mirrors `~/Developer/templates/typst/tokens.typ` (ink, muted, hairline → `--rule`, accent, highlight, wash → `--surface`) so print and web share one model.

Migration record: `docs/superpowers/reports/2026-09-17-color-migration.md`.
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN_SYSTEM.md README.md PUBLISHING.md
git commit -m "Document the token tiers, surfaces, and the color lint"
```

---

### Task 8: Full gate run, rebase, PR, merge, deploy, live check

- [ ] **Step 1: Rebase and run everything**

Run: `git fetch origin && git rebase origin/main && npm run -s check && npm run -s check:econometrics | tail -1 && node --test tests/unit/homepage-data.test.mjs tests/unit/homepage-ui.test.mjs tests/unit/homepage-continuum.test.mjs | grep -E "^ℹ (pass|fail)" && npx pagefind --site dist --output-path dist/pagefind | grep Indexed && npm run -s check:discovery | tail -1`
Expected: all pass. If the rebase brought new stylesheets from other agents, `check:tokens` will list their raw colors; run `node scripts/migrate-colors.mjs` again, review the diff, and amend the migration commit message in the PR description.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin design-tokens
gh pr create --base main --head design-tokens --title "Design token layer: one file for color, type, space, and motion" --body-file - <<'PR'
## Summary
(one paragraph from the spec's Problem and Goals; list the counts from the migration report; link the report; note "no visible change intended" and the visual-diff results; note the consolidation table awaits approval)
🤖 Generated with [Claude Code](https://claude.com/claude-code)
PR
```

- [ ] **Step 3: Merge, watch the deploy, verify live**

Run: `gh pr merge <n> --merge && gh run watch <id> --exit-status`, then re-run `scripts/visual-diff.mjs` against screenshots of the live site for the same page list, and spot-check `view-source` of `/` for `tokens.css` loading first.

- [ ] **Step 4: Update the spec status line and memory**

Set the spec's Status to "Part 1 deployed <date>; Part 2 pending" and commit on main via a tiny PR or as part of the Part 2 branch.
