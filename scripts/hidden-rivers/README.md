# Hidden Rivers

An independent project route in the `ihelfrich.github.io` GitHub Pages hub:
https://ihelfrich.github.io/hidden-rivers/

The hub's shared catalogue creates the project record, public index and archive
entry. Its shared navigation creates the header/footer link and search command.
This release does not create a separate GitHub repository.

## Reproduce

Python dependencies: numpy, scipy, pandas, pillow, matplotlib, netCDF4, imageio,
imageio-ffmpeg, geotessera (0.11.0 used here), rasterio, pyproj.

From the repository root:

```sh
mkdir -p ocean_atlas
python scripts/hidden-rivers/download_ocean.py
python scripts/hidden-rivers/depths.py
python scripts/hidden-rivers/tessera_fetch.py
python scripts/hidden-rivers/prepare.py
python scripts/hidden-rivers/animate.py
python scripts/hidden-rivers/export_web.py ocean_atlas
npm ci
npm run build
```

For terrain, use the three region bounds in
`public/hidden-rivers/data/source-requests.json`. Request NOAA ERDDAP `etopo180.nc`
with `altitude[(south):12:(north)][(west):12:(east)]` and save each as
`ocean_atlas/{region}_bathy.nc` before exporting. The web assets also include
fixed Esri contextual imagery with attribution; the fetch routine is provided.

## Data contract

Binary velocity files are little-endian signed int16, ordered as
[component(u,v), time, latitude, longitude]. Multiply by 0.001 for m/s;
-32768 is missing. `manifest.json` supplies dimensions, spacing, dates and depth.
Longitude increases eastward; latitude increases northward.

There are six instantaneous daily analyses from 2026-09-29 through 2026-10-04.
Original requested spatial stride is two. Browser samples are 0.16° longitude
by 0.08° latitude. Inputs are model analyses, not direct velocity observations.

The midpoint integrator uses bilinear spatial and linear temporal interpolation,
with no crossing of cells whose interpolation stencil contains missing values.
Particles stay on a depth plane. Reseeding maintains coverage but is not a mass
conservation calculation. No vertical velocity or transport is estimated.

Tessera is v1.1 dClimate, 2024, a 512 x 512 patch centered at 18.40 E, 34.20 S.
PCA uses a seeded 25,000-pixel fit, unstandardized embedding covariance, and
2nd–98th percentile channel stretches. It is a separate annual coastal context
layer. The PCA fit parameters and original spatial metadata are provided under
public/hidden-rivers/data. Dates differ from the ocean analysis.

Sources and limits are documented in the visible Methods section. Source
provider terms apply to data and imagery; the site's existing license applies
to original code and prose. This release is not a navigation product.

## Validation

`node --test tests/unit/hidden-rivers.test.mjs` checks physical units, temporal
interpolation, mask boundaries and the independent solution for a spatially
constant, linearly changing eastward current. The standard site release gates
check navigation, content, builds, discovery and rendered headline contrast.

## Inspect and share a location

The explorer now supports a north-up map view, a geographic point inspector,
spatially interpolated daily speed profiles, and CSV downloads. Enter signed
longitude and latitude or click the displayed depth plane. With all layers
visible, picking uses the surface plane and samples the same horizontal location
at every available depth. Bearing is the direction **toward** which the current
moves, clockwise from true north. No direction is reported below 0.0005 m/s.

Speed shading samples cell centers; direction arrows are equal length within a
layer, with color encoding speed. These contextual fields refresh approximately
every model hour. Particles continue to use the evolving, interpolated velocity
field. The default common range clips colors above 2 m/s. Regional range uses
all bundled depths and dates, rounded upward to the next 0.25 m/s. Quantitative
point values and CSVs are never color-clipped.

A copied view link preserves region, depth, time, palette, vertical exaggeration,
map/3D choice, shading, color range, and an inspected location. North-up map
view flattens the terrain and displays a single depth, preserving horizontal
alignment. Shared snapshots start paused. It does not preserve an arbitrarily
orbited camera or an individual particle realization. Map-image downloads add
source attribution, model date, depth selection, vertical scale, and color scale.
Motion starts paused for reduced-motion users, and simulation/rendering work
suspends while the map is outside the viewport or the document is hidden.
