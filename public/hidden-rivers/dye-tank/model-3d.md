Current delivery is version 6, with symmetric scalar–momentum coupling; see [the coupling extension](model-coupling.md) and the smooth-field temporal-convergence checks in the reference results. The browser schedules 0.02 s requests with the stability substeps below; optional GPU momentum uses Float32 while pressure, density and scalar transfers remain Float64. See [the GPU extension](model-gpu.md) and [its comparisons](verification-gpu.json). The original version-4 register below records the Float64 equations and preregistered reference fixtures, which remain in use.

# Three-dimensional salinity tank, model register v4

## Scope and state

Physical approximation: a closed, browser-resident 0.24 × 0.18 × 0.18 m water tank at 10 °C, with standard-composition Absolute Salinity 0–40 g/kg. This is a genuine three-dimensional incompressible Boussinesq calculation. It is not calibrated to laboratory observations and is not a model of measured ocean currents.

Coordinates x, y, z are rightward, downward and front-to-back, in metres. The staggered MAC grid stores intensive u, v, w in m/s on their respective faces. Intensive salinity S (g/kg) and dimensionless gold/coral tracer fractions are cell-centred. Total dye is derived as gold + coral. Concentration-volume integrals, ∑q Δx Δy Δz, are conserved extensive ledgers; they are not kilograms of salt. Time is seconds; pressure potential φ has m²/s units.

The incremental pressure estimate p/ρ₀ has m²/s² units. Its half-kick, −(Δt/2)∇(p/ρ₀), has m/s units, and adding φ/Δt to the estimate is dimensionally consistent.

## Process contracts

Momentum satisfies ∂u/∂t + u·∇u = −∇(p/ρ₀) + ν∇²u + g(ρ(S) − horizontal mean ρ(y))/ρ₀ e_y; ∇·u = 0. Density uses the existing GSW 3.6.23 TEOS-10 rho_t_exact lookup at 10 °C and sea pressure 0 dbar. Reference density is ρ(30 g/kg) = 1022.943497 kg/m³. Gravity is 9.81 m/s²; ν = 1.35 × 10⁻⁶ m²/s is a rounded water-scale constant near 10 °C. Salt/dye diffusivity is 1.5 × 10⁻⁹ m²/s. Numerical transport diffusion is additional and grid-dependent; molecular mixing is not resolved.

Cadence/order: fixed 0.01 s requests with Courant, buoyancy and diffusion substeps; pressure and buoyancy half-kicks around frozen-velocity, midpoint-traced, limited MacCormack momentum advection; explicit viscosity; buoyancy from density anomalies relative to each horizontal x-z plane; incremental exact discrete pressure projection; conservative Koren-limited MUSCL/SSP-RK3 salt and pigment fluxes. Pressure acceleration is initialized by a half-step predictor and updated by the projection correction. Every interior face scalar transfer is committed once with opposite signs to its neighbouring cells. Both pigments are transported independently; total dye is their sum. No random force, vorticity confinement, prescribed spiral, artificial sinking path or dye fade is permitted. Display interpolation and camera motion cannot alter canonical state.

All six boundaries have zero normal velocity and scalar flux. Tangential viscous ghosts enforce no-slip at glass sides/bottom; the rigid top has zero tangential shear. Projection uses separable DCT-II/III on power-of-two dimensions and the exact closed-wall Laplacian eigenvalues, including the z term. The zero pressure mode is removed. Projection must stop with an error if divergence RMS exceeds 10⁻⁶ s⁻¹. Canonical fields are Float64; GPU textures and transferred snapshots are presentation-only.

Controls specify two to four horizontal layers, increasing interface depths in metres, salinity and interface transition thickness. Piecewise salinity steps are smoothed with specified tanh transitions. A drop is a spherical, compact mixing/replacement patch with no injected momentum; its salt and pigment changes enter the ledger. Invalid controls must be rejected before mutation. A reset rebuilds the field and ledger; changing resolution does not manufacture subgrid detail. A nonfinite state, non-convergent pressure solve or substep below 10⁻⁶ s stops the calculation visibly. Pause/hidden-tab state suspends advancement without idle-time catch-up. Inputs and fixed timesteps replay deterministically; wall-clock time only schedules steps.

## Preregistered numerical verification

Before implementation: a 16³/32³ closed-wall projection fixture must leave RMS divergence below 10⁻⁸ s⁻¹ and be idempotent within 10⁻¹⁰ m/s. Stable layered water without a drop and matching-salinity dye must stay at rest (speed <10⁻¹² m/s). A spherical 14 mm drop in a 0.24 m cube must sink/rise with density contrast, generate nonzero w, preserve x-z interchange symmetry, keep salinity within the initial range to 10⁻⁶ g/kg and conserve salt/pigment volume integrals within 10⁻¹². Invalid layer ordering or nonfinite inputs must leave existing fields unchanged. Fixed inputs must replay exactly.

The same 14 mm, 36 g/kg drop in 30 g/kg water, at x=z=0.12 m, y=0.045 m, is compared after 0.3 s on 32³, 64×32×32 and 64³ grids. Global dye-centroid differences must be below 7 mm; halving the 0.01 s timestep on 32³ must change the centroid by less than 1 mm. An extruded free-slip Taylor-Green analytic vortex checks viscosity/transport against exp(−4νk²t), with energy error below 1% on 32³ after 0.3 s and smaller error on 64×64×32. This verifies selected global quantities and an analytic limit, not convergence of fine 3D vortex morphology or an entrainment rate.

## Dimensional and limiting checks

Each momentum term has m/s² units; the density ratio is dimensionless. Positive density anomaly accelerates downwards. Diffusivity times ∇²q has q/s units. Uniform salinity gives zero buoyancy. Horizontally uniform stratification is hydrostatic even when interfaces are sharp. No-flux walls prevent net salt/dye exchange. Drop replacement is the only source in the concentration ledger. Inverted layers are unstable but a perfectly symmetric resting state requires a disturbance to develop convection; no artificial perturbation is hidden in the solver.

Development check: the initial nonincremental pressure split passed the 1% energy bound but missed the preregistered refinement trend (relative errors 2.5361 × 10⁻⁵ and 2.5614 × 10⁻⁵). Before changing the solver, pressure half-kicks and an incremental pressure correction were selected to address the temporal splitting error. The same analytic criteria are retained.

## Display and non-claims

GPU ray marching renders the resolved three-dimensional pigment/salinity volume, with orbit, zoom, an injection plane and an optional cutaway. Light scattering, glass, color and opacity are artistic display choices. Rendering does not simulate measured optics or add physical resolution. No free-surface deformation, drop impact, surface tension, full variable-density inertia, temperature evolution, turbulent closure, DNS, laboratory calibration or predictive ocean-overflow claim is made. Without WebGL2, the same 3D state is rendered as projected volume samples; without WebAssembly, the same equations run in JavaScript. Browser performance and simulated/wall-clock timing must be measured separately.

Sources: [TEOS-10 density](https://www.teos-10.org/pubs/gsw/html/gsw_rho_t_exact.html), [Bridson fluid notes](https://www.cs.ubc.ca/~rbridson/fluidsimulation/fluids_notes.pdf), [Selle et al. MacCormack transport](https://physbam.stanford.edu/papers/stanford2006-09.pdf), [MIT seawater properties](https://web.mit.edu/seawater/), [FFTW DCT conventions](https://www.fftw.org/fftw3_doc/Real-even_002fodd-DFTs-_0028cosine_002fsine-transforms_0029.html).
