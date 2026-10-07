# Horizontal deformation in Hidden Rivers

The current fields are HYCOM ESPC-D-V02 model analyses, sampled on fixed depth
surfaces. Agulhas at 0 m uses 41 three-hour snapshots from 29 September 2026 at
00:00 UTC through 4 October at 00:00 UTC. Agulhas at 200 and 1,000 m, Florida /
Bahamas at 200 m, and Denmark Strait / Irminger Sea at 1,000 m retain six daily
snapshots over that same interval. The source service returned a network error
before the remaining higher-cadence component pairs could be downloaded. A
partial component pair is never used. Each bundled layer records its actual
cadence, units, dimensions, dates, and SHA-256 digest in `manifest.json`.

## Instantaneous horizontal gradients

`diagnostics.py` computes the velocity-gradient tensor in local east/north
orthonormal bases on a sphere of radius 6,371,000 m. For eastward and northward
velocity components u and v, longitude lambda, and latitude phi:

```
a = (du/dlambda)/(R cos(phi)) - v tan(phi)/R
b = (du/dphi)/R
c = (dv/dlambda)/(R cos(phi)) + u tan(phi)/R
d = (dv/dphi)/R
```

Relative vertical vorticity is `c-b`, horizontal divergence is `a+d`, strain
magnitude is `sqrt((a-d)^2+(b+c)^2)`, and the Okubo-Weiss diagnostic is strain
squared minus vorticity squared. These derivatives are centered on the input
velocity grid. The center and its four neighbors must be valid. The domain rim
is masked, and no derivative is filled across land or a missing-value cell.
Display arrays retain every second grid point after differentiation.

The rotation/strain balance describes the instantaneous horizontal field.
It does not identify a material eddy boundary, a mixing rate, or vertical motion.

## Forty-eight-hour forward stretching

For each initial position, the integration follows the central trajectory and
four neighbors displaced by plus or minus one quarter of an input grid cell
in longitude or latitude. Classical fourth-order Runge-Kutta uses 900-second
steps, bilinear spatial interpolation, and linear interpolation between actual
input times. Coordinates evolve under `dlambda/dt = u/(R cos(phi))` and
`dphi/dt = v/R`. The perturbation is a numerical finite difference, not a claim
that the velocity product resolves a quarter-grid physical feature.

The derivative F of the 48-hour flow map converts initial east/north separation
into final east/north separation. Its longitude terms use the cosine of the
initial and final latitude; differentiating raw longitude in degrees would give
the wrong distance metric. The largest eigenvalue of `F transpose times F`
gives the forward finite-time Lyapunov exponent:

```
FTLE = log(sqrt(lambda_max(F transpose F))) / 48 hours
```

Stored values are in inverse days. A value of 0.5/day corresponds to a maximum
linearized separation factor of exp(0.5 times 2), about 2.72, over the two-day
window. Negative values indicate contraction even along the least-contracting
horizontal direction over that window; they are retained numerically.

Every trajectory must survive the full 48 hours. If the central trajectory or
any neighbor reaches a missing interpolation stencil or leaves the domain,
the result is masked. There is no reseeding, shorter integration window, or
continuation through land. The four daily starting times are September 29,
September 30, October 1, and October 2 at 00:00 UTC. FTLE arrays do not exist for
later starts because the full future window is unavailable. The viewer must
label the selected diagnostic start and end dates; it must not present an older
window as the currently animated instant.

High FTLE can be produced by shear. Its ridges are useful stretching diagnostics
but are not sufficient evidence of attracting or repelling material barriers.
The depth-fixed trajectories omit vertical velocity and all cross-depth exchange.

## Numerical and sampling sensitivity

`tests/unit/hidden_rivers_diagnostics_test.py` checks the exact planar hyperbolic
flow, rigid rotation on a sphere, latitude-dependent metric contraction, the
analytic matrix singular-value formula against independent SVD, time
interpolation, missing values, and full-window domain exits. The JavaScript tests
check the browser's timestamp interpolation, binary decoding, masks, and valid
FTLE windows.

