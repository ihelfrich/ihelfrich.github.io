# St. Louis data and reality pipeline

The secondary `/st-louis` route keeps open source geometry, optional captured imagery, observed weather and user-entered property scenarios distinguishable. `docs/st-louis-model-register.md` defines units, assumptions, missing-data behavior and non-claims. Official City parcel, zoning and public available-inventory snapshots have their own source and refresh contracts below; OSM footprints and authored facade detail do not replace them.

## Local photographic connection

`npm run dev` copies the pinned Cesium static runtime and prebundles its lazy module. Open Explore → Photographic city and enter an authorized browser token in the masked field. Enable Google Photorealistic 3D Tiles in the ion account, grant `assets:read` and the selected asset, and include the exact preview origin when using allowed-URL restrictions. A custom asset must be a georeferenced, ready, textured 3D Tiles capture; its reset view uses the asset bounds.

The token is memory-only. The page preserves only a fixed connection stage and numeric HTTP status across reloads. A module-stage failure happens before token validation. If a dependency upgrade leaves `504 Outdated Optimize Dep`, stop the dev server, clear its generated `node_modules/.vite` cache, restart and reload before retrying. Do not diagnose this as an invalid token. Never copy raw provider errors, tokenized network URLs or credentials into logs or reports.

## Saved OSM inputs and reproducible builds

Downtown `public/st-louis/city.json` preserves the 2026-09-08T21:30:28Z snapshot and walking graph. Its `data-manifest.json` contains bbox, source identity, counts, exclusions and attribution. A retained `source.osm` plus `source-manifest.json` reproduces this extract. The original task cache was `work/stl-data-build`, outside the checkout.

```sh
uv run --no-project --with shapely python scripts/st-louis/build_city.py --data-dir /path/to/downtown-snapshot
uv run --no-project --with shapely python scripts/st-louis/validate_data.py --data-dir /path/to/downtown-snapshot
```

The builder writes into that snapshot directory. Review its output and manifest before replacing the shipped files. The retained Overpass query is an acquisition recipe, not a way to recreate historical data from today's source.

