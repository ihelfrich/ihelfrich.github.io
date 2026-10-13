# Financial Economics draft review

Status: **60 original draft families; inactive and not approved for delivery.** Six units contain ten items each. Course key: `financial-economics`. All records retain `reviewStatus: draft` and constructed scenarios. No runtime, registry, activation, or test files were edited by this drafting agent.

## Curriculum evidence

Verified by opening official university pages on October 12, 2026:

- [MIT 15.401 Finance Theory I, Fall 2008 calendar](https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/pages/calendar/). The calendar provides a progression through present value, fixed income, equities, forwards, options, portfolio theory, CAPM/APT, investment decisions, and market efficiency. It anchors units 1–6, especially the explicit separation of valuation, risk, and information.
- [Yale ECON 251 Financial Theory, Fall 2009 syllabus and session calendar](https://oyc.yale.edu/economics/econ-251). The page includes the syllabus and dated course identification, with sessions on present value, yield-curve arbitrage, uncertainty, dynamic hedging, CAPM, covariance pricing, and leverage. It supports the state-contingent and equilibrium emphasis in units 1–4 and the financing-risk discussion.

These are two official R1 university course sources. They are historical curriculum anchors, not evidence of current market conditions. Question wording, numbers, scenarios, and distractors were composed for this draft; no source assessment questions or solutions were copied. The URLs establish curricular alignment rather than attribution of these constructed examples to the universities.

## Scope and assumptions

The sequence covers discounting/bonds; risk/portfolios; asset pricing/no arbitrage; derivatives; information/efficiency; corporate finance. Numerical values are hypothetical and not investment advice. Annual versus subannual effective rates, nominal compounding, cash-flow timing, state probabilities, no-dividend assumptions, short-sale and financing conditions are stated where the key depends on them. Model claims are conditional. Efficiency items make no claims about actual markets' empirical efficiency or historical returns.

Every item was read for one defensible correct answer, three distinct misconception-based alternatives, self-contained assumptions, explanatory reasoning, and a non-answer-revealing hint. This is author self-review plus parent spot review, not an independent subject-matter approval.

## Executed verification

A local Python standard-library audit passed: exactly 60 records, six units of ten, unique IDs, correct unit/topic correspondence, four distinct choices per item, nonempty hints/explanations/sources, and draft status throughout. Forty-seven numerical checks were executed, covering valuation, annualized yields, portfolio moments, probability weights, risk pricing, replication, option payoffs, Bayes updating, project valuation, WACC, leverage, and waiting value. The common-risk limit was checked using n=1,000,000,000 within tolerance. Assertions use independent formulas against the displayed rounded values; they are not a universal validator of prose.

Examples of checked results: bond price 1,018.594104; annuity 190.909091; forward rate 6.009615%; portfolio standard deviation 14.142136%; state-claim price 42; risk-neutral probability 0.625; call value 11.904762; project NPV 4.132231; WACC 7.5%; waiting value 20. Parent additionally reported passing independent checks for units 1–3.

Corrections before final save:

- u2-08: replaced an opaque 5% alternative with 9%, representing leveraged excess return without the risk-free intercept.
- u3-02: replaced an arbitrary alternative with 48, which swaps the two state prices.
- u3-07: changed an alternative to 4, isolating use of the wrong state's discount factor.
- u3-10: changed an alternative to 0.375, isolating confusion of up and down probabilities.
- u4-09: explicitly required a strictly positive strike, supporting strict early-exercise suboptimality.
- u6-04: corrected the title from one-period to two-year IRR; the calculation was already correct.
- u6-05: replaced an implausible rejection alternative with indifference based solely on both projects having positive NPV.
- u6-09: replaced social-welfare terminology with total financial value; shareholder-creditor surplus is not a full welfare criterion.

No numerical key errors were found. Draft-only status remains the next gate: independent pedagogical review and explicit activation decision are still required.

## Item-level self-review

| Item suffix | Checked reasoning and ambiguity gate | Result |
|---|---|---|
| u1-01 | Two full annual discount periods | Pass |
| u1-02 | Separate year-end annuity cash flows | Pass |
| u1-03 | Monthly nominal-to-effective conversion | Pass |
| u1-04 | Perpetuity first payment at year 1 | Pass |
| u1-05 | Coupon and principal valuation; premium sign | Pass |
| u1-06 | Annual compound yield versus cumulative return | Pass |
| u1-07 | Macaulay versus modified duration | Pass |
| u1-08 | Decimal yield change and negative price slope | Pass |
| u1-09 | Multiplicative spot/forward identity | Pass |
| u1-10 | Exact purchasing-power deflation | Pass |
| u2-01 | Exhaustive unequal state probabilities | Pass |
| u2-02 | Decimal variance versus standard deviation | Pass |
| u2-03 | Initial portfolio weights | Pass |
| u2-04 | Zero covariance and square-root conversion | Pass |
| u2-05 | Negative-perfect-correlation hedge weights | Pass |
| u2-06 | Independent averaging leaves common risk | Pass |
| u2-07 | Matched-period excess-return Sharpe ratio | Pass |
| u2-08 | Negative borrowing weight and return base | Corrected alternative; pass |
| u2-09 | Expected utility before inverse transformation | Pass |
| u2-10 | Strict risk aversion with identical means | Pass |
| u3-01 | Identical future liabilities cancel under shorting | Pass |
| u3-02 | State-price weighting without probability normalization | Corrected alternative; pass |
| u3-03 | Risk-free claim cost versus return denominator | Pass |
| u3-04 | Beta multiplies market premium | Pass |
| u3-05 | Covariance divided by variance | Pass |
| u3-06 | Negative beta with explicit CAPM premise | Pass |
| u3-07 | Probability, discount factor, and payoff multiplied | Corrected alternative; pass |
| u3-08 | Equal expected cash flows can have different values | Pass |
| u3-09 | Rank deficiency without a false arbitrage claim | Pass |
| u3-10 | Risk-neutral rather than physical probability | Corrected alternative; pass |
| u4-01 | No-dividend cash-and-carry financing | Pass |
| u4-02 | Existing forward value versus delivery price | Pass |
| u4-03 | Option profit subtracts premium | Pass |
| u4-04 | Put payoff excludes unspecified premium | Pass |
| u4-05 | European parity with discounted strike | Pass |
| u4-06 | Both terminal replication equations | Pass |
| u4-07 | Discounted risk-neutral call payoff | Pass |
| u4-08 | Short call subtracts from owned share | Pass |
| u4-09 | No dividends, positive rate, positive strike | Added strike condition; pass |
| u4-10 | Short hedge matches physical sale exposure | Pass |
| u5-01 | Historical-information scope and net abnormal returns | Pass |
| u5-02 | Surprise adjustment versus predictable delayed profit | Pass |
| u5-03 | Percentage-point abnormal return difference | Pass |
| u5-04 | Joint test of pricing benchmark and efficiency | Pass |
| u5-05 | Same interval/capital base for costs | Pass |
| u5-06 | Conditional private information-acquisition incentive | Pass |
| u5-07 | Funding horizon distinct from eventual convergence | Pass |
| u5-08 | Risk neutrality does not remove expected selection loss | Pass |
| u5-09 | Posterior normalization over positive signals | Pass |
| u5-10 | Risk compensation versus abnormal profit | Pass |
| u6-01 | Initial cost and separately discounted receipts | Pass |
| u6-02 | Sunk cost excluded at today's decision | Pass |
| u6-03 | Foregone land sale is an incremental cost | Pass |
| u6-04 | Two-year cash flow annualized geometrically | Corrected title; pass |
| u6-05 | Mutually exclusive scale choice, unconstrained capital | Corrected alternative; pass |
| u6-06 | Market weights and debt-only tax adjustment | Pass |
| u6-07 | Fixed operations and full stated MM assumptions | Pass |
| u6-08 | No-tax leverage premium on equity | Pass |
| u6-09 | Total value versus financing party's captured benefits | Corrected wording; pass |
| u6-10 | State-contingent decision before averaging; zero interest | Pass |
