# Macroeconomics lab model register

**Scope:** `/macroeconomics/`, eight browser-based teaching models. Engine/schema version 1.0. No empirical data or fitted parameters. Catalog, equations and individual sources: `src/data/macroeconomics.mjs`. Canonical calculations: `src/lib/macroeconomics.mjs`. The UI reads those results and never recomputes model transitions independently.

Classification: behaviorally modeled, using synthetic illustrative parameters. Accounting identities and analytic solutions are distinguished from constitutive assumptions and numerical approximations.

## Implemented contracts

### State, units and timing

The default cadence is one discrete period; OLG explicitly uses a generation and New Keynesian policy explicitly uses a quarter. No frame-time integration, implicit annualization or mixing of continuous and discrete growth rates. Each period reads the previous complete state, calculates output, allocates consumption/investment, accounts for depreciation, and commits the next stocks once. There are no boundary exchanges with an unmodeled external sector.

| Model | State and process | Units and domains | Invariants / provenance |
|---|---|---|---|
| Solow | Extensive stores K and L; efficiency index A; output and investment are within-period flows; exogenous s, α, δ, n, g and B | Capital and output use the one-good numeraire; labor in workers; A dimensionless; B supplies the production normalization. α in (0,1), s and δ in [0,1], K nonnegative, L positive | Y=C+I; K′=K+I−δK; L′=(1+n)L; q′=[(1−δ)q+sBq^α]/[(1+n)(1+g)]. Exact discrete law. Solow production assumption. |
| AK | Extensive K and L; linear aggregate production; fixed s | a is output per unit of capital per period, not a saving share; worker growth only affects denominators | Exact growth in capital: sa−δ; exact per-worker growth: (sa−δ−n)/(1+n). Same resource identities. |
| Growth traps | Intensive k and y; fixed-cost upper envelope max(√k,a max(k−F,0)) | F and k in capital per worker; s in (0,1); δ,n nonnegative in UI | Roots must satisfy both the candidate branch and the actual upper envelope. F is a threshold in production, not an extra stock drain. Illustrated two-technology mechanism, not a solved multisector allocation. |
| Diamond OLG | k per young worker, wage and saving flows, gross return R, old/young consumption | One period per generation; β positive lifetime utility weight; log utility; α in (0,1); gross return positive | Wage=young consumption+saving; k′=saving/(1+n); Euler equality. Dynamic efficiency assessed only at steady state. |
| IS–LM | Static equilibrium Y and r; controls G, T, M/P, c and b | Output and real balances in normalized real units; decimal rates internally, percent on chart; c in (0,1), b positive | Y=C+I+G; M/P=.8Y−1000r. Analytic linear solution. Negative C/I reported, never clipped. |
| New Keynesian | Jump variables output gap x, inflation π and rate i; one AR(1) exogenous shock | Quarterly local deviations; all plotted as percentage points; no annualization. β in (0,1), σ,κ>0; ρ<1 | All three expectational equations; unique bounded solution requires both eigenvalue moduli >1. Fundamental particular solution remains labeled when determinacy fails. Large responses are flagged. |
| Debt | Debt/GDP ratio b, exogenous r,g and primary surplus p | Rates and ratios decimal internally; p uses next-period GDP. Positive surplus reduces debt; negative b is net assets | b′=(1+r)/(1+g)b−p. Exact discrete arithmetic. Holding surplus is (r−g)b/(1+g). |
| Optimal growth | Intensive capital grid and two productivity states; value and policy arrays | Labor fixed at one; strictly positive consumption; β≤.985; α∈[.1,.6]; δ∈[.01,1]; γ∈[.5,5]; N integer in [21,241] | Feasibility c+k′=zk^α+(1−δ)k; normalized Markov rows; Bellman residual; deterministic lexicographic ties. CRRA utility is a maintained preference, not an empirical welfare measure. |