The generated metadata compares the production 900-second integration step
with 450 seconds, and quarter-cell perturbations with eighth-cell perturbations.
These comparisons use every fourth displayed diagnostic seed across each region
and all four starting dates. Results include the common valid sample count,
mask disagreements, median absolute difference, 95th-percentile absolute
difference, and maximum absolute difference, in inverse days.

At the Agulhas surface, a separate comparison uses all 41 three-hour snapshots
versus every eighth snapshot of those same source arrays. Grid, seeds, time
windows, and numerical settings are held fixed. This measures sensitivity to
temporal sampling. Neither this comparison nor a small numerical timestep error
constitutes observational validation or a calibrated forecast uncertainty.

The horizontal input sampling is approximately 0.16 degrees longitude by
0.08 degrees latitude. The three-hour source coordinate vectors contain small
rounding differences. Their uniform-grid fit uses the endpoint spacing and
records the largest residual (under 0.0001 degree for the imported surface pair),
avoiding accumulation of the first cell's rounding error across the entire
region. The packed velocity resolution is 0.001 m/s.

Color domains are shared across regions, depths, and dates. Signed diagnostics
use a symmetric 98th-percentile absolute bound. Strain and FTLE use the 98th
percentile for their upper display bound; FTLE's lower bound is the smaller of
zero and its second percentile. Out-of-range colors are clipped; numerical
arrays and point values remain unclipped. NaNs must be transparent, not zero.

## Primary sources

- HYCOM ESPC-D-V02 product, source variables, and published resolution:
  https://www.hycom.org/dataserver/espc-d-v02/global-analysis
- Haller (2015), *Lagrangian Coherent Structures*, Annual Review of Fluid
  Mechanics, 47, 137–162: https://doi.org/10.1146/annurev-fluid-010313-141322
- Peacock and Haller (2013), *Lagrangian coherent structures: The hidden skeleton
  of fluid flows*: https://georgehaller.com/reprints/PhysToday.pdf
- NCAS cf-python spherical relative-vorticity formula:
  https://ncas-cms.github.io/cf-python/function/cf.relative_vorticity.html
- MITgcm's circulation-based relative-vorticity discretization:
  https://mitgcm.org/public/r2_manual/latest/online_documents/node62.html

Tessera's annual coastal embeddings enter a separate contextual analysis. They
supply no water velocity and do not enter these dynamical calculations.

## Measured sensitivity in this release

Absolute FTLE differences below are in inverse days. The audits include all
four integration windows; n counts only seed/window pairs valid in both runs.

| Layer | n | Median, 900 vs 450 s | 95th percentile, 900 vs 450 s | Median, quarter vs eighth cell | 95th percentile, quarter vs eighth cell |
|---|---:|---:|---:|---:|---:|
| agulhas, 0 m | 1,238 | 4.61979e-06 | 5.7671e-05 | 0.00869539 | 0.0564878 |
| agulhas, 200 m | 1,182 | 2.05017e-06 | 3.95819e-05 | 0.00647595 | 0.0446786 |
| agulhas, 1000 m | 1,152 | 3.25148e-07 | 5.5277e-06 | 0.00684855 | 0.0303189 |
| bahamas, 200 m | 227 | 1.01522e-06 | 1.15402e-05 | 0.00753331 | 0.0397682 |
| denmark, 1000 m | 500 | 4.05531e-08 | 1.26082e-06 | 0.00460116 | 0.0220033 |

For the Agulhas surface, replacing the three-hour input sequence with its daily
subsample changes FTLE by a median absolute **0.113692/day** and a 95th-percentile
absolute **0.427221/day** across 1,231 common valid seed/window pairs. The validity
mask changes at 10 additional seed/window pairs. The production surface FTLE
has a median 0.391497/day across 20,204 valid displayed values. Temporal sampling
therefore has a material influence on this diagnostic in this release. The tiny
RK4 step-size difference is not evidence that the oceanic deformation itself
is known to that precision. Comparisons with deeper daily-sampled layers must
retain that qualification.
