# St. Louis spatial study

**Scope:** A bounded downtown OSM snapshot and exploratory walking comparison. This secondary route does not alter homepage graphics or use Unreal Engine. Visual target: an inhabited architectural miniature. Render fidelity is a first browser implementation, not the earlier generated concept's photographic detail.

## Implemented contracts

- **Classification:** OSM source assertions plus calculated descriptive accessibility. Artistic surfaces/lighting/traffic are synthetic presentation, not observed city conditions.
- **Identity and provenance:** OSM object IDs, source snapshot 2026-09-08, source URL, bbox, ODbL and explicit height basis in `public/st-louis/data-manifest.json`. IDs persist between selection, route comparison, share state and export. Multipart rendering IDs remain distinct from destination IDs.
- **Geometry:** WGS84 longitudes/latitudes become local metres using x=(lon+90.193)*111195*cos(38.628 degrees), z=-(lat-38.628)\*111195. x east, y up, z south. 111195 carries metres/degree; angles passed to trigonometry are radians. This local approximation is for district-scale visualization and approximate distances; it is not a survey projection. Source rings simplified at 0.25 m and rounded to 0.01 m. Metric and imperial tagged heights are normalized. Floors times 3.2 m/floor is an estimate; missing heights use declared display defaults. Elevated parts span minHeight to total height.
- **Walking:** Immutable undirected graph of allowed OSM way segments. Edge weight in metres; shortest distance + two point-to-node offsets, divided by 1.3 m/s, gives seconds. Budgets 5–30 minutes are converted to seconds. Absent/disconnected nodes stay unreachable. Negative lengths and nonpositive speed are rejected. Identical snapshot, origins, destination and assumptions produce the same comparison, independently of camera, frame rate, daylight or rendering quality. Increasing a budget cannot reduce its reachable set; scaling lengths and speed together preserves times.
- **Bounds:** Graph nodes/edges share source OSM identity; geometric crossings alone do not create connections. Extent is the saved extract, with complete intersecting ways. Increasing an assumed speed cannot increase travel times. A 100 m nearest-node limit controls POI attachment, but snaps do not verify entrances or legal crossing access.
- **State/replay:** Versioned URL stores both origins, selected destination, budget, light and representation. JSON download contains source metadata and result rows. A different dataset version is explicitly disclosed; old datasets are not automatically archived. Camera position is not part of the analytical record.
- **Animation:** Named seeded pseudo-random material/vegetation/vehicle placement; traffic follows real road polylines at an illustrative speed. Animation time is presentation-only. Pause, reduced motion and document visibility suspend ambient advancement. Light slider is an artistic study, not astronomical solar simulation. Water shading is not hydrodynamics. Authored Arch/courthouse detail is not surveyed geometry.

## Explicit non-claims

No live traffic, forecast, property valuation, zoning-compliance decision, causal effect, employment accessibility, transit routing, complete POI inventory, wheelchair-accessible routing, or calibrated hydrological/ecological model. Conditional access, temporary closures, movement across open pedestrian plazas, and directional pedestrian restrictions are not comprehensively represented. Smooth graphics do not establish data accuracy.

## Failure behavior

Invalid shared state is ignored. Missing destination/snapshot is surfaced. Disconnected destinations have infinite internal travel cost and do not enter counts; JSON exports serialize unreachable times as null. Fetch failures show a retry action that refetches data. WebGL failure leaves normal DOM place/analysis controls usable. A graphics-context interruption is surfaced. Rendering detail can be reduced. Routes near the extract boundary can be truncated and snapshots become stale.

## Verification entry points

- `node --test tests/unit/city-analysis.test.mjs`: known graph path, disconnection, two entrance offsets, exact budget boundary, invalid speed/edges, share-state persistence and malformed state.
- `uv run --no-project --with shapely python -m unittest discover -s scripts/st-louis -p 'test_build.py'`: projection, metric/imperial heights, walking permissions, forbidden barriers, multipolygon ring stitching/hole containment.
- `scripts/st-louis/validate_data.py`: source snapshot validation; run against the saved build directory as documented in README.
- Independent review: actual Citygarden-to-Arch distance was 1,116.678 m. Re-summing rounded coordinate segments and entrance offsets gives 1,116.669 m (9 mm rounding difference). This verifies arithmetic on the graph, not field truth.
- Repository release checks, desktop/mobile browser inspection, layer and lighting controls, keyboard interaction, and restorable route comparison.
