import test from "node:test";
import assert from "node:assert/strict";
import { createRegistry, rewriteCss } from "../../scripts/migrate-colors.mjs";

test("brand literals become roles, other literals become primitives, alpha becomes color-mix, fallbacks drop", () => {
  const registry = createRegistry();
  const input = "a { color: #11131D; background: #f3cc78; border-color: rgba(16, 42, 67, 0.05); outline: 1px solid var(--ef-ink, #11131D); }";
  const { css, replacements } = rewriteCss(input, registry);
  assert.match(css, /color: var\(--ink\);/);
  assert.match(css, /background: var\(--p-gold-\d\d\);/);
  assert.match(css, /border-color: color-mix\(in srgb, var\(--p-blue-\d\d\) 5%, transparent\);/);
  assert.match(css, /outline: 1px solid var\(--ef-ink\);/);
  assert.deepEqual(replacements.map((r) => r.kind), ["fallback", "role", "primitive", "alpha"]);
});

test("near-duplicates share one primitive and exact duplicates never create a second", () => {
  const registry = createRegistry();
  rewriteCss("a{color:#8f8a83} b{color:#8f8b84} c{color:#8F8A83}", registry);
  assert.equal([...registry.primitives.keys()].filter((k) => k.startsWith("--p-neutral")).length, 1);
});

test("literals inside url(), data URIs, and comments are left alone", () => {
  const registry = createRegistry();
  const input = "a { background: url(\"data:image/svg+xml,%3Csvg fill='%23ff0000'%3E\"); /* #123456 */ }";
  const { css, replacements } = rewriteCss(input, registry);
  assert.equal(css, input);
  assert.equal(replacements.length, 0);
});

test("named colors white and black are rewritten, transparent and currentColor are not", () => {
  const registry = createRegistry();
  const { css } = rewriteCss("a{color:white;background:transparent;border-color:currentColor;outline-color:black}", registry);
  assert.equal(css, "a{color:var(--surface-raised);background:transparent;border-color:currentColor;outline-color:var(--p-neutral-00)}");
});

test("a literal that is part of a selector or a property name is untouched", () => {
  const registry = createRegistry();
  const { css } = rewriteCss(".white-label{color:var(--ink)} .black{margin:0}", registry);
  assert.equal(css, ".white-label{color:var(--ink)} .black{margin:0}");
  assert.equal(rewriteCss("a{color:var(--white);background:var(--paper-2, white)}", registry).css, "a{color:var(--white);background:var(--paper-2)}");
});
