# Salinity dye tank, model register v2

**Scope:** A browser-resident two-dimensional, closed 0.24 × 0.18 m tank at fixed temperature. A dyed patch replaces water locally, with no initial momentum. It illustrates buoyancy, plume circulation and mixing for the Hidden Rivers lesson. Model/schema version 2; physical equations unchanged. Classification: physical approximation plus an explicitly separate artistic display. It does not use measured ocean currents.

## Implemented contracts

State coordinates are x rightward and y downward, in metres. The staggered MAC grid stores u on vertical faces and v on horizontal faces, in m/s. Salinity S is cell-centred in g/kg; pigment fractions are dimensionless. Time is seconds. Pressure projection uses velocity potential φ in m²/s; the perturbation pressure divided by reference density is φ/Δt, in m²/s². The column's hydrostatic component is removed analytically by subtracting each row's mean salinity from buoyancy.

| State | Class | Domain and invariant |
| --- | --- | --- |
| u, v | Intensive velocity fields | Finite; normal velocity exactly zero on all four walls |
| S | Intensive concentration | Initial and drop values 0–40 g/kg; source-free integral ∑S Δx Δy conserved |
| Dye, coral fraction | Intensive tracers | Nonnegative up to numerical tolerance; source-free integrals conserved |
| Integral of concentration × area | Extensive 2D tracer store | In g/kg·m² for salt; m² for pigment. These are not kilograms of salt |
| Drop | External control | x,y inside tank; radius 2–25 mm; click or drag applies discrete mixing/replacement events recorded in the integral ledger; dragging does not inject momentum |
| Rendering | Artistic display | Gold for saltier or matching additions, coral for fresher additions; nonlinear optical mapping. No feedback into physics |

Boussinesq momentum is ∂u/∂t + u·∇u = −∇(p/ρ₀) + ν∇²u + gβ(S − reference) e_y, with ∇·u = 0. Salinity and passive dye satisfy ∂q/∂t + ∇·(u q) = κ∇²q. Reference β = 0.00076 (g/kg)⁻¹ is a constant linear approximation near 10 °C and surface pressure, with density changes treated only in buoyancy. This rounds a seawater-scale haline coefficient; it is not a TEOS-10 evaluation at every cell. ν = 10⁻⁶ m²/s; κ = 2 × 10⁻⁷ m²/s is an effective smoothing diffusivity, substantially larger than molecular salt diffusivity. Semi-Lagrangian momentum transport also dissipates unresolved motion.

Cadence/order: deterministic input events, midpoint semi-Lagrangian momentum transport plus explicit viscosity, buoyancy, pressure projection, then conservative scalar transport. User-facing steps are 0.01 s; adaptive subdivisions enforce conservative Courant and diffusion bounds. Scalars use minmod MUSCL face reconstruction and SSP-RK2, applying each interior face transfer once and equally/oppositely to its two neighbours. All boundaries have zero scalar flux and free-slip impermeable velocity conditions. The top is a rigid lid; no air-water surface is solved.

Projection diagonalizes the cell-centred closed-wall negative Laplacian with separable DCT-II/III transforms on power-of-two grids. Eigenvalues are 4 sin²(π i / 2Nₓ) / Δx² + 4 sin²(π j / 2Nᵧ) / Δy². The zero mode is removed; the computed residual is checked against the original discrete operator. The browser uses 256 × 128 cells (0.9375 × 1.40625 mm), 2.67 times the previous cell count. Other verification grids retain the Jacobi-preconditioned conjugate-gradient reference solver with a target divergence RMS of 10⁻⁸ s⁻¹ and 400 iteration cap. Both solvers stop with an error above 10⁻⁶ s⁻¹. Float64 is canonical; transferred Float32 snapshots are display-only. No random forcing, vortex confinement, dye fade, imposed spiral, fixed sinking trajectory, or unrecorded momentum injection is used. Inputs and fixed steps determine replay; wall-clock pacing only decides how many fixed steps to request.

