# Computational Economics draft review

60 original constructed questions, six units of ten, all marked draft. Every question has one key, three distinct distractors, explanation and method hint. The outline states calculus, linear algebra, probability, constrained optimization and basic programming prerequisites, and identifies graduate extensions.

## Verified academic sources

- Stanford University, Kenneth Judd, Econ 288 Computational Economics, Autumn 2000–2001 official syllabus: https://web.stanford.edu/~judd/econ288/SUsyll2K.pdf . Opened and verified coverage of roots, optimization, equilibrium algorithms, interpolation, integration, simulation, dynamic programming and numerical error. The date comes from the document, not the search index timestamp. Historical software recommendations were not adopted.
- MIT OpenCourseWare, Guido Lorenzoni, 14.451 Dynamic Optimization Methods with Applications, Fall 2009: https://ocw.mit.edu/courses/14-451-dynamic-optimization-methods-with-applications-fall-2009/ . Opened and verified graduate dynamic-programming and optimal-control scope. Used for the dynamic-programming unit alongside Stanford.

The curriculum-plan search yielded no computational-economics entry; the official sources above establish this course’s scope. Questions are original constructions, not reproductions of university assessments. No empirical estimates or current institutional facts are asserted.

## Checks and repairs

Author reviewed all 60 prompts, keys, alternatives, explanations and assumptions. Checks include continuity for bracketing, feasibility and global versus local optimization, importance-sampling support, fixed control-variate coefficients, discounting and bounded rewards, update timing, row-stochastic transition convention, complementarity signs, nominal normalization, off-grid validation, and floating-point versus approximation error.

Executed 40 independent quantitative checks: bisection, Newton, projection, stationarity, backtracking, residual scaling, root conditioning, constrained maximization, quadrature, Monte Carlo scaling, paired variance, antithetic draws, correlated simulation variance, Bellman returns and error bound, policy evaluation, action-ranking error, damping, cycling, linear equilibrium, stationary distribution, complementarity, simultaneous best responses, interpolation, Taylor expansion, grid scaling, tensor grid size, nonlinear expectation, rationalization, relative error, central difference, Euler stability and analytic benchmark residual. All passed. Parent independently checked the first 40 records and reported 27 checks passing with no blocking findings.

Final author edits: importance-sampling item 2.7 now explicitly specifies a strictly positive payoff on the uncovered target region, excluding a harmless zero-integrand exception. Benchmark item 6.10 uses a distinct parameterization from policy-evaluation item 3.3 to reduce internal repetition. No other answer-key repairs were needed.

Structural checks passed: 60 unique IDs and prompts; ten records per unit; four distinct choices per question; populated explanation, hint and sources; draft/constructed flags; outline topic/title consistency. Exact prompt comparison with the other local draft JSON banks found no duplicate. Conceptual overlap with mathematical economics and dynamic optimization remains intentional; this course emphasizes numerical execution and diagnostics. No runtime activation or shared files changed.

Frozen question-source SHA256: `28d773562487aae80ffdf28611e5c73d8d2c13e7c595bd05249c068acd7ec93a`.

Parent integration: computational-economics-u5-03 hint clarified. Final released source SHA256: 860b9afc43b930098e84fda56cb7486ea0bffffa62a43e8652a6d0304244265b.
