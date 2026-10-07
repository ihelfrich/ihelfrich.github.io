# Hidden Rivers

A project in the `ihelfrich.github.io` GitHub Pages repository, published at
https://ihelfrich.github.io/hidden-rivers/. Shared navigation and catalogue data
connect the atlas to Projects, Lab, search, and the archive. This is not a
separate repository.

## Remote-sensing atlas plates

The committed `remote-atlas` images include Esri World Imagery context, NOAA
Coral Reef Watch 5 km Degree Heating Weeks for 15 March 2024, and a NOAA
CoastWatch SMAP daily surface-salinity field at its native 0.25° grid. The
Lighthouse Reef PCA is calculated from four cloud-screened Sentinel-2 L2A
surface-reflectance bands (B2/B3/B4/B8); centered covariance PCs are displayed
as PC3/PC2/PC1 RGB. Scene ID, cloud mask, and variance shares are recorded in
`remote-atlas/sentinel-pca.json`. PCA colors are a spectral composite, not a
habitat classification. Basemap acquisition dates vary; each quantitative
layer retains its specific date.

The global current film and map use NOAA/AOML's monthly drifter-derived
climatology. Its source observations are surface drifter velocities, with the
drogue centered at 15 m; the data record ends in February 2023. The animated
paths are integrations through monthly mean fields, not the original drifter
tracks. Read this as a seasonal climatology rather than a live current map.

The image cards carry separate, text-free variants for presentation mode. To
rebuild data-backed plates, use `uv run --no-project` with the dependencies
listed in each script's docstring. NOAA ERDDAP and the public Earth Search STAC
catalog are queried at build time; the deployed site serves committed images
and metadata only.

## Build and verify the committed release

Scientific subsets and derived fields are committed under
`public/hidden-rivers`. Building the site requires no ocean-data account or
runtime request to HYCOM, Tessera, or Esri. Use the committed npm lockfile:

```sh
npm ci
python scripts/hidden-rivers/validate-release.py --report /tmp/hidden-rivers-release.json
python -m unittest discover -s tests/unit -p 'hidden_rivers_release_test.py'
npm run build
```

The validator uses only Python's standard library. It checks binary lengths,
dtypes, dimensions, UTC dates, regular velocity cadence, physical units, masks,
maximum speeds, source-component metadata, source hashes, diagnostic coverage,
and complete FTLE horizons. The optional report records SHA-256 hashes.
Deliberately malformed bundles test truncation, irregular timestamps, stale
diagnostics, infinite values, incorrect coverage, and incomplete horizons.

These checks establish internal consistency. They cannot validate the ocean
model against observations or reconstruct source coordinates after packing.
The source importer therefore compares component coordinates and timestamps
while the original NetCDF variables remain available.

## Velocity release contract

`data/manifest.json` supplies the actual timestamps and dimensions of each layer.
Do not infer its cadence from the animation frame rate. The release spans
2026-09-29 00:00 UTC through 2026-10-04 00:00 UTC, five elapsed days. There are
five region/depth combinations: Agulhas at 0, 200, and 1,000 m; Florida/Bahamas
at 200 m; Denmark Strait/Irminger Sea at 1,000 m.

Agulhas surface contains **41 three-hour analyses**. The other six layers
contain **six daily analyses**. The depth-comparison view uses daily subsamples
of the surface series to align input cadence across depths. Its surface paths
can consequently differ from the full three-hour surface animation. Sampling
sensitivity is distinct from a physical difference between depths.

Velocity binaries are little-endian signed int16 in C order
`[component(u,v), time, latitude, longitude]`. The manifest's `shape` gives the
last three dimensions. Multiply by `velocityScale`, currently 0.001, for m/s;
−32768 is missing. Longitude increases eastward and latitude northward.
Requested spatial stride two yields approximately 0.16° longitude × 0.08°
latitude. Inputs are instantaneous model analyses, not direct observations.

