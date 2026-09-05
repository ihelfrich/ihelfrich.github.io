# Policy Statistics Lab

Standalone browser activities at `/learn/policy-statistics/`. No third-party runtime dependencies, data requests, accounts, or persistence. Serve the repository’s public folder over HTTP; `index.html` imports `lab.mjs` and `stats.mjs` using relative URLs. The stylesheet and local fonts use site-root URLs.

Each activity has a prediction question with immediate feedback. Focus mode hides the teaching sidebar and enlarges the experiment; Escape exits it. Median observations are drawn as individual village houses, and the admissions mix uses one figure per applicant.

## Activities and data

- Shape it: the supplied September 2, 2026 policy-statistics lecture, slide 4. Seven grouped bins with 245 villages. Mean/variance/SD use bin midpoints. Median uses uniform within-bin interpolation. Other shape presets and user drawings are labeled separately.
- Pull the mean / Find the middle: slide 12's complete population of 230 villages. Frequencies expand into equally weighted village observations. Changing the largest village is a hypothetical scenario.
- Stretch the spread: seven synthetic village sizes, centered at 325. A fixed graphical area scale makes the square areas proportional to squared deviations.
- Mix the groups: synthetic admissions rates. The two within-department rates are fixed assumptions. Only application proportions vary; this is not historical Berkeley data.

The source PDF and learner identity are not included. The public page is direct-link oriented, with noindex and Pagefind exclusion, not access restricted.

## Verification

From the repository root: `node --test tests/unit/policy-statistics.test.mjs`.
The GitHub Pages build also runs these arithmetic regression checks. Browser validation covers desktop/mobile, pointer drawing, range controls, median endpoints, spread scaling, and composition reversal. Update the tests when changing the datasets or statistical conventions.
