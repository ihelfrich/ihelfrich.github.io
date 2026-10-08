# Ocean-flow vorticity diagnostic contract

## Preregistered quantity

For an eastward velocity component `u` and northward component `v` on a spherical Earth, display only signed vertical relative vorticity of the horizontal flow:

`ζ = [∂v/∂λ − ∂(u cos φ)/∂φ] / [R cos φ]` in `s⁻¹`,

where longitude `λ` and latitude `φ` are in radians inside the derivatives and `R = 6,371,000 m`. Positive means counter-clockwise circulation viewed from above the sea surface; negative means clockwise. This is relative vorticity only. Do not call it absolute vorticity `f + ζ`, potential vorticity, vertical velocity, or a satellite-derived flow estimate.

## Discrete stencil and missing data

Use centered differences at every source-grid node. Compute `∂v/∂λ` from its east/west neighbors and `∂(u cos φ)/∂φ` from north/south neighbors, using the actual `dlon` and `dlat` converted to radians and each neighbor's latitude in the cosine factor. Velocity components are stored in mm/s and must be converted to m/s before differentiation. The cell is valid only when its center and all four cardinal neighbors have valid paired `u,v`; grid edges, sentinel values, non-finite values, and near-pole cells where `|cos φ| < 1e-6` remain missing. There is no one-sided derivative, smoothing, gap fill, or coastline extrapolation. Sampling between nodes requires all four surrounding vorticity nodes to be valid.

The color scale is fixed and symmetric at `±4 × 10⁻⁵ s⁻¹`, with a neutral zero; the legend labels negative and positive values in units of `10⁻⁵ s⁻¹` and reports clipping. This range is registered before inspecting the atlas fields. Both the raster and line colors use the same function. Vorticity remains optional raster shading, independent of the selected diagnostic. Streamline segments with missing vorticity samples are omitted rather than colored with a fabricated value.

## Source meaning

HYCOM values are model-analysis horizontal velocities at the chosen depth and snapshot. HF radar values are observed horizontal surface currents on their released grid and time. NOAA GDP values are monthly drifter-derived climatological horizontal velocities at one nominal 15 m drogue depth. Their derivatives inherit those respective source meanings and sampling limitations; they are not direct local vorticity measurements. Sentinel-2 reflectance is never used to derive velocity or vorticity.

## Analytic acceptance cases

- A zero vector field yields zero at every interior valid point.
- Solid-body rotation `u = Ω R cos φ, v = 0` yields `ζ = 2 Ω sin φ` under grid refinement.
- A northward component increasing eastward yields positive `ζ`; sign and `R cos φ` scaling are checked at the equator.
- Any missing paired velocity at the center or a cardinal stencil neighbor invalidates that derivative. A missing one of the four corners invalidates interpolated samples.

## Primary formula references

- [A finite-volume formulation of symmetric equations on the surface of a sphere used by GISS:IB](https://gmd.copernicus.org/articles/11/4637/2018/), equations 2.21–2.24, gives the upward vertical component of curl and its common spherical form.
- [MITgcm User Manual, spherical coordinate system](https://mitgcm.org/public/r2_manual/sav_docs_20100824_2354/online_documents/node29.html), defines eastward and northward velocity components and the spherical metric factors.