The original `source-requests.json` records the daily-input release.
`source-requests-3hour.json` records the higher-cadence retrievals; per-layer
`provenance` selects the relevant source record. An incomplete downloaded pair
is not used in a released velocity layer. Read the committed layer dates and
the release-validation output. The archival daily record contains request URLs
but lacks decoded source component metadata; the validator reports that limit.

Browser trajectories use bilinear spatial interpolation, linear temporal
interpolation, and midpoint integration. Deterministic seeds and fixed
model-time vertices make trail duration independent of rendering frame rate.
Trajectories remain at fixed depth. Particle count, luminosity, and bloom are
display choices, not concentration, probability, or volume transport.
Projection and vertical exaggeration affect display coordinates only.

## Derived physical fields

`diagnostics.py` computes the covariant spherical horizontal velocity gradient,
relative vorticity, strain magnitude, divergence, and Okubo–Weiss values.
Gradient products retain daily output frames. Forward FTLE uses four daily
start dates and a full 48-hour horizon, without extrapolation.

FTLE uses RK4 integration at 900-second steps and central perturbations of
one quarter of a source grid cell. The flow-map Jacobian uses physical
east/north metrics at initial and final positions. Invalid interpolation
stencils and trajectories leaving the domain are masked. FTLE trajectories
are never reseeded or assigned a shortened integration horizon.

`diagnostics.json` records shapes, dates, units, source SHA-256 hashes, valid
coverage, shared display ranges, and sensitivity results. Binaries are
little-endian float32, ordered `[time,latitude,longitude]`, with NaN for missing
values. FTLE is in day⁻¹; vorticity, strain, and divergence in s⁻¹; Okubo–Weiss
in s⁻². Stored values remain unclipped.

The Agulhas surface cadence audit compares three-hour inputs against daily
subsamples of those same inputs. Across 1,231 jointly valid seed/start cases,
the median absolute FTLE difference is 0.1137 day⁻¹ and the 95th percentile is
0.4272 day⁻¹. Halving the integrator step gives a much smaller median difference,
0.00000462 day⁻¹, on 1,238 jointly valid cases. In this experiment, source-time
sampling changes the diagnostic far more than halving the numerical step.
This finding does not establish which estimate is closer to observations.

The audit compares 900 versus 450 second integration and quarter versus eighth
cell perturbations. These checks concern numerical sensitivity within the same
sampled model. They are not forecast confidence intervals. FTLE can be elevated
by shear; a ridge alone does not prove a transport barrier. Okubo–Weiss is a
local strain/rotation diagnostic, not a validated eddy boundary.
Negative FTLE values indicate contraction of the most-stretched local direction
over the finite interval. Fixed-depth horizontal fields need not preserve area.
The shared FTLE display extends from the smaller of zero and its second
percentile to its 98th percentile. Values outside this range are color-clipped;
downloads retain them. Formulas and analytic checks are in [SCIENCE.md](SCIENCE.md).

To regenerate from the exact committed velocity inputs, install NumPy and run:

```sh
python scripts/hidden-rivers/diagnostics.py
python -m unittest discover -s tests/unit -p 'hidden_rivers_diagnostics_test.py'
python scripts/hidden-rivers/validate-release.py --report /tmp/hidden-rivers-release.json
```

Smaller integration steps do not restore variability omitted by source sampling.
No vertical velocity, density calculation, observational validation, or
cross-depth exchange is included. In particular, a 1,000 m horizontal slice
does not reconstruct Denmark Strait overflow descending over a shallower sill.

## Optional source-cadence regeneration

`upgrade_cadence.py` requests 41 three-hour samples over the same five-day
interval. It requires NumPy and netCDF4, and caches the ten component subsets
in the sibling `hycom_3hour` directory. It checks units, dimensions, dates,
depth, paired component grids, packing, and coordinate spacing before export:

```sh
python scripts/hidden-rivers/upgrade_cadence.py
python scripts/hidden-rivers/diagnostics.py
python scripts/hidden-rivers/validate-release.py --report /tmp/hidden-rivers-release.json
```

Only publish after all three commands succeed. A failed or blocked provider
request must not be described as an available higher-cadence layer. Old
diagnostic source hashes intentionally fail validation against changed inputs.
Keep original NetCDF files when archival research requires them.