Catalog controls have narrower domains than some public engine functions. Validation occurs in both layers. All fields are controls or model outputs; none are observations or estimated latent states. There is no organism/learning decomposition, spatial coordinate system, or multi-fidelity state transfer in these models.

### Determinism, replay and numerical limits

All engines are pure functions of explicit parameter objects. Models use immutable period snapshots and chronological commits. Numerical displays, animation scheduling, pointer movement, and viewport size do not affect the canonical results. There is no random path sampling; the stochastic growth model integrates a specified two-state transition matrix, and New Keynesian responses use conditional expectations. Exact replay means recalculating from the same parameters; no checkpoint format or persistent state is claimed.

Optimal growth uses exhaustive finite-grid value iteration, uniform capital bounds at 0.05 and 2.5 times the deterministic steady-state benchmark, update tolerance 1e-9, and at most 1,800 iterations. A fresh Bellman application computes the reported residual and policy. The contraction bound concerns the discrete fixed point only. Grid-boundary policy choices are counted and disclosed. No empirical uncertainty interval is implied by numerical error bounds.

Resolution comparison was specified before inspection: log utility, full depreciation, no productivity risk, α=.33 and β=.95; compare policies with the analytic k′=αβk^α at N=41,81,161. Same grid endpoints for all runs.

| Grid points | Policy RMSE against analytic policy | Fresh Bellman residual | Grid-edge choices |
|---:|---:|---:|---:|
| 41 | 0.003042086729 | 9.19961e-10 | 0 |
| 81 | 0.001697443711 | 9.19790e-10 | 0 |
| 161 | 0.000787294399 | 9.19798e-10 | 0 |

These fixture results establish refinement for that benchmark; they do not guarantee accuracy everywhere in parameter space. The other models use analytic static solutions or exact discrete transitions, so no integration-step convergence claim applies.

### Dimensional and structural checks

- Units: stock changes equal within-period investment less depreciation; population changes the denominator, not the resource ledger. Capital and output flows are not graphed as comparable quantities on the same vertical scale.
- Limits: zero saving, zero depreciation, zero population growth, zero shocks, deterministic productivity, log utility, full depreciation, and equal interest/growth rates are checked.
- Signs: saving increases AK growth; additional workers dilute given capital; fiscal expansion raises static IS–LM output; a monetary policy shock contracts output under the baseline active rule; surpluses reduce debt.
- Scaling: scaling aggregate capital and labor together scales Solow output proportionally and leaves intensive variables unchanged.
- Special cases: exact Solow discrete steady state; textbook AK growth; manufactured trap crossings 16 and 72; log/full-depreciation optimal saving benchmark.
- Scope: equation residuals establish algebraic consistency; determinacy, approximation and economic interpretation are checked separately.

## Explicit non-claims

No real-economy forecasts, estimated causal effects, policy recommendations, calibrated welfare comparisons, full RBC labor-leisure model, market-clearing heterogeneous-agent general equilibrium, general DSGE solver or exhaustive research curriculum. The tools support teaching and inspection of specified macroeconomic mechanisms from undergraduate through graduate computational work. Some technology parameters are normalizations. No textbook figures, proprietary slides or learner-specific information are redistributed.

## Failure behavior

Invalid domains throw named errors. The interface retains the last successful calculation and displays an error instead of silently changing an assumption. Singular New Keynesian coefficient systems fail explicitly; indeterminate particular solutions and large local responses are clearly labeled. Missing finite Solow steady states are shown as none. Bellman iteration limits are reported, not described as convergence. Paths exceeding the guarded numerical range request smaller horizons or growth rates. No borrowing bound, nonnegativity fix or clipping is added merely to make a picture look plausible.

## Verification entry points

