# Market Mechanics Lab model register

**Scope:** Competitive linear markets, static tax/subsidy equilibria, efficient-rationing price controls, and explanatory accounting. Schema 2 preserves existing URL keys; `tax` holds the nonnegative wedge magnitude in either policy mode.

## Implemented contracts

Classification: synthetic analytical teaching model, not an empirical forecast.

- Parameters: inverse demand P = a − bQ, inverse supply P = c + dQ. Price intercepts and policy wedges have the user's price units; slopes have price/quantity units. Q uses the user's quantity units; area totals use price × quantity. No implicit dollar/week conversion. Elasticity and incidence shares are dimensionless.
- Valid domain: a > c ≥ 0, b > 0, d ≥ 0; finite parameters at most 1e9, nonzero slopes at least 1e−9. Inputs accept linear P/Q equations, decimals, scientific notation, numeric fractions, and coefficients on either side. Vertical or nonlinear curves are rejected. No evaluation of executable expressions.
- State/control: six numeric coefficients and controls plus mode; history is an optional captured market. Output: equilibrium quantities/prices, welfare ledger, geometric extents, and diagnostic elasticity. Negative buyer prices under sufficiently large subsidies are shown explicitly; supply never has a negative intercept.
- Tax Q = max(0, (a−c−t)/(b+d)); subsidy Q = (a−c+s)/(b+d). Government balance is +tQ for a tax and −sQ for a subsidy. CS = (a−Pb)Q − bQ²/2; PS = (Ps−c)Q − dQ²/2. These general area expressions also handle price-control trapezoids.
- Invariant: CS + PS + government balance + DWL = unrestricted total surplus, with absolute fixture tolerance 1e−7 (floating-point relative precision governs larger scales). Zero wedge recovers the free equilibrium; horizontal supply gives full price pass-through and zero competitive producer surplus. At no trade, tax transaction prices are undefined, not uniquely imputed.
- Horizontal supply under a binding ceiling below marginal cost supplies zero; above marginal cost desired supply is unbounded, but actual trade remains demand-limited. Infinity is a limiting-case diagnostic, never an SVG coordinate.
- Cadence: each UI action proposes a complete validated market, then commits it atomically. Rendering and replay solve the same pure function. Animation uses deterministic interpolation, including passage through zero policy when changing modes. There are no stochastic processes, numerical integrations, cross-boundary transfers, or resolution-dependent estimates.
- Axes are presentation-only, inferred from curves, both equilibrium prices, quantities, and any captured baseline. Manual positive maxima override the viewport, not model quantities or welfare. Negative subsidy prices extend the lower price boundary automatically. Automatic rescaling resumes after transitions and on request.

## Explicit non-claims

No externalities, endogenous financing costs, monopoly, dynamics, empirical calibration, or causal predictions. Replay is comparative statics. Efficient rationing is assumed for price controls. Producer surplus does not subtract fixed costs. Finite-change elasticity burden shares are exact here because curves are linear, not for arbitrary nonlinear models. A per-unit price incidence share is not generally a share of total welfare changes. No student names or identifying references are included.

## Failure behavior

Malformed or unsupported equations, invalid curve directions, crossed intercepts and invalid coefficients leave the last valid market intact and display an explanation. Invalid hash state falls back to the default market. Invalid axis limits leave the current axes intact. Safe bounds protect calculations from non-finite geometry; they do not reinstate the old 100-unit limits.

## Verification entry points

- `node --test tests/unit/market-mechanics*.test.cjs`: existing 972 scenarios and 1616 interpolation frames; literal heat-pump, steeper-demand and childcare fixtures; parser rejection; share restore above 100; horizontal supply; negative buyer prices; 1025 further transition frames; real DOM startup and equation/policy/axis/probe controls.
- Deterministic replay: all mode-pair interpolation endpoints reproduce input state, intermediate welfare reconciles, and axis bounds remain finite. No random sources or hidden state enter the pure economic model.
- Browser review: actual equation entry and presets, automatic and manual axes, invalid-input retention, mobile/desktop layouts, hidden answers, and console errors.
- Unit/sign check: a subsidy subtracts government expenditure, increases quantity, lowers buyer price and raises seller receipts. Tax does the reverse until shutdown. Rescaling all prices and slopes by a common positive factor leaves quantities and incidence unchanged and scales welfare by that factor.