The current mixed-cadence release was exported with
`python scripts/hidden-rivers/upgrade_cadence.py --cached-only`. That option
imports only complete, validated cached u/v pairs and preserves other existing
layers. It does not download missing components or fabricate higher-cadence data.

Provider reprocessing can change future download bytes. Compare source hashes
and record a new release when they change. Python dependency versions are not
fully locked; the committed public binaries define the exact release, without
a promise of byte-identical downloads from a future provider response.

## Tessera coastal retrieval

The Cape Peninsula footprint is 5.12 km square, near 18.40° E, 34.20° S. It uses
Tessera v1.1 dClimate annual embeddings for 2024. The source grid is 512 × 512 at
10 m. The browser retains every second native pixel without interpolation,
yielding 256 × 256 samples at 20 m center spacing with all 128 components.

Each published vector has signed int8 components and a positive per-pixel
scale. That scale cancels in cosine similarity. `vectors.i8` therefore retains
the original components without PCA compression or additional quantization.
`valid.u8` masks invalid scales and zero vectors. `coordinates.f32` contains
retained pixel centers as WGS84 longitude/latitude pairs. The coastal manifest
records the native transform, sampling convention, hashes, and source links.

An independent check compares 10,000 seeded pixel pairs against dequantized
vectors. This establishes arithmetic agreement, not ecological meaning.
Rebuild with Python 3.12+, `geotessera==0.11.0`, NumPy, pyproj, requests, and Pillow:

```sh
python scripts/hidden-rivers/build_coastal.py --cache /tmp/hidden-rivers-tessera-cache
```

The script requests public Tessera and Esri assets without a paid API key.
Provider availability and package compatibility still matter. Context imagery
may combine acquisition dates.

Cosine is a retrieval score within one model version and year, not a class
probability, habitat label, or current measurement. Neighboring pixels are
spatially dependent. The 2024 embeddings and 2026 ocean model are separate
sources with different temporal support. Google AlphaEarth is not bundled;
the atlas makes no claim of cross-model fusion.

The original PCA image remains reproducible with `tessera_fetch.py` and
`prepare.py`: a seeded 25,000-pixel covariance fit, sign-fixed eigenvectors, and
separate 2nd–98th percentile display stretches. Parameters are in
`data/tessera_pca.npz`. PCA colors are not physical variables or transferable
class labels.

## Record the browser-rendered film

`record_observatory.cjs` captures the actual WebGL application at explicit model
times and camera poses. Its four 12-second chapters show surface motion, local
rotation, a fixed 48-hour stretching window, and daily-aligned depth comparison.
The script writes `film-v3.mp4`, its poster, and WebVTT captions to the public
project directory. The film is 1,920 × 1,080 at 24 fps by default.

Capture requires Playwright, a compatible Chromium executable, and ffmpeg in
addition to website dependencies. Playwright is an optional capture dependency,
not installed by the site's `npm ci`. To prepare it without changing the lockfile:

```sh
npm install --no-save --package-lock=false playwright@1.51.1
npx playwright install chromium
npm run build:fast
node scripts/hidden-rivers/record_observatory.cjs --preview
node scripts/hidden-rivers/record_observatory.cjs
```

Set `CHROMIUM` to the absolute browser executable when using a non-default
installation. The script can also accept `--url` to capture a separately served
build and `--fps` for a different film sampling rate. Preview writes one still
per chapter under a temporary directory. Model times and camera paths are
deterministic; rasterized pixels can differ across GPU, browser, and font
versions. Run the full website build again after recording to include the new
film in the deployable output.

## Bathymetry, imagery, and the original film

ETOPO1 is subsampled to 0.2° for regional terrain, not channel-scale survey
detail. This independent relief and the ocean model's wet mask can disagree
near steep slopes. Esri World Imagery supplies surface context, attributed to
Esri, Maxar, Earthstar Geographics, and the GIS User Community.