- `npm run check:macroeconomics`: analytic fixtures, accounting invariants, zero/extreme cases, market clearing, household Euler equality, NK equation residuals and determinacy, Bellman feasibility and analytic-policy grid refinement, deterministic replay, parameter-domain matrix, and DOM interaction checks.
- `npm run check`: existing site copy, fieldbook, component, static build, style and public-CV safety checks.
- `npm run build`: normal production build with site search/discovery pipeline.
- UI interaction checks run in happy-dom. This release has not yet had manual browser visual QA. The local preview is available for review; no public publication has been performed.

The required generic determinism scanner is C/C++-specific. The JavaScript engine is separately checked for random, time and DOM dependencies; repeated parameter fixtures must return identical serialized results. No C/C++ scanner result is treated as evidence about JavaScript execution.

## Suite expansion contract (schema 2)

Classification remains synthetic, behaviorally modeled. Sources are independent research and open academic treatments, linked in each module. None of these demonstrations is empirically calibrated. All rates are discrete per-period rates unless a matching hazard is explicitly converted to a probability. All updates read period-t state and commit period-t+1 state once. No random sampling or visual-state mutation of model results.

| Process | State, units, domain and constitutive assumption | Invariants and numerical method | Boundary and non-claims |
|---|---|---|---|
| Two-sector human capital | Aggregate equipment K and workforce L; skills H per worker; production-time share u in (0,1]; fixed saving; education productivity η per period | Y=K^α(uHL)^(1−α), K′=(1−δ)K+sY, H′=[1+η(1−u)]H, L′=(1+n)L; production and education workers sum to L | Exogenous allocation experiment inspired by Lucas; neither optimal education choice nor Lucas externality estimated. Positive finite stores required |
| Ramsey | Capital and consumption per fixed worker; CRRA; α∈[.15,.6], β∈[.85,.98], δ∈[.02,1], γ∈[.5,5] | Reuse deterministic finite-grid Bellman solver; linearly interpolate capital policy; exact resource identity along interpolated path; analytic steady-state benchmark | Grid bounds disclosed; no shooting or claim of exact saddle path. Fresh Bellman residual plus on-path Euler discrepancy. Compare N=41/81/161 against log/full-depreciation analytic solution |
| RBC benchmark | Fixed labor, log utility, full depreciation, log productivity AR(1); shock is log points | Exact k′=αβY; deterministic no-further-innovation response; consumption+investment=output; log deviations from no-shock steady state | Restrictive analytical Brock–Mirman-type benchmark, not an estimated RBC with endogenous hours; levels path is not expectation of levels under future uncertainty |
| Open endowment economy | Two-period goods/endowments, initial net foreign assets b₀, positive gross rate R, CRRA preferences | Closed-form Euler c₁/c₀=(βR)^(1/γ); present-value and both period budgets; terminal assets zero | Unconstrained borrowing; fail if lifetime wealth nonpositive; no sovereign default or investment |
| Matching flows | Unemployment share u, vacancies per unemployed θ; separation probability s∈[0,.2]; hazard λ=μθ^(1−η) | Finding probability f=1−exp(−λ); u′=u+s(1−u)−fu, steady u=s/(s+f); exact exclusive beginning-period transitions | θ is exogenous; this is a matching-flow/Beveridge module, not a free-entry Nash-bargaining DMP equilibrium. Hazard conversion guarantees valid probabilities |
| Incomplete markets | Household assets a on [0,a_max], income z∈{1−spread,1+spread}; CRRA; fixed wage and interest; symmetric persistent Markov income | Exhaustive Bellman iteration, tol1e−9/max2000; c+a′=wz+(1+r)a. Induced Markov law propagates joint distribution from uniform mass; lazy iteration tol1e−12/max10000; report true invariant residual | Zero borrowing bound; upper-bound mass and chosen initial-distribution limit disclosed; no uniqueness claim for invariant distribution. Partial equilibrium only. Compare grid resolutions 41/61/101 with fixed endpoints before assessing numerical accuracy |
| Sequence-space propagation | Deviations in goods per period; synthetic consumption kernel J[t,s]=m(1−λ)λ^(t−s) for t≥s, else0; m∈[0,.95], λ∈[0,.95] | C=JY; Y=C+G; triangular inverse M=(I−J)⁻¹; exact finite-horizon linear solve; verify (I−J)M=I and causality | Pedagogical linear kernel supplied as an assumption, not computed from heterogeneous household policies. No anticipation, HANK, estimation or nonlinear transition claims |

