# Policy Statistics Lab

Standalone browser activities at `/learn/policy-statistics/`. No third-party runtime dependencies, data requests, accounts, or persistence. Serve the repository’s public folder over HTTP; `index.html` imports `lab.mjs` and `stats.mjs` using relative URLs. The stylesheet and local fonts use site-root URLs.

Each activity has a prediction question with immediate feedback. Focus mode hides the teaching sidebar and enlarges the experiment; Escape exits it. Median observations are drawn as individual village houses, and the admissions mix uses one figure per applicant. The header links to the site home page, and the footer links to the home, teaching and booking pages.

## Activities and data

Every table is synthetic, constructed for these exercises; none describes real villages, applicants or admissions decisions. The page labels each one as synthetic or illustrative.

- Shape it: a synthetic grouped table of 170 villages in seven population bins of width 50, starting at 100 people. The counts are skewed to the right, and the grouped mean (about 252.6) exceeds the interpolated median (about 244.3). Mean, variance and SD use bin midpoints; the median uses uniform within-bin interpolation. Other shape presets and user drawings are labeled separately.
- Pull the mean / Find the middle: a synthetic frequency table of 200 villages from 100 to 800 people plus one town of 5,000. Frequencies expand into equally weighted observations. The count is even, so the median averages positions 100 and 101, both 500. The mean (477) stays below the median despite the long right tail: the 90 villages below the median fall 19,800 people short of it, more than the 15,200 by which the 66 above it, the town included, exceed it. Shrinking the town toward 800 is a hypothetical scenario that moves only the mean.
- Stretch the spread: seven illustrative village sizes, centered at 325. A fixed graphical area scale makes the square areas proportional to squared deviations.
- Mix the groups: illustrative admissions rates. The two within-department rates are fixed assumptions. Only application proportions vary; this is not historical admissions data.

The public page is direct-link oriented, with noindex and Pagefind exclusion, not access restricted.

## Verification

From the repository root: `node --test tests/unit/policy-statistics.test.mjs`.
The GitHub Pages build also runs these arithmetic regression checks. Browser validation covers desktop/mobile, pointer drawing, range controls, median endpoints, spread scaling, and composition reversal. Update the tests when changing the datasets or statistical conventions.