The downloadable `Hidden_Rivers_Atlas.mp4` is the original 60-second film
rendered from daily inputs. Its cadence is independent of later interactive
data upgrades. To regenerate that legacy movie, install NumPy, SciPy, Pillow,
Matplotlib, netCDF4, imageio, imageio-ffmpeg, GeoTessera, rasterio, and pyproj.
Run the complete preparation order from the repository root:

```sh
mkdir -p ocean_atlas
python scripts/hidden-rivers/download_ocean.py
python scripts/hidden-rivers/depths.py
python scripts/hidden-rivers/bathy.py
python scripts/hidden-rivers/get_basemaps.py
python scripts/hidden-rivers/tessera_fetch.py
python scripts/hidden-rivers/prepare.py
python scripts/hidden-rivers/animate.py
```

Legacy fetch scripts report individual failures but may exit zero; verify
every requested NetCDF and image before rendering. `animate.py` uses DejaVu
Sans from its standard Linux font path and writes to `ocean_atlas`. It does
not replace public assets automatically. The legacy `export_web.py ocean_atlas`
exports daily data; running it over a higher-cadence release would downgrade
that release and invalidate its derived products.

## Sources

- HYCOM/ESPC-D-V02: https://www.hycom.org/dataserver/espc-d-v02/global-analysis
- NOAA ETOPO1: https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.html
- GeoTessera: https://geotessera.readthedocs.io/en/stable/index.html
- FTLE interpretation and uncertainty: https://os.copernicus.org/articles/21/401/2025/
- Conditions for exponent ridges to identify coherent structures: https://arxiv.org/abs/1307.7888

No ADCP, drifter, Argo, or CTD validation is bundled. No navigation, ecological,
acoustic-propagation, or causal conclusion is established by this animation.
Provider terms apply to source data and imagery; the site's existing license
applies to original code and prose.

## Ocean-first edition, October 2026

The default camera looks into the Agulhas field at 1,000 m. Select surface,
200, 500, 1,000, or 2,000 m, or compare the five layers in the water-column
view. The two new depths use the same HYCOM experiment, date interval and
spatial stride. Each has six daily snapshots, paired component provenance,
strict missing-data masks, and the same numerical diagnostic sensitivity checks.

Depth and submerged NOAA relief are exaggerated 180 times for display. Land
is a flat geographic reference. This is not a reconstructed three-dimensional
velocity field: tracers remain at their chosen depth. The selected speed scale
is shared by every visible layer, printed in the legend, retained in shared
links, and included in map exports. Continuous playback repeats the stated
five-day window; it does not extrapolate the model.

Reproduce the additional layers, with Python managed by uv:

```sh
uv run --no-project --with numpy --with netCDF4 python scripts/hidden-rivers/add_deep_layers.py
uv run --no-project --with numpy python scripts/hidden-rivers/diagnostics.py --data /tmp/hidden-rivers-deep-layers
uv run --no-project --with numpy python scripts/hidden-rivers/publish_deep_layers.py
```

`render_plates.py` creates six independent quantitative maps from the released
arrays. Run using uv with numpy, scipy, matplotlib, cartopy, cmocean and pillow.
Full PNGs are 2,800 × 2,000; lighter WebP previews load lazily in the map room.
Cartopy obtains the public-domain Natural Earth 50 m coastline and land files.
The speed maps use a fixed 0–2 m/s thermal scale; signed vorticity uses a
zero-centered diverging scale. All plates identify dates, units and projections.

### Cesium deployment

The GitHub Actions secret `CESIUM_ION_TOKEN` is supplied to the build as
`PUBLIC_CESIUM_ION_TOKEN`. It is a browser asset-access credential, necessarily
present in the deployed client; it is never committed to source, printed in
logs, inserted in share links, or included in downloads. Use a production ion
token limited to the intended public assets and site URLs. Local development
loads the ignored `.env.local` equivalent. No visitor token entry is needed
when the deployment credential is present. Optional private-browser connection
fallback remains available if an operator builds without a deployment token.
The 24 landscape destinations do not expand HYCOM or Tessera data coverage.
