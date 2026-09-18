// Browser-chrome colors for <meta name="theme-color">. These are the only color literals
// permitted outside src/styles/tokens.css; tests/unit/tokens.test.mjs asserts each equals the
// primitive that the matching surface's --surface role resolves to.
export const THEME_COLOR = Object.freeze({
  hub: "#F1F3F2",
  course: "#142b49",
  lab: "#181e20",
});