Accepted identity residual is relative 1e−9 for analytic accounting and probability mass; Bellman residual target 1e−7, invariant-distribution residual target 1e−8. Nonconvergence is surfaced; failure is never converted into a zero result. Distribution grid refinement reports sensitivity, including irregular changes caused by discrete policy switches. Spatial frames, stochastic streams and multi-fidelity reconciliation do not apply.

### Expansion evidence (2026-09-17)

The new modules pass resource, Euler-benchmark, probability-mass, market-clearing and inverse-matrix fixtures. Seventy seeded admissible parameter fixtures replay exactly and remain finite. These supplement the 192 original fixtures.

Preregistered fixed-endpoint household refinement (β=.94, r=.02, w=1, γ=2, spread=.5, persistence=.9, assets 0–20):

| N | Mean assets | Wealth Gini | Bellman residual | Invariant-distribution residual |
|---:|---:|---:|---:|---:|
| 41 | 2.250000 | .458848 | 9.29e−10 | 1.86e−12 |
| 61 | 2.344476 | .476277 | 8.89e−10 | 1.91e−12 |
| 101 | 2.442736 | .469396 | 8.94e−10 | 1.90e−12 |

Mean assets differ by about 8.6% between the coarsest and finest grid; the Gini is not monotone in resolution. This is sensitivity evidence, not a continuous-state accuracy certificate. The upper-bound mass is negligible in this fixture but must be checked at other parameters.

Ramsey policy-path benchmark (α=.33, β=.95, full depreciation, log utility, initial capital .6 times steady capital, 40 periods):

| N | Maximum absolute capital-policy error | Maximum relative Euler discrepancy | Bellman residual |
|---:|---:|---:|---:|
| 41 | .003818 | .041494 | 9.20e−10 |
| 81 | .001840 | .020240 | 9.20e−10 |
| 161 | .001107 | .009514 | 9.20e−10 |

Errors are measured against the independent analytical policy k′=αβk^α. These results show improvement for this fixture and explain why both Bellman and Euler diagnostics are displayed.

### Linked interface contract

A canonical integer selection identifies a period or grid state. Time plots, policy plots, distribution plots, numerical substitution, signed accounting bars, and table rows read that same selection. Productivity selection changes which branch is inspected without solving a new economy. Parameter changes recalculate the economy; ordinary state selection does not. Clickable comparative-static graphs quantize inputs to their control domain. All interactive line plots have arrow-key and Home/End controls; matrix cells support arrow navigation. Selection controls preserve focus. Errors retain the last successful numerical result and its matching parameter snapshot.

Jacobian columns identify impulse dates and rows identify response dates. Selecting a cell changes both the impulse control and the selected response date. The two matrix color scales are independent and explicitly labeled. A horizon reduction clips the impulse date and selected period to the remaining horizon. All substitutions indicate rounding and render scientific notation mathematically.

### Research provenance

Catalog source fields link independent literature or academic implementations. Research panels contain original derivations, questions, assumptions and links to related live modules. The Ramsey and Aiyagari derivations were checked against QuantEcon; the analytical stochastic growth policy against its log/full-depreciation benchmark; human-capital context against Lucas (1988); matching flows against MIT search/matching materials; international budgets against Uribe–Schmitt-Grohé; and sequence-space composition against Auclert et al. (2021). The sequence kernel, fixed-share education experiment, matching-probability convention and finite discretizations are explicitly identified as local implementations rather than claimed replications of the full cited models. Frontier references include Econ-ARK and Moll’s HJB/KFE and transition-method code collections; they are not bundled or silently executed.
