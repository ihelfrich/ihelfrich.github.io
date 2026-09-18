import test from "node:test";
import assert from "node:assert/strict";
import { findViolations } from "../../scripts/check-tokens.mjs";

test("raw colors outside tokens.css are violations; tokens.css, url(), comments, and script blocks are not", () => {
  assert.equal(findViolations("a{color:#123456}", "src/styles/x.css").length, 1);
  assert.equal(findViolations("a{color:rgba(1,2,3,.5)}", "src/styles/x.css").length, 1);
  assert.equal(findViolations("a{color:white}", "src/styles/x.css").length, 1);
  assert.equal(findViolations("a{color:#123456}", "src/styles/tokens.css").length, 0);
  assert.equal(findViolations('a{background:url("data:image/svg+xml,%23fff")} /* #fff */', "src/styles/x.css").length, 0);
  assert.equal(findViolations('<script>const c = "#ff0000";</script><style>a{color:var(--ink)}</style>', "src/components/X.astro").length, 0);
  assert.equal(findViolations("<style>a{color:#ff0000}</style>", "src/components/X.astro").length, 1);
  assert.equal(findViolations("a{color:transparent;border-color:currentColor}", "src/styles/x.css").length, 0);
  assert.equal(findViolations(".white-label{margin:0} .black{padding:0}", "src/styles/x.css").length, 0);
  assert.equal(findViolations("a{fill:hsl(calc(218 + var(--z) * 18) 88% 50%)}", "src/styles/x.css").length, 0);
});

test("new --ef- declarations outside tokens.css are violations", () => {
  const found = findViolations(":root{--ef-new:var(--ink)}", "src/styles/x.css");
  assert.equal(found.length, 1);
  assert.match(found[0].reason, /--ef-/);
  assert.equal(findViolations("body.studio{--ef-ink:var(--ink)}", "src/styles/homepage-studio.css").length, 0);
});
