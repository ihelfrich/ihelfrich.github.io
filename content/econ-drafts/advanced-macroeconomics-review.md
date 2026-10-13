# Advanced Macroeconomics draft review

Status: draft; not activated. Review date: October 12, 2026. All 60 exercises are original constructed scenarios, with one keyed answer and three distinct distractors each. Source links establish curriculum coverage; they do not attribute these invented examples to course instructors. No runtime files were changed.

## Scope and prerequisites

Six units of ten cover dynamic optimization/Ramsey, overlapping generations, RBC equilibrium, linearization/rational expectations, New Keynesian models, and policy/time consistency. The outline identifies intermediate theory, calculus, optimization, probability, difference equations and elementary eigenvalue analysis as prerequisites; the continuous-time questions additionally require differential equations. This is a graduate-core bridge, not ordinary introductory macroeconomics. It is not an exhaustive graduate sequence: heterogeneous-agent computation, estimation, open-economy dynamics and advanced asset-pricing methods are outside this bounded set.

## Official course verification

Accessed with the web tool on October 12, 2026:

- Berkeley Economics 202B syllabus: https://eml.berkeley.edu/~webfac/dromer/e202b_sp08/syllabus.pdf — explicitly covers Ramsey, Diamond OLG, competitive business-cycle models, log-linearization, calibration, utilization and nominal price rigidity. This is the advanced macro source specified in the repository curriculum plan.
- MIT 14.451 Dynamic Optimization Methods with Applications: https://ocw.mit.edu/courses/14-451-dynamic-optimization-methods-with-applications-fall-2009/pages/syllabus/ — graduate course covering deterministic and stochastic discrete-time methods and continuous-time methods.
- MIT 14.461 Advanced Macroeconomics I: https://ocw.mit.edu/courses/14-461-advanced-macroeconomics-i-fall-2012/pages/syllabus/ — graduate optimal monetary/fiscal policy and expectations, with graduate microeconomic theory and growth prerequisites.

These are official courses at two R1 universities. Coverage is deliberately selected rather than a claim that any single syllabus has this exact sequence.

## Complete self-review

Every prompt, key, three distractors, explanation and hint was checked for internal consistency and a unique answer under its stated assumptions.

- U1 01–10: verified discrete versus continuous Euler equations, gross return versus marginal product, Bellman timing, transversality, borrowing-constraint inequality direction, decreasing-MPK comparison, saddle-path qualifications, resources and effective-worker normalization.
- U2 01–10: checked logarithmic saving, next-cohort denominator, full depreciation, positive fixed point, dynamic-efficiency conditions, pension cohort accounting, limited Ricardian-equivalence claim, endowment-inclusive Euler equation, land-market closure and welfare caveats.
- U3 01–10: checked labor FOC, closed-economy goods balance, competitive wage, predetermined capital, wealth/substitution ambiguity, expected-product pricing, utilization residual, calibration versus identification, conditional government-absorption arithmetic and welfare-equivalence assumptions.
- U4 01–10: checked exact log Cobb–Douglas relation, share-weighted sums, zero-reference variables, iterated forecasts, terminal restriction in forward solution, root-count/rank qualification, gross-rate derivative, first-order uncertainty limitation, conditional orthogonality and accumulation weights.
- U5 01–10: checked decimal rate units, IS and Phillips signs, Calvo spell support, natural/efficient output distinction, Taylor-rule real-rate arithmetic, lower-bound gap, cost-push impossibility, expected-inflation transmission, policy closure and forward-guidance dependence.
- U6 01–10: checked discretion before fulfilled expectations, commitment before expectations, unchanged preferences in time inconsistency, quadratic minimization, expectations channel, government budget signs, exact debt-ratio denominator, consolidated present values, Lucas critique and capital-tax timing.

## Executed verification

A Python standard-library check under `uv run --no-project python` passed: 60 records, six units of ten, unique IDs, exactly three wrong answers, four distinct options per question, all required text/source fields populated, draft/constructed metadata on all records, and exact outline-topic alignment.

Executed numerical checks for topics 1.1, 1.2, 1.3, 1.9; 2.1, 2.2, 2.4, 2.6, 2.8; 3.2, 3.3; 4.2, 4.4, 4.5; 5.1, 5.2, 5.3, 5.5, 5.6; 6.1, 6.4, 6.6, 6.7. All 23 passed at 1e-10 relative/1e-12 absolute tolerance. Additional residual checks confirmed the old-age-endowment Euler equation (2.8), OLG stationary fixed point (2.4), and quadratic policy first-order condition (6.4). The geometric-series forward solution was checked with 100 terms.

## Corrections and limitations

Parent independent review identified an overly strong modal verb in 2.7. Changed “Why need the tax cut affect current consumption?” to “Why can the tax cut affect current consumption?” Finite lives without operative bequests remove a standard equivalence condition; they do not alone prove a necessary signed response. No numerical key corrections were needed in the self-review.

The claim here is author self-review plus executed checks, not release approval or a completed rendered-page review. The parent owns independent review, canonical logging and any later activation decision.
