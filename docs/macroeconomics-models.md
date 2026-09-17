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

No real-economy forecasts, estimated causal effects, policy recommendations, calibrated welfare comparisons, full RBC labor-leisure model, heterogeneous-agent aggregation, general DSGE solver or comprehensive PhD curriculum. The tools support teaching and inspection of specified macroeconomic mechanisms from undergraduate through graduate computational work. Some technology parameters are normalizations. No textbook figures, proprietary slides or learner-specific information are redistributed.

## Failure behavior

Invalid domains throw named errors. The interface retains the last successful calculation and displays an error instead of silently changing an assumption. Singular New Keynesian coefficient systems fail explicitly; indeterminate particular solutions and large local responses are clearly labeled. Missing finite Solow steady states are shown as none. Bellman iteration limits are reported, not described as convergence. Paths exceeding the guarded numerical range request smaller horizons or growth rates. No borrowing bound, nonnegativity fix or clipping is added merely to make a picture look plausible.

## Verification entry points

- `npm run check:macroeconomics`: analytic fixtures, accounting invariants, zero/extreme cases, market clearing, household Euler equality, NK equation residuals and determinacy, Bellman feasibility and analytic-policy grid refinement, deterministic replay, parameter-domain matrix, and DOM interaction checks.
- `npm run check`: existing site copy, fieldbook, component, static build, style and public-CV safety checks.
- `npm run build`: normal production build with site search/discovery pipeline.
- UI interaction checks run in happy-dom. This release has not yet had manual browser visual QA. The local preview is available for review; no public publication has been performed.

The required generic determinism scanner is C/C++-specific. The JavaScript engine is separately checked for random, time and DOM dependencies; repeated parameter fixtures must return identical serialized results. No C/C++ scanner result is treated as evidence about JavaScript execution.
