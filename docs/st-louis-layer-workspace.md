# St. Louis layers and building models

## User paths

- **Layers** in the main navigation, or the property workspace's **Layers** button: independently toggle evidence sources, inspect their coverage, adjust opacity, browse loaded features, and open original records. Utilities & works and Development are replace-selection presets. Selection survives movement between tools and renderer replacement, but is not saved across page reloads.
- **Layers → Open building model**, or **Properties → Tools → Building model**: open an uncompressed IFC locally, or try the explicitly invented pavilion. Select elements and property sets, isolate categories, rotate, zoom, and close the model. Files are not uploaded or automatically placed on parcels.

## Connected infrastructure snapshot: September 13, 2026

| Source | Records | Geometry and coverage |
|---|---:|---|
| City street-light inventory | 52,573 | City points; 195 spatial tiles. No electrical wiring or operating-condition claim. |
| City capital-improvement profiles | 56 | 22 points, 19 lines, 15 multilines. Selected City projects, not all construction or County projects. |

The existing City water-service material inventory remains available alongside these sources. It is not a water-main map or a water-quality measurement. Permits, zoning records, incentive boundaries, public inventory, and ownership indicators retain their respective source coverage and limitations.

Official sources:

- [Street lights](https://maps8.stlouis-mo.gov/arcgis/rest/services/STREETS/Streets_Permitting/MapServer/2)
- [Capital geometry](https://maps8.stlouis-mo.gov/arcgis/rest/services/Capital_Improvement_Projects/MapServer) and [project profiles](https://www.stlouis-mo.gov/government/departments/public-service/projects/)

`public/st-louis/infrastructure/manifest.json` carries source dates, identities, hashes, geometry counts, coverage and terms references. The collector rechecks source object-ID sets; the sources do not supply an editing epoch, so this is not an atomic attribute snapshot. Unknown activity dates remain unknown. No City utility-network credentials are used. MoDOT bridges remain a disabled source reference.

## Runtime boundaries

The map-layer catalog binds existing evidence adapters and the new infrastructure adapter to a separate overlay channel in both the Three.js and Cesium renderers. Original source identity is preserved. Nearby-parcel navigation passes coordinates, not infrastructure object IDs. Source polygons are available as outlines; source altitude is not used as a pipe depth or engineering elevation.

Infrastructure retrieval is bounded and same-origin, with two tile requests at once, a 32 MB download cache, checksum verification, retry eviction, and cancellation. Broad light views use counts for complete intersecting grid cells; detail views query exact locations. The renderer limits input to 2,000 features and 15,000 coordinates. Whole oversized features are omitted with explicit per-layer display warnings; boundaries are never partially invented or silently truncated. Narrow the view when a display limit is reached.

IFC parsing uses a lazy worker and unmodified web-ifc 0.0.77. Limits include 25 MB input, 128 MB geometry, 6,000 elements, 12,000 geometry parts, two million triangles, and a 45-second deadline. The renderer draws on demand. Leaving during parsing cancels it; closing the model releases geometry and its worker. Local coordinates and property values are not independently validated engineering measurements. Parser license and corresponding source are copied by the build to `/vendor/web-ifc/`.

## Refresh and verification

From this repository:

```sh
timeout 600 uv run --no-project python scripts/st-louis/fetch_property_infrastructure.py
timeout 30 uv run --no-project python scripts/st-louis/test_property_infrastructure.py
npm run check
```

`--cached` rebuilds verified component snapshots without changing their observation dates. `--resume` reuses available components and retrieves missing ones. Failed promotion leaves the prior complete published snapshot in place and records source health separately. This collection is not yet an automated live refresh.

## Expansion boundary

County buried networks, nationwide utility routes, building schematics, and real property-linked IFC models are not connected. Expanding coverage requires source-specific adapters and permission/provenance checks. A building model needs an explicit property association and verified coordinate transform before it can be placed in a geographic scene. Public footprints can support exterior context; they cannot establish interiors, mechanical systems, structural performance, or as-built accuracy.

Browser acceptance covered the Three.js map, combined utility layers, source inspection, mobile controls, and the actual IFC example with element/category/camera interactions. Cesium overlay geometry has automated tests; it has not received equivalent visual acceptance in this release.
