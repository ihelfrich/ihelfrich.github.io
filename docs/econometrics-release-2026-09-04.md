# Econometrics development edition: release record

## Scope

The Econometric Argument lives at `/econometrics/` within the portfolio. Twelve compact chapters connect target definition, probability, projection, inference, experiments, measurement, IV/GMM, panels, local designs, machine learning, dependence, and decisions. It includes 24 worked exercises, three small synthetic experiments, a printable full-text route, optional local study notes, and classroom/workshop guidance.

This is a development edition, not an externally peer-reviewed textbook or a pedagogically validated intervention. The reading room distinguishes established results, current exposition, and research-frontier papers. Earlier coauthored/public teaching projects are linked separately. No private learner material or downloaded textbook PDFs are distributed.

## Numerical verification

`npm run check:econometrics` checks fourteen invariants and simulation properties, then parses chapter metadata, renders mathematics with KaTeX, and checks the built course links and portfolio integration.

- Every displayed causal world yields the same observed sample.
- The intervention mean agrees with the stated structural model.
- Seeded samples reproduce; OLS satisfies residual normal equations.
- Large samples approach the specified moments.
- Known-sigma Gaussian confidence intervals approach 95% coverage across 20,000 replications; fixed selection bias persists as intervals shrink.
- DiD sensitivity intervals agree with the explicit restriction; investment boundaries include the zero-net-value case correctly.
- Invalid numerical inputs are rejected; CSV quoting is checked.

The browser-downloaded observations and a 100-study interval batch were independently checked using the provided Python and R reproductions. Both recovered sample slope 0.842717 and intercept 0.120551. Both verified the default sampling batch's realized coverage of 0.92. This random batch is not evidence against the procedure's nominal 0.95 coverage under its zero-bias model.

Chapter code examples were executed. Independent mathematical review corrected a chapter/lab numerical mismatch, clarified the conditional disturbance restriction with fitted synthetic-control weights, made the iid assumption explicit in a sandwich derivation, and qualified what can be calculated from one realized randomized assignment.

## Rendering and behavior

- Built all 18 course/support routes with mathematical notation.
- Inspected desktop homepage, chapter typography, and the rendered least-squares derivation.
- Inspected a 390px mobile chapter and lab layout; no document-level horizontal overflow was observed.
- Changed the causal slope, selection bias, sample size, and trend-violation bound in the browser; observed readouts agreed with the model.
- Verified note persistence across reload and completion toggle; cleared the test note/progress.
- Verified topical search and suggested reading paths.
- Triggered and checked actual CSV downloads. The browser automation's download-event waiter timed out, but the files were saved and independently reproduced successfully.
- Ran the portfolio's existing copy, fieldbook, component, rendered-style, public-artifact safety, and discovery checks.

## Limits retained on the public page

No unknown-variance or clustered-data coverage guarantee is implied by the Gaussian illustration. The DiD band excludes sampling uncertainty. The browser does not implement production DML or HonestDiD. The advanced chapters are compact entry points, with more extensive reading required for specialist work. The synthetic business quantities are assumptions, not company findings.