Sanity checks: every momentum term is m/s²; βΔS is dimensionless and positive for saltier water; y-down acceleration therefore sinks dense water. κ∇²q has concentration/s units. Uniform salinity and a matching-salinity drop give zero velocity. Horizontally uniform stable stratification remains hydrostatic. In zero flow, symmetric diffusion leaves a centred drop's centroid unchanged. Normal walls prevent net fluid or tracer exchange. Conservative scalar integrals are checked against the explicit replacement ledger, not against their values before dye addition.

## Explicit non-claims

A qualitative 2D Boussinesq illustration, not a laboratory-calibrated prediction, direct numerical simulation of turbulence, three-dimensional vortex-ring calculation, free-surface drop impact, molecular mixing calculation, or model of any particular ocean overflow. The 0–40 g/kg control range demonstrates direction; accuracy of a constant equation of state across that entire range is not claimed. Screen interpolation does not create physical resolution. Animation runs at the display refresh cadence independently of worker messages. The renderer blends resolved scalar snapshots continuously; nonnegative cubic B-spline sampling smooths spatial contours without overshoot. Float-texture filtering is checked, with manual bilinear and Canvas fallbacks. The pigment palette, absorption curve, vignette and light falloff are artistic, not measured optics. Paused and invisible tanks stop continuous rendering and advancement. Slower devices may advance fewer physical seconds per wall-clock second; the clock shows simulated time. The separate TEOS-10 calculator uses Practical Salinity and its documented reference location; the tank uses approximate Absolute Salinity in g/kg.

## Failure behavior

Reject nonfinite/out-of-domain inputs before mutation. Freeze the browser tank and display an actionable reset message on non-convergence, a substep below 10⁻⁶ s, or worker failure; do not substitute decorative animation. Pausing, hiding the tab, and leaving the Prints tab stop advancement. Reset reconstructs the initial water field and its ledger. Resolution changes require a reset; no aggregation or invented detail is transferred.

## Verification entry points

`node --test tests/unit/dye-tank.test.mjs` covers buoyancy direction, both rotation signs, pressure divergence, scalar conservation/bounds, hydrostatic equilibrium, neutral drops, deterministic replay and invalid input atomicity. Preregistered moment checks: same centred 9 mm drop, 30 g/kg water/36 g/kg drop, 1.2 simulated seconds; grid sizes 48×36, 72×54, 96×72 and timesteps 0.01/0.005 s. Accepted centroid differences: coarse vs fine <3 mm, medium vs fine <2 mm, timestep halving <1 mm. This verifies global moments at this time, not convergence of fine vortex morphology. Results are saved in `dye-tank-verification.json` alongside long-run extremes and divergence/mass residuals.

`node scripts/hidden-rivers/verify-dye-tank.mjs` reproduces quantitative evidence. Spectral/reference agreement is tested on arbitrary closed-wall velocity fields, including an idempotence check. New-grid checks compare global moments against a finer 256 × 256 grid and halve the timestep, accepting centroid differences below 2 mm and 1 mm respectively. Long-run default and extreme salinities are also sampled at browser resolution. These checks do not establish convergence of fine vortex morphology.

Browser release checks exercise salinity presets, click/drop interaction, pause, visible evolution, zero-text presentation and the legacy density anchor. Independent experimental and out-of-sample validation have not been performed.

Sources: [FFTW cosine transform conventions](https://www.fftw.org/fftw3_doc/Real-even_002fodd-DFTs-_0028cosine_002fsine-transforms_0029.html), [TEOS-10 haline contraction coefficient](https://teos-10.org/pubs/gsw/html/gsw_beta.html), [Bridson's fluid simulation notes](https://www.cs.ubc.ca/~rbridson/fluidsimulation/fluids_notes.pdf). Numerical choices and the stated validation domain are this implementation's responsibility.