The county/city region uses the [Geofabrik Missouri extract](https://download.geofabrik.de/north-america/us/missouri.html), snapshot 2026-09-07T20:21:20Z. `build_region.py` uses pyosmium and Shapely, retains county and independent-city boundaries separately, preserves height provenance, and writes unique centroid-owned 2,000m tiles plus a compact overview. The original source/cache was `work/city-upgrade/county-data`, outside the checkout.

```sh
# Use an existing cached source; nothing is downloaded by default.
uv run --no-project --with osmium --with shapely python scripts/st-louis/build_region.py --data-dir /path/to/county-cache --output public/st-louis/region

# First acquisition only: add --download if the PBF is absent.
# This retrieves the current Missouri extract, so it produces a new source snapshot.
uv run --no-project --with osmium --with shapely python scripts/st-louis/build_region.py --data-dir /path/to/county-cache --output public/st-louis/region --download

# Validate the saved outputs without downloading or extracting the source again.
uv run --no-project --with osmium --with shapely python scripts/st-louis/build_region.py --output public/st-louis/region --validate
```

Wrap long executions in an explicit shell deadline appropriate to the operation, such as `timeout 600 ...`; a 30-second download deadline may be too short for the statewide source. Do not repeatedly fetch the source to recover metadata already retained in the manifest. Preserve its SHA-256, acquisition time, OSM snapshot time, exclusions and [ODbL attribution](https://www.openstreetmap.org/copyright).

Saved region totals: 450 cells (427 nonempty), 104,941 building records, 196,316 roads, 24,448 green areas and 1,553 waters. Tiles total 83,240,779 bytes; largest is 1,571,878 bytes. The 2,802,568-byte overview is about 592,690 bytes gzipped. Serve with HTTP compression. Do not load all detailed cells at once: the current client caps detail selection at 16 tiles and three concurrent requests, and retains an overview fallback. These are geographic coverage and payload statistics, not building completeness or a performance benchmark.

## Materials, streets and observations

`public/st-louis/materials/manifest.json` contains four original Poly Haven CC0 PBR sets with source URLs, authors, meter scales and verified hashes. The 12 maps total 8,835,051 bytes. Preserve color-space distinctions and meter UVs. Authored window/trim/emission atlases are layouts over material samples, not site-specific photographic facades.

`street-details.json` retains actual crossing, bench and street-lamp nodes from the downtown XML, plus useful road tags. Preserve OSM IDs and source timestamp. Furniture geometry and unmeasured orientations remain artistic. Positive marking tags, not an assumed crosswalk at every intersection, control paint. Detail meshes must stay inside roof footprints and outside holes, and obey their triangle/draw-call budget.

Weather is a runtime observation from [KCPS](https://api.weather.gov/stations/KCPS/observations/latest), obtained through the [NWS public API](https://www.weather.gov/documentation/services-web-api). Keep station, observed time, fetch time and stale/unknown fields visible. The [NOAA solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF) describe a separate geometric sun model. Neither source measures street-level wind, wetness, traffic or photographic illumination.

## Official City parcel, zoning and available-inventory snapshots

The implemented fetchers prepare static same-origin data. Verified City source requests returned no browser CORS headers; these builds require no backend. The [City open-data terms](https://dynamic.stlouis-mo.gov/opendata/terms.cfm) cover raw and derived use, retain accuracy/completeness limitations and require preserving source context. They are a custom policy, not a CC0 license. These commands and local data checks do not establish GUI integration or deployment.

| Bundle | Prepared source snapshot | Files and loader |
| --- | --- | --- |
| Official parcels | 134,347 source records, 126,850 HANDLEs, 582 shared-HANDLE groups; retrieval began 2026-09-08T23:48:09.834228Z | `public/st-louis/parcels/manifest.json`, 202 geometry tiles, lazy address index; `city-parcels.mjs` |
| City zoning | 126,945 base HANDLE assignments, 921 split-zone polygons, 15 overlays; retrieved 2026-09-08T23:53:57.373Z | `public/st-louis/zoning/{manifest.json,base.json,multi.geojson,overlays.geojson}`; `city-zoning.mjs` |
| LRA available inventory | 8,571 source records, 8,569 HANDLEs; retrieved 2026-09-08T23:49:58.999978Z; all asking prices unknown | `public/st-louis/public-listings/latest.json`; `city-public-listings.mjs` |

Parcel geometry comes from [PDA/PARCELS_PUBLIC layer 0](https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0); exact City coverage comes from [Assessor_Public_Parcels layer 15](https://maps8.stlouis-mo.gov/arcgis/rest/services/ASSESSOR/Assessor_Public_Parcels/MapServer/15). `parcelKey = st-louis-city:` + HANDLE is nonunique. Preserve `recordKey` (HANDLE + ParcelId + OBJECTID) to select an exact snapshot row, because even HANDLE + ParcelId can repeat. OBJECTID may change on refresh. `lookupParcel` retains all overlapping candidates; `searchParcels` returns complete record identity and an interior query point. Do not collapse condo/account records into an invented unique property. Geometry is not simplified or silently repaired; invalid exact matches remain unavailable.

City zoning follows the [official map](https://www.stlouis-mo.gov/government/departments/public-safety/building/zoning/zoning-map.cfm): base layer3 joins by HANDLE, while layer2 split zones and layer0 overlays retain their own polygons. Call `lookupZoning(point,{parcelResult,signal})` after parcel lookup, passing the selected record/candidates. A canceled selection cannot cancel the shared immutable City snapshot download for another selection. Unknown raw codes remain unknown; split zones resolve from intersected source geometry. Keep [Title 26](https://library.municode.com/mo/st._louis/codes/code_of_ordinances?nodeId=TIT26ZO), [overlay/amendment links](https://www.stlouis-mo.gov/government/departments/planning/planning/zoning-overlay-districts.cfm) and source dates in results. No uses, density, setbacks or permitted development are computed from district names.

The [LRA catalog](https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=30) and [SLDC source layer](https://maps8.stlouis-mo.gov/arcgis/rest/services/SLDC/SLDC_Real_Estate/MapServer/0) distinguish the full inventory from available properties. The build requires `LRA='YES' AND Case_Status='Available' AND Status='Available'`. Listing identity uses official ParcelId (`lra:st-louis-city:` + ParcelId), retaining HANDLE as the possibly shared parcel join. Optioned, leased and unavailable records are excluded. Preserve `askingPrice:null`, `priceStatus:'not-published'` and `sourceUpdatedAt:null`; never substitute assessment, recorded sale price, pricing formulas or zero. The derived polygon centroid is not a guaranteed entrance or interior point. `loadPublicListings({signal})` checks retrieval age; stale means over 48 hours since retrieval, not a known age for each source row.

The City parcel catalog date (2026-08-27), each source's retrieval timestamp, parcel `LastDate`, overlay `UpDated` and legal effective date are separate clocks. Assessment year is unknown. Base zoning data dates and legal effective dates remain unknown; later ordinances can amend a GIS record's ordinance reference. A successful refresh does not prove current availability or legal currency.

County coverage remains limited. No current County parcel or zoning snapshot is included. The official current services returned HTTP403, while other accessible datasets did not establish both current coverage and redistribution rights. A bounded CORS-enabled [hosted jurisdiction query](https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/AGS_Jurisdictions/FeatureServer/10) provides positive evidence dated 2024-11-18T15:29:35.503Z; later boundary changes are unverified. Every incorporated municipality's zoning is unsupported; positively unincorporated County zoning is unavailable. Empty or failed jurisdiction responses stay unknown. County rules never substitute for municipal rules, and OSM regional coverage does not fill these gaps.

## Refresh the official snapshots

Run from the repository root with a fresh dated cache. Retain that cache for source audit and exact resumption; do not reuse an old cache when requesting a new parcel snapshot. These operations prepare local files and do not publish them.

```sh
SNAPSHOT_CACHE="work/st-louis-refresh/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$SNAPSHOT_CACHE"
timeout 600 uv run --no-project --with shapely python scripts/st-louis/fetch_parcels.py --cache "$SNAPSHOT_CACHE/parcels" --output public/st-louis/parcels
timeout 180 uv run --no-project python scripts/st-louis/fetch_zoning.py --output public/st-louis/zoning
timeout 300 uv run --no-project python scripts/st-louis/fetch_public_listings.py --raw-out "$SNAPSHOT_CACHE/lra-source.json" --output public/st-louis/public-listings/latest.json
```

The parcel builder freezes source object IDs, fetches bounded pages with a 300MB admission cap, retains exact geometry and checks record/tile identities before replacing output. Optional `--evidence` reuses count/boundary probes only when they belong to the same refresh. The zoning builder limits base records to 200,000, uses three concurrent 2,000-record queries, validates complete unique object IDs and rejects oversized/truncated split-zone or overlay results. It writes its manifest last. `--known-base-count` is only for a count just verified in the same build session; omit it for normal refreshes.

The inventory fetcher uses at most two simultaneous geometry queries of 500 IDs, bounded deadlines/retries and a 12,000-record guard. It rejects missing/duplicate IDs and normalization mismatches and preserves the previous snapshot on validation failure. `--source-file` re-normalizes a retained audit copy without downloading it again; preserve that copy's original retrieval date. `--ids-file` is only for a verified ID response from the same refresh. The inventory and zoning scripts use Python stdlib; inventory normalization also uses the existing Node module. Do not add a scheduler or imply automatic nightly publication from this manual workflow.

After refresh, review all manifests, source/terms URLs, separate timestamps, counts, shared identities, geometry flags and changed unknown values. Run the contract tests below and exercise the actual new files with exact City parcel, split-zone, overlay and shared-account selections. Keep a dated copy of the previous bundles before replacement if rollback is required. A deployment needs its own build and browser acceptance, including stale inventory, unavailable snapshots, County jurisdiction failures and overlapping canceled selections. No source refresh performs publication.

## Practical measured-geometry and imagery pipeline

The following is a reproducible **next-stage pipeline**, not a claim that LiDAR reconstruction, survey roofs or site photogrammetry are already shipped.

1. **Resolve the site and record rights first.** Keep a jurisdiction-qualified official parcel ID and boundary separate from OSM building footprints. The [City public-data catalog](https://dynamic.stlouis-mo.gov/opendata/downloads.cfm) provides parcels, assessor records, historical sales, zoning and building records under [custom terms](https://dynamic.stlouis-mo.gov/opendata/terms.cfm). The tested City layer `https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0` supports GeoJSON queries but did not return browser CORS headers. The implemented parcel snapshot above supplies a same-origin transport path. The current [County parcel item](https://www.arcgis.com/home/item.html?id=fd4893ca99244279adb2ffa206e09ec7) points to a service that returned 403 in this research; its metadata does not establish unrestricted redistribution. Public viewing is not a blanket data license. Do not label the accessible county 2014–2024 sales-analysis snapshot as a current assessor feed.

2. **Query small USGS source footprints before downloading point clouds.** Use `https://tnmaccess.nationalmap.gov/api/v1/products` with a small `bbox=west,south,east,north`, `datasets=Lidar Point Cloud (LPC)` and a bounded `max`. The API returned CORS `*`. Downtown and Clayton probes each returned a 2017 project plus an older 2012 project. Inspect tile metadata, valid coverage and acquisition dates rather than choosing the newest catalog-modified date. [USGS downtown metadata](https://www.sciencebase.gov/catalog/item/64407e0fd34ee8d4ade736ef) identifies acquisition **February 17–27, 2017**, despite publication in 2023. [The National Map terms](https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map) establish public-domain use and request source acknowledgment.

3. **Acquire only the selected site's source tile(s).** The verified downtown tile 7433_4278 is about 41.1MB; the Clayton tile 7313_4280 is about 43.8MB. No LAZ files were downloaded during this research. The downtown source is:

   `https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/MO_Saint_Louis_Lidar_2017_B17/MO_StLouis_2017/LAZ/USGS_LPC_MO_Saint_Louis_Lidar_2017_B17_7433_4278.laz`

   Save the source checksum, acquisition interval, tile footprint, horizontal/vertical CRS, units, classification schema and processing steps. Normalize datums before mixing altitude with the local scene. Clip a small buffered area, separate ground and building returns, remove outliers, and retain uncertainty. A terrain DEM must not be used as a rooftop surface. Derive roof candidates from above-ground points; compare residuals and edge alignment against independent control/reference geometry before replacing estimated heights. This recipe has not been executed or accuracy-benchmarked here.

4. **Choose streaming or a processed local level of detail deliberately.** [USGS LidarExplorer](https://www.usgs.gov/tools/lidarexplorer) supports browser inspection. A working older EPT metadata endpoint is `https://usgs-lidar-public.s3.us-west-2.amazonaws.com/MO_StLouis_2012/ept.json`. It describes 3.3 billion points, has no RGB attributes and includes broad elevation outliers; do not fetch the whole cloud or silently relabel it 2017. A 2017 EPT endpoint was not established. For processed geometry, publish bounded tiles with explicit source IDs, capture dates, geometric error and retained attribution. Keep a coarse representation when detail is unavailable, and measure first usable view, memory, loading errors and frame time on target devices.

5. **Use imagery for the surfaces it actually observes.** The [official MSDIS service page](https://msdis.missouri.edu/web-services/) documents credential-free imagery consumption. The statewide service below has 0.15m source pixels, EPSG 26915 and working Origin-matching CORS:

   `https://stateimagery.msdis.missouri.edu/arcgis/rest/services/Missouri_6inch_Statewide_2023_2024_Cached/ImageServer`

   A small `/exportImage` request with `bboxSR=4326`, `imageSR=3857`, `size=256,256`, `format=jpgpng`, `f=pjson` worked. Generate fresh exports instead of saving temporary image URLs. Cached tiles use UTM 15 coordinates, not XYZ Web Mercator. [Missouri DNR](https://dnr.mo.gov/land-geology/what-were-doing/imagery-light-detection-ranging-lidar) dates the northern/southern acquisition to 2023/2024 and documents free public services; unrestricted raw-file redistribution was not established from blank service license metadata. The public-domain NAIP lane is available at `https://imagery.msdis.missouri.edu/arcgis/rest/services/NAIP/NAIP2024/ImageServer`; its verified local mosaic is 2024 with 0.30m pixels. Inspect actual band/rendering metadata and tile acquisition information before assigning colors or exact flight dates. Overhead orthophotos can inform ground and roof textures; they do not supply unseen facades.

6. **Treat photographic facades as a separate capture/licensing task.** Use authorized site photographs/oblique imagery with adequate overlap and calibrated control if a measured textured mesh is required. Preserve capture dates, calibration, coordinate transforms, residuals and redistribution permission. Check facade completeness and occlusion rather than painting an aerial image onto vertical walls. An alternative display lane already has an adapter: [Google Photorealistic 3D Tiles through Cesium](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/), connected with the user's ion token. It streams captured photographic surfaces under provider terms, with baked illumination. It is not an exportable CC0 asset, a live city camera or a valid relightable shadow survey. Authorized connection, first visible content and local coverage require separate browser verification; a token-free build cannot prove them.

## Listings and scenario inputs

The production `listing-import-template.csv` is header-only. CSV parsing and rental calculations live in `src/lib/estate-analysis.mjs`; raw local files remain in the browser. Sources and `as_of` values are mandatory; source+listing-ID deduplication and same-date conflicts remain explicit. Distinct listings for a supplied parcel must not silently become distinct unique properties. Local CSV imports require positive numeric asking prices. The separate official LRA inventory accepts unknown prices and must not be passed through that priced-import assumption without an explicit unknown-price path. Imported asking-volume totals are listing-based and do not establish market coverage, current availability or property valuation.

Store/serialize assumptions and output conventions together when producing a reviewable scenario. NOI is before reserves/debt; DSCR is NOI/debt service; cash flow is after reserves/debt. Enter market rent, costs and loan terms explicitly. Null ratios, negative cash flow and break-even occupancy above 100% must survive formatting and export. A complete city-for-sale percentage requires a verified complete inventory and denominator, which these imports do not supply.

## Verification entry points

```sh
uv run --no-project --with shapely python -m unittest discover -s scripts/st-louis -p 'test_build.py'
node --test tests/unit/city-analysis.test.mjs tests/unit/city-conditions.test.mjs tests/unit/city-region.test.mjs tests/unit/estate-analysis.test.mjs
node --test tests/unit/city-parcels.test.mjs tests/unit/city-zoning.test.mjs tests/unit/city-public-listings.test.mjs
```

The checks cover graph paths/disconnections, source geometry, weather freshness/nulls/solar direction, tile selection and finance/import invariants. Snapshot fixtures cover exact record identity, shared HANDLEs, geometry failures, conservative jurisdiction outcomes, split zones, overlays, unknown asking prices, strict availability filtering, stale retrieval and cancellation. Locally prepared real data also passed source geometry/tile checks, exact-record selection and City parcel/zoning joins; these are data/module checks. A fixed loan fixture uses $100,000 principal, 6% nominal interest and 360 months, giving a $599.5505251527528 monthly payment before formatting. It is independently checked by rolling the amortization balance forward. Module fixtures and source validation do not establish application launch readiness or external-provider access.

For an actual release, record repository build/copy/style checks, desktop/mobile and keyboard paths, fresh/stale/offline weather, bounded region-loading failure, local CSV conflict handling, scenario/export replay and the optional valid-token/invalid-token photographic paths. A defensible site-feasibility benchmark also needs hand-checked official parcels, cited zoning/constraints and identical assumptions across scenarios. No automated entitlement conclusion follows from a visually rich map alone.
