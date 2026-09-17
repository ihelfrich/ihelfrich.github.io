# Preliminary parcel geometry and terrain analysis

Contract/model version: `st-louis-site-analysis-v1`. Classification: deterministic measurements of supplied GIS geometry and a descriptive least-squares fit of supplied elevation samples. Neither operation is an empirical property valuation or an engineering design model.

**Scope:** One selected parcel account, bounded source geometry and at most 25 requested terrain observations. No city-wide mesh processing or legal entitlement calculation.

The UI also supports selected address/map points without connected parcel geometry. This mode requests one elevation and FEMA evidence at that location, reports no parcel dimensions or fitted grade, and exports `preliminary-point-evidence` with null geometry and plane analysis. It does not run `measureSite`, `prepareTerrainPoints` or `fitTerrainPlane` on a fabricated polygon.

## Implemented contracts

`measureSite(parcel)` and `prepareTerrainPoints(parcel, {maxPoints: 25})` consume one GeoJSON Feature containing WGS84 two-dimensional Polygon or MultiPolygon coordinates. They preserve the selected source account's `recordKey`, `parcelKey`, `parcelId`, `handle` and source object ID. The source account's `areaSqFt` is reported independently; it is never summed over shared accounts or substituted for polygon area. Source record identity remains a dated GIS account identity, not proof of a legal lot.

Analysis is limited to 16 polygon parts, 64 rings, 4,096 supplied vertices including closing positions, and a bounding-box diagonal of 2,000 metres. Coordinates must be finite and closed, latitude must be between −85° and 85°, and geometry must have nonzero area. Flagged invalid-source geometry, self-intersections, repeated/backtracking edges, holes outside their shell, intersecting/nested holes, touching rings and overlapping filled polygon parts are rejected. Some legally valid geometries with touching boundaries are deliberately unsupported. Geometry is not repaired, simplified or snapped.

The local equirectangular projection is centred on the geometry bounding box. With spherical mean Earth radius 6,371,008.8 m, x = R cos(latitude of origin) × longitude difference in radians; y = R × latitude difference in radians. x is east and y is north. This local spherical approximation is not a survey projection. A metre is converted to feet using exactly 1 / 0.3048, and a square metre to square feet using its square, once. Shoelace area uses outer ring area minus hole area, independently of ring winding. Outer perimeter excludes holes; all-ring perimeter includes their boundaries. Bounding-box extents are not legal frontage or building setbacks. Difference from source area is reported only when the supplied source area is positive; differences can reflect account definitions as well as geometry.

`prepareTerrainPoints` consumes an integer `maxPoints` between 1 and 25. It uses deterministic regular cell-centre grids and only strict polygon-interior points, excluding holes and boundaries. It reports insufficient samples if fewer than six valid points remain, any polygon part is unrepresented, or the coordinates cannot support a two-dimensional plane. It does not invent off-parcel or boundary samples to fill the requested budget.

`fitTerrainPlane(samples)` accepts at most 25 unique WGS84 positions with finite `elevationMetres` or explicit null for no data. Negative elevations are valid. Values must already be converted to metres by a verified source adapter. Null is never zero. Observation source, resolution, acquisition date and vertical datum must be supplied and retained by the source adapter; this pure function cannot establish them.

## Outputs and model equations

Geometry outputs include area in m² and ft²; outer and all-ring perimeter in m and ft; hole/part/vertex counts; east-west and north-south extents in m; the projection origin and conversion constants; independent source area and signed differences; and source account identity. Terrain preparation returns coordinates, counts, projection and an explicit readiness status.

Terrain fitting always reports requested/available counts and availability percentage. With at least one available sample it reports sampled minimum/maximum elevation and relief in metres. It fits a plane only when at least six unique noncollinear samples are valid and at least 80% of requested samples are available. Coordinates are centred in metric space and elevations are centred before solving the two-variable normal equations for z = a x + b y + c. A scale-relative determinant check rejects nearly singular designs. Sample order is canonical longitude/latitude order, independent of caller ordering.

Grade = 100 × sqrt(a² + b²), in percent; plane angle = atan(sqrt(a² + b²)), in degrees. Optional downhill aspect is clockwise degrees from true north, derived from the negative horizontal gradient; it is null for a flat plane. The intercept is elevation at the stated projection origin. RMS residual = sqrt(sum of squared elevation residuals / number of available samples). This is descriptive fit residual, **not DEM accuracy, vertical-datum uncertainty, survey accuracy or a confidence interval**.

## Failure behavior

These pure synchronous APIs perform no network calls, storage writes, random sampling or clock-driven updates. They run only when invoked by the site dossier. Invalid shapes, bounds, unsupported topology, duplicate sample positions, nonfinite arithmetic and domain violations throw named validation errors. Valid but missing, sparse or degenerate terrain data return `insufficient-samples` with null plane metrics. Sample extrema remain available when their observations are valid; missing observations do not imply flat terrain.

Invariants to verify before release: area subtracts holes and sums disjoint parts; perimeter scales with length while area scales with length squared; ring winding and vertex rotation do not change measurements; points lie strictly in filled interiors; no sample exceeds the requested cap; flat and known inclined planes are recovered; slope is invariant to elevation translation and input ordering; missingness thresholds are exact; negative elevations remain signed; insufficient/collinear observations cannot produce slope; malformed, oversized or invalid-source geometry fails explicitly.

## Explicit non-claims

This is a preliminary GIS site evidence tool, not a boundary survey, legal lot-area determination, verified zoning envelope, civil-engineering design, grading plan, drainage or runoff model, flood depth prediction, soil assessment, geotechnical analysis or foundation recommendation. Sampling a plane cannot resolve retaining walls, local depressions, culverts, underground utilities or buildability. Acquisition metadata and source coverage must remain visible alongside results. Source geometry and terrain datasets retain their own limitations. Initial validation is mechanical invariant and fixture testing, not field or survey validation; exact executed checks are recorded in the implementation report.

## Verification entry points

Run `node --test tests/unit/city-site-analysis.test.mjs` for geometry, units, topology, sample coverage, plane recovery, transformations, null propagation and failure invariants. These tests also run in `npm run check:city`. Static review confirms the pure module contains no fetch, storage, clock or random-number dependency. A bounded check of the first 100 source records in retained City parcel tile `-9020_3862` measured all 100 successfully; 97 produced a dispersed six-or-more-point grid, while three reported insufficient samples. This checks compatibility with retained source records; it does not validate accuracy against field measurements.
