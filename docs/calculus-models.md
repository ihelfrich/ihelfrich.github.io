# Calculus in motion — model register, schema 1

**Scope:** `/calculus/`, nine deterministic teaching experiments, engine/schema 1.

Classification: synthetic, analytic teaching fixtures. Source provenance: original implementations of standard calculus identities, checked against OpenStax Calculus volumes 1 and 3 (links on the page). Alan Becker’s Animation vs. Math is credited as a creative reference, not as a source of the derivations. No video assets or soundtrack are reused.

## Implemented contracts

Controls are dimensionless coordinates, shape choices, exponents, percentages, or normalized economic quantities. Outputs are function values, derivatives (output units / input unit), curvature (output units / input unit squared), finite changes, or dimensionless elasticities. A natural log of a measured quantity means a log relative to a fixed reference; log differences cancel that reference. Production inputs and payoff quantities are normalized teaching indexes. Fields, stores, fluxes, empirical calibration, inherited/developed/learned states, spatial frames, boundary exchange and multi-fidelity state are not applicable.

Pure `calculate(lesson, parameters)` consumes an immutable parameter snapshot and returns an analytic result. UI controls, equations and plots share this result. Each event commits one parameter change then recomputes; animation changes only the displayed input, using elapsed time to choose that input. There is no time-integration solver, stochastic process, global random entropy, or persistent student data. Display rounding does not enter the calculations. Repeated snapshots must replay identically. Pointer and action inputs are quantized to the declared control step; an optimization action moves toward the exact optimum, which is separately displayed.

| Process | Domains and units | Invariants and special cases |
|---|---|---|
| Slope | x ∈ [−2,2], h ∈ [.01,1]; square, sine, exponential, absolute value | Finite secants are separate from the analytic derivative. At the absolute-value corner, derivative is null and left/right secants remain −1/+1. Sine arguments are radians. |
| Product | Rectangle sides x and x+1, x∈[.5,3], h∈[.01,1] | Exact new area = (x+1)h+xh+h². Linear prediction excludes the corner. Areas have squared length units. |
| Chain | u=1+x², ln u, x∈[−2,2], h∈[.01,.5] | Derivative 2x/(1+x²); finite log change uses log1p. Negative x changes the derivative sign; x=0 derivative is zero. |
| Logs | x∈[.5,8], proportional change ∈[−.8,1]; bases e, 2, 10 | Δlog_b x=log_b(1+r), linear approximation r/ln b. Reject x≤0, r≤−1, b≤0, b=1. Equal ratios have equal log distances. |
| Partials | K,L∈[1,6], α∈[.1,.9], moves ∈[−.5,.5] | Cobb–Douglas Euler identity K Y_K+L Y_L=Y. Total differential sums partial contributions; finite change is computed independently. α is elasticity, not MPK. Inputs remain positive. |
| Gradient | x,y∈[−2,2], angle∈[0,360] degrees; bowl or saddle | Unit direction (cosθ,sinθ); D_v f=∇f·v, D_v²f=vᵀHv. Direction magnitude is one. At the saddle origin slopes vanish but directional curvatures can have either sign. |
| Taylor | x∈[.6,2], h∈[−.5,1]; log, exponential, cube | Analytic first/second derivatives; error=truth−prediction. Log endpoints remain strictly positive. No global accuracy claim. |
| Optimization | q∈[.5,8], cost c∈[1.5,8] | π=12 ln q−cq; unique optimum q*=12/c, strictly negative curvature. Controls cover every optimum. A finite grid step may not hit it exactly. |
| Accumulation | x∈[−2,2], h∈[.01,.8] | A=x³/3, A′=x²; exact ΔA=x²h+xh²+h³/3. Negative endpoint means negative oriented integral, even with nonnegative integrand. |

## Failure behavior

Invalid numeric domains throw explicit errors, rendered in an alert. No NaN is silently changed to zero. The common plot may clip extrapolated tangents to its visible frame. Contour colors sample 24×24 cells, while level sets are analytic sampled paths; slice curves use 101 points. These samples are presentation-only, never numerical derivative estimates. Spatial gradient arrows are coordinate projections, and a stationary zero gradient has zero length.

## Verification entry points

Run `npm run check:calculus` for analytic and DOM fixtures; `npm run check` adds the site build and release checks.

## Explicit non-claims

No empirical calibration, pedagogical efficacy study, computer-algebra generality, automatic proof, continuous optimization solver, or full calculus curriculum is claimed. The advanced notes connect the experiments to broader definitions without claiming comprehensive coverage.

## Verification and numerical bounds

Analytic identity tolerance: absolute 1e−9 on the declared fixtures. Tests cover product area accounting, Cobb–Douglas homogeneity, log ratios/base changes, chain-rule sign, unit-direction projections, saddle curvature, stationary optimal payoff, oriented integrals, invalid log domains, and every control’s endpoints at otherwise-default inputs. Identical inputs replay identically.

Preregistered approximation comparison: ln x at x=1 with h=.2 versus .1. Linear errors must improve by more than a factor of 3; quadratic errors by more than 6. For the partial differential, scale moves (.2,−.1) to (.02,−.01) at K=4,L=3,α=.4; error must fall by more than 50. These local comparisons illustrate expected Taylor orders; they do not establish uniform bounds or prove a limit. No empirical or pedagogical efficacy claim is made.

UI fixtures cover all nine chapters, numeric updates, reset, keyboard selection, compact navigation, hash navigation, exercise feedback, animation completion and reduced-motion behavior. Browser QA checks representative curve, rectangle and multivariable displays at responsive widths. Accessibility includes labeled native controls, keyboard plot inputs, live numerical readings, textual equations with MathML, focus indicators and no automatic animation on load.

## Fluid scene revision (schema 1, presentation revision 2)

The equation engine is unchanged. Persistent SVG reconciliation retains matching scene nodes while parameter changes recompute the same canonical result. Six-second playback samples continuous input coordinates from elapsed time; it is not a numerical evolution model. Slider, keyboard, and direct-drag edits remain bounded by their declared domains. Animation stops when the page is hidden or the user changes controls, and reduced motion disables playback and transitions.

The product view can translate its two strips and corner apart. Their widths, heights and area contributions remain unchanged; the separation gaps are presentation-only. Direct diagonal dragging changes h; a larger transparent hit target and keyboard arrows expose the same interaction. Focus mode hides surrounding narrative and has an explicit exit button and scoped Escape handler.

The partial and gradient surface views project a 20×20 analytic height mesh using a yaw camera; production height is scaled by 1/2 and quadratic landscape height by 1/6 before projection. These are display scales, not modified function values. Fixed-coordinate slices, the joint input move or chosen direction, and the selected point are projected through the same transform. Camera and map/surface changes do not change any numerical result. No WebGL, ray tracing, continuous mesh precision or physical lighting is claimed. Mesh colors encode function height, not a separate dataset. Tests cover camera invariance, linked traces, retained node identity, focus exit and direct manipulation; representative desktop and 390px mobile browser checks cover the product and surface controls.
