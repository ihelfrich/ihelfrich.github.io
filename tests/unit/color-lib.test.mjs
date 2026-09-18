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
  assert.equal(parseColor("hsl(calc(218 + var(--z) * 18) 88% 50%)"), null);
  assert.equal(parseColor("rgb(var(--x) / 0.5)"), null);
});

test("lab distance separates brand colors and joins near-duplicates", () => {
  const ink = toLab(parseColor("#11131D"));
  const paper = toLab(parseColor("#F1F3F2"));
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
  const first = primitiveName(toLab(parseColor("#3156E8")), taken);
  taken.add(first);
  const second = primitiveName(toLab(parseColor("#3156E8")), taken);
  assert.match(first, /^--p-blue-\d\d$/);
  assert.equal(second, `${first}b`);
  assert.equal(hexOf(parseColor("#3156E8")), "#3156e8");
});
