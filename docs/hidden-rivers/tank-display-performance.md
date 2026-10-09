# Fluid display performance contract

The v6 Boussinesq equations, symmetric scalar coupling, Float64 canonical fields, CFL bounds, physical grid and diagnostic scales remain unchanged. This extension changes execution and presentation only. The matching kernel contract registers equivalent Float64 pressure bookkeeping and extrema scans.

Display interpolation will consume a bounded queue of immutable, completed worker snapshots. Each displayed field lies between two computed endpoints; no extrapolation, decorative velocity, simulation step skipping or change to physical time is permitted. New arrivals must not retarget an unfinished segment. The wall-time duration follows measured delivery pace without the old 500 ms ceiling. Pause freezes interpolation; reset and paused injection discard prior display frames; field diagnostics refresh the current view without modifying physics. At most three future snapshots are retained. Under excess backlog, retain the newest future endpoints, preserving the current segment and monotone display time.

The renderer will reuse endpoint textures and upload only newly encountered snapshots. It must not copy or mutate transferred scalar/curl arrays. Normal consecutive segments require one new volume and curl upload instead of four full texture uploads. Canvas fallback reads the same immutable endpoints. Preregistered tests require exact endpoint preservation, continuous progress on irregular arrivals, no premature plateau for a 900 ms delivery period, pause/resume, bounded queue and reset, plus texture reuse and source-array immutability.

The drawing budget follows measured animation-frame cadence, including 120 Hz and faster screens. Drawing resolution may adapt; physical resolution never does. A 60 Hz browser cannot display 120 distinct frames. GPU timing, where available, guides drawing resolution independently of physics pace. Reset discards stale timing and restores full drawing detail. Regression checks cover 60, 120, 144, 165 and 240 Hz budgets. For vorticity-only rendering, avoid fetching unused salinity/pigment textures. Display cadence and simulation seconds per wall second must be measured separately, including Retina-size fine-grid vorticity and the strong-contrast setup. Browser gates preserve physical state across view changes, layers, mobile, fallback, injection and text-free presentation. Report measured hardware and screen/browser limits; do not promise universal 120 fps.

## Measured comparison

An Apple M5 Max (32 GPU cores), headless Chromium with Metal, 1440 × 1000 viewport and device pixel ratio 2 rendered the 64³ vorticity volume at 1400 × 1050 drawing pixels. Ambient salinity was 6 g/kg, drop salinity 36 g/kg, radius 22 mm, and requested pace 2×. Each eight-second sample started after physical time reached 1.5 s. The baseline was public commit `d17c18e9`; the updated sample used this extension.

| Measurement | Baseline | Updated |
| --- | ---: | ---: |
| Draws per wall second | 60.125 | 60.0 |
| Frames with unchanged interpolation phase | 61.7% | 0% |
| 95th-percentile animation-frame interval | 16.8 ms | 16.7 ms |
| Main-thread tasks exceeding 50 ms | 0 | 0 |
| Physical seconds per wall second | 0.025 | 0.035 |
| Updated GPU drawing time, moving average | unmeasured | 4.64 ms |

The fixed phase metric observes the shader uniform on consecutive animation callbacks. It distinguishes repeated drawings of an endpoint from progress through a computed segment; it does not measure physical mixing accuracy. The large improvement is continuous display interpolation. The physical calculation remains substantially slower than real time in this strong-contrast fine-grid setup. The samples do not establish a general 40% solver speedup: isolated default-salinity whole-step timing was effectively unchanged, despite faster pressure bookkeeping and extrema scans.

Reproduce using the existing `benchmark-dye-tank.mjs` with `HIDDEN_RIVERS_TANK_STANDALONE=1`, `HIDDEN_RIVERS_GPU=metal`, `HIDDEN_RIVERS_DPR=2`, `HIDDEN_RIVERS_TANK_QUALITY=fine`, `HIDDEN_RIVERS_TANK_WATER=6`, `HIDDEN_RIVERS_TANK_PACE=2`, `HIDDEN_RIVERS_TANK_START=1.5` and `HIDDEN_RIVERS_TANK_INTERVAL=8`. Set the base URL and Playwright module for the test environment. Hardware, background workload and browser behavior affect timing.

The native test browser supplied 60 Hz callbacks, so actual 120 Hz screen presentation was not measured. Budget tests cover 60, 120, 144, 165 and 240 Hz. A separate test-only timer requested 120 callbacks/s and achieved approximately 112 draws/s with continuous interpolation and no long main-thread tasks; timer scheduling overhead makes that neither a native-refresh measurement nor a claim of 120 fps. The application imposes no 60 or 120 fps drawing cap.
