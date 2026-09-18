import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

const block = (selector) => {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `${selector} block exists`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let i = open;
  for (; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") { depth -= 1; if (depth === 0) break; }
  }
  return css.slice(open + 1, i);
};
const declared = (body) => new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const ROLES = ["--surface", "--surface-raised", "--surface-sunken", "--ink", "--ink-muted", "--rule", "--rule-strong", "--accent", "--accent-ink", "--highlight", "--positive", "--caution", "--focus-ring"];
const SCALES = ["--font-display", "--font-text", "--font-data", "--space-1", "--space-8", "--radius-control", "--motion-fast", "--motion-medium", "--motion-slow", "--ease-standard", "--ease-enter", "--layout-gutter", "--layout-edge", "--layout-grid-max", "--layout-reading"];
const ALIASES = ["--ef-ink", "--ef-paper", "--ef-figure", "--ef-signal", "--ef-teal", "--ef-oxide", "--ef-space-1", "--ef-space-8", "--ef-motion-fast", "--ef-ease-enter", "--ef-gutter", "--ef-edge", "--ef-grid-max", "--ef-reading", "--ef-control-radius"];
const NON_COLOR = /^--(font|space|ef-space|radius|motion|ease|layout|ef-motion|ef-ease|ih-|ef-gutter|ef-edge|ef-grid-max|ef-reading|ef-control-radius|content-max|wide-max|radius-sm)/;

test("every role, scale, and alias is declared on bare :root", () => {
  const root = declared(block("\n:root"));
  for (const name of [...ROLES, ...SCALES, ...ALIASES]) assert.ok(root.has(name), `${name} on :root`);
});

test("dark blocks and surfaces redefine only roles that exist on :root, never primitives", () => {
  const root = declared(block("\n:root"));
  for (const selector of [':root:not([data-theme="light"])', ':root[data-theme="dark"]', '[data-surface="course"]']) {
    const names = declared(block(selector));
    assert.ok(names.size > 0, `${selector} redefines something`);
    for (const name of names) {
      assert.ok(root.has(name), `${selector} redefines unknown ${name}`);
      assert.ok(!name.startsWith("--p-"), `${selector} must not redefine a primitive`);
    }
  }
});

test("role values reference primitives or other roles, never literals", () => {
  const body = block("\n:root");
  for (const [, name, value] of body.matchAll(/(--(?!p-)[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (NON_COLOR.test(name)) continue;
    assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${name} must not hold a literal: ${value}`);
  }
});

test("theme-color metas match the surface each layout paints", async () => {
  const { THEME_COLOR } = await import("../../src/data/theme.mjs");
  const root = block("\n:root");
  const value = (name, scope = root) => scope.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim();
  const resolve = (expr, scope) => {
    const ref = expr?.match(/^var\((--[a-z0-9-]+)\)$/)?.[1];
    if (!ref) return expr;
    return resolve(value(ref, scope) ?? value(ref), scope);
  };
  assert.equal(resolve(value("--surface")).toLowerCase(), THEME_COLOR.hub.toLowerCase());
  const course = block('[data-surface="course"]');
  assert.equal(resolve(value("--surface", course), course).toLowerCase(), THEME_COLOR.course.toLowerCase());
});
