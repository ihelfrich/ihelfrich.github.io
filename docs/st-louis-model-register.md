# St. Louis spatial and property workbench

**Scope:** The secondary `/st-louis` route combines an open OSM view of St. Louis County and the independent City of St. Louis, the retained downtown walking study, local listing imports and explicit rental scenarios. An optional Cesium adapter can stream Google photographic geometry using the user's authorized ion asset access. This register defines data and calculation contracts; it is not evidence of deployment, complete property coverage, or successful authenticated photographic rendering.

## Implemented contracts

**Classification:** OSM and imported listings are source assertions with identifiers/history; NWS reports are observations; solar position and loan amortization are deterministic mathematical models; facades, traffic, foliage and weather effects are synthetic presentation. User prices, rents, costs and financing terms are explicit scenario parameters. Captured imagery is provider data with its own acquisition history. None of these classes substitutes for another.

Pure walking and property calculations read immutable input snapshots and produce new results. UI input changes invalidate prior scenario results before recalculation. Listing replacement commits only after validation; ambiguous identities are withheld. Renderer loading and frame cadence never mutate these analytical inputs or determine the financial outputs. The following sections state units, source clocks, bounds, failure behavior and validation domains for each contract.

## Evidence and source clocks

| Layer | Evidence and timestamp | Interpretation |
| --- | --- | --- |
| Downtown OSM | `public/st-louis/city.json` and `data-manifest.json`; source snapshot 2026-09-08T21:30:28Z | Mapped source assertions and a bounded walking graph. |
| County + independent city OSM | `public/st-louis/region/manifest.json`; Geofabrik Missouri snapshot 2026-09-07T20:21:20Z, retrieved 2026-09-08; SHA-256 retained | Full administrative geographic coverage, with incomplete OSM feature mapping. This is a different snapshot from downtown. |
| Surface samples | `public/st-louis/materials/manifest.json`; Poly Haven source URLs, author credits, physical dimensions and hashes | Real material photographs/PBR maps under CC0, not photographs of the selected St. Louis building. |
| Street furniture | `public/st-louis/street-details.json`; retained downtown OSM snapshot | Mapped node positions, with illustrative furniture shapes, dimensions and crossing paint. |
| Weather | NWS KCPS observation `observedAt`, plus separate `fetchedAt`/`checkedAt` | A nearby airport observation. A successful fetch does not make an old observation current. |
| Sun | Solar `evaluatedAt`, latitude, longitude and geometric solar model | A calculated lighting scenario, independent of the weather observation clock. |
| Photographic mesh | Google/provider asset and tile attribution | Captured surfaces with baked illumination; capture dates are unknown unless supplied by the provider. Connection time is not capture time. |
| Imported listings | Explicit `source`, `listing_id`, `as_of`, optional `parcel_id` | User-supplied records, not a verified or complete current MLS inventory. |
| Rental scenario | Exported/input assumptions and calculation conventions | Deterministic arithmetic, not observed rent, an appraisal, forecast or financing offer. |

OSM IDs and multipart IDs remain traceable through selection, graph analysis and exports. Preserve [OpenStreetMap attribution and ODbL terms](https://www.openstreetmap.org/copyright), [Poly Haven CC0 credits](https://polyhaven.com/license), and provider-generated photographic credits. Never combine source modification, acquisition, observation, import and evaluation dates into a single “live” date.

## Geography, geometry and coverage

The regional manifest distinguishes county relation `r1180456` from independent city relation `r1180533`. Saved geometry includes 104,941 building records, 196,316 roads, 24,448 green areas and 1,553 water polygons in 450 grid cells. These are processed OSM record counts, not a census of structures, parcels or properties. Of regional building heights, 560 come from explicit tags, 5,080 from floor counts and 99,301 from declared building-kind defaults. A mapped height tag is a source assertion, not proof of a survey.

WGS84 coordinates become local meters:

`x = (longitude + 90.193) × 111195 × cos(38.628°)`

`z = −(latitude − 38.628) × 111195`

Axes are x east, y up, z south. The coefficient is meters/degree, and trigonometric inputs are radians. This local equirectangular approximation supports visualization and approximate distances; it is not a cadastral/survey projection. Regional source footprints are simplified at 0.25m, roads at 0.3m, and coordinates rounded to 0.01m. Invalid geometry and topology repairs are counted in the manifest. Holes and multipart geometry retain their meaning. Tile ownership is unique by centroid, with expanded bounds enclosing the full owned geometry.

Tagged metric/imperial heights are normalized. Levels × 3.2m/floor is an estimate. Regional defaults are 6.4m for houses and industrial/retail, 3.2m for sheds/garages, 12.8m for apartments/commercial and 9.6m otherwise. Elevated parts occupy `minHeight` through total height, not `minHeight + height`. OSM buildings are not parcel boundaries; property records require their own jurisdiction and parcel identity. The regional boundary rectangle includes places outside the administrative union, so bbox inclusion alone does not establish City/County membership.

## Rendering and bounded loading

The open view is an authored interpretation of source geometry. Brick, aged concrete, asphalt and tarred-gravel surface maps retain provider tile scales of 1.4m, 2.16m, 3m and 2.2m. Color maps use sRGB; normal and roughness maps are non-color data. Window bays, trim and emissive facade atlases are authored layouts composited with those material samples. A richer facade does not verify window positions, floor counts, building use or construction material. Concrete is not verified limestone, and tarred ground gravel is a flat-roof surrogate.

Parapets and mechanical roof units are artistic details constrained to eligible footprints and outside courtyard holes. Roof elevation is 0.3m plus absolute building height. Authored Arch/courthouse shapes are not surveyed geometry. Benches and lamps use actual retained OSM node positions; untagged orientation, pole heights and geometry are assumptions. Only positively marked crossing records receive paint. Explicitly unmarked crossings remain unpainted; road orientation and paint dimensions are approximations. Lamp lenses are emissive presentation, not a measured illumination simulation.

Regional geometry is streamed from 2,000m grid cells. The client requests every intersecting detail tile when the view fits the 16-tile budget; a wider view switches to the complete coarse overview and explicitly asks the user to zoom in. It never silently truncates detail to an arbitrary visible subset. It allows three concurrent requests, aborts superseded requests, disposes departed tile geometry and backs off failed requests for 30 seconds. The regional payload totals about 83.24MB uncompressed; it is not an initial all-at-once download. Loaded-tile count describes browser state, not geographic completeness. Missing/failed tiles are unavailable, not empty parcels or absent buildings. These limits bound simultaneous work, not a guarantee of a particular frame rate or device memory footprint.

Traffic follows road polylines at illustrative speeds. Named deterministic seeds control synthetic placement. Animation time is presentation-only; pause, reduced motion and hidden-document behavior must not change analytical results. Water shading is not hydrodynamics. Display quality and network flattening are visual modes, not measured changes to the city.

## Observed weather and solar scenarios

`src/lib/city-conditions.mjs` queries [NWS observations](https://www.weather.gov/documentation/services-web-api) at [KCPS, St. Louis Downtown Airport](https://api.weather.gov/stations/KCPS), approximately 8.1km from the origin. It is not a downtown street sensor, regional sensor network or wind-flow model.

The observation cache lasts ten minutes and shares concurrent requests. The request deadline is ten seconds, including response parsing; failed refreshes have backoff. An observation older than two hours is stale; future timestamps are invalid. Freshness is recomputed even on cache hits. A failed refresh may preserve an earlier observation for provenance, but stale/invalid meteorological values are not applied as current conditions.

Temperature, wind, gusts, precipitation and cloud reports remain nullable. Missing precipitation is not dry weather. Preceding-hour rainfall accumulation is not an instantaneous rain rate. Wind direction is “from” in source meteorology and is converted to a toward-motion vector in local axes. Cloud fractions are styling estimates from explicit categories; CLR has observation-system limits, while “Fair” and NSC remain unknown. Missing fields must not silently become clear sky, calm wind or zero rain.

Solar direction uses [NOAA geometric equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF) and the scene evaluation time, not the weather timestamp. It is an approximate solar model without atmospheric refraction or a survey-grade shadow guarantee. A user-controlled clock is a solar scenario even when the last observed weather is displayed alongside it.

## Captured photographic representation

`city-reality.mjs` initializes Cesium with an explicit per-connection ion resource; the default Google photographic asset is 2275207. See [Cesium's official integration guide](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/). This optional connection requires the user's authorized provider access and may be subject to account limits and provider terms. The token belongs only in the active connection: do not store it in source, logs, URL state, browser persistence or exported reports. Network requests necessarily convey credentials to the authorized provider.

Photographic tiles contain captured geometry and image textures. They are not current weather imagery, measured property lines, legal ownership records or a present-day construction survey. Their lighting is baked; a synthetic clock or sky setting must not be presented as physically relighting the captured scene. Open-map counts, OSM heights and authored roof details must not be reported as photographic mesh measurements. A picked geographic location does not by itself resolve a legal parcel.

Initialization, pending tiles, processing, failure and the first visible rendered tile are distinct states. A successful connection is not proof of complete City/County coverage. A failed token, empty view, missing tile or interrupted renderer must remain explicit, with a route back to the open view. No successful authenticated Google rendering is claimed by this documentation.

Connection diagnostics expose only fixed stage names and numeric HTTP status, never provider response bodies, URLs or credential strings. Only that credential-free stage/status pair survives a reload in session storage. Abort releases a pending viewer immediately; a late factory result cannot replace a newer engine. One failed initial tile does not cancel remaining tiles, but the first-surface deadline bounds an unusable connection. Development prebundles Cesium before credential submission. An observed stale dependency request returned `504 Outdated Optimize Dep`; restarting the development server with fresh optimized dependencies allowed a synthetic invalid token to reach the expected ion authorization `401`. This verifies module delivery and the failure path, not a user's asset entitlement.

## Downtown walking contract

Walking remains **downtown only**. Regional visual tiles do not extend the graph. The immutable undirected graph follows allowed OSM way segments; geometric crossings do not create connections. Shortest edge distance plus two point-to-node offsets, divided by 1.3m/s, gives seconds. Budgets of 5–30 minutes become seconds. A 100m nearest-node limit bounds POI attachment but does not verify entrances or legal crossings.

Absent/disconnected nodes stay unreachable. Negative lengths and nonpositive speeds are rejected. Increasing the time budget cannot shrink the reachable set; increasing speed cannot increase travel time. Identical snapshot, origins, destination and assumptions produce identical comparisons regardless of camera, frame rate, light or quality. Routes may truncate near the source boundary. Temporary closures, open-plaza movement, conditional/directional access and wheelchair accessibility are not comprehensively represented.

Versioned shared state identifies the analytical snapshot and assumptions. Different snapshots are disclosed; historical data are not automatically archived. Unreachable export times are null, not zero. Camera state and visual detail are not analytical evidence.

## Local listings and coverage denominators

`estate-analysis.mjs` parses browser-local CSV text. The production import template is header-only, with no synthetic active listings. Required fields include a source, stable listing ID, valid coordinates, positive numeric asking price, explicit recognized status and a valid `as_of`. Pending, sold and withdrawn records never silently become active. Unknown status and malformed dates are row errors. Limits are 5,000 records, 5,000,000 UTF-8 bytes and 256 columns; quoted commas, CRLF and source metadata are supported. The parser validates global coordinates; the application must separately apply its supported geographic scope.

Identity is normalized source plus case-sensitive listing ID. Deduplication retains the latest unambiguous record; conflicting latest records are withheld for review, including a conflicting date-only row whose ordering against a same-day timestamp is unknown. Distinct listing IDs on one supplied parcel remain separate listings and generate a possible-duplicate warning. Imported parcel IDs are unverified and may collide across jurisdictions. Combining separate imports requires the same identity rules; parsing one file does not reconcile prior files automatically.

Active asking-price volume is the sum of **active listing records**, not unique-property value. Show active listing count, identified unique parcel count and records lacking parcel identity separately. No “percent of the city/county for sale” is defensible without a complete inventory, a stated geographic/time boundary and a compatible denominator. Source `as_of` does not guarantee current availability. Assessed value, historical recorded sale price and asking price are different observations. No free MLS feed, current County parcel feed or complete market inventory is implied. Local import data must not be uploaded to network services as a side effect of mapping or calculation.

## Stabilized rental scenario

All inputs are explicit finite numeric assumptions; blanks are not silently zero. Currency is USD, rents/other income are monthly, operating expenses and reserves are annual, rates are percentage points from 0–100, and the loan term contains a positive whole number of months. No rent estimate, financing quote, cap-rate target or investment recommendation is supplied by the calculator.

- Gross potential annual income = 12 × (monthly rent + other monthly income).
- Effective gross annual income = gross potential income × (1 − vacancy/100). Vacancy applies to both income components by convention.
- NOI = effective gross income − operating expenses, **before replacement reserves and debt**.
- Cash flow = NOI − annual capex reserve − annual principal-and-interest debt service.
- Loan principal = purchase price × LTV/100. Rehab and closing costs are not financed by this formula.
- Initial equity = purchase price + rehab + closing costs − loan principal.
- Monthly payment uses full fixed-rate amortization with nominal annual interest divided by 12; the zero-interest limit is principal/months.
- Cap rate = NOI/purchase price; cash-on-cash return = cash flow/equity. Both return percentages.
- **DSCR = NOI/annual debt service**, a dimensionless ratio. This is the stated NOI-based convention, not a claim to reproduce any lender's underwriting or reserve-adjusted DSCR.
- Break-even occupancy = (operating expenses + reserves + debt service)/gross potential income, expressed as a percentage.

Undefined zero-denominator ratios are null. Negative cash flow/returns and break-even occupancy above 100% remain visible. Debt service includes principal and interest only; relevant taxes, insurance, management and maintenance belong in the user's operating-expense assumption. No depreciation, income tax, rent growth, development absorption, exit sale, appraisal or lender approval model is implied. See [CFPB amortization guidance](https://www.consumerfinance.gov/ask-cfpb/how-does-paying-down-a-mortgage-work-en-1943/) and [Fannie Mae's NOI/reserve definitions](https://multifamily.fanniemae.com/media/35991/display) for the narrow source distinctions used; this module does not implement Fannie Mae underwriting.

## Failure behavior

Invalid shared state, missing snapshots/destinations, disconnected routes, stale observations, source outages and photographic authorization failures remain visible. WebGL failure should leave ordinary DOM controls usable. Missing geographic detail must not be interpreted as an absent hazard, absent property or complete source inventory.

## Verification entry points

Run `npm run check:city` for the pure analysis and UI regressions, `npm run check` for the site build/contracts, and `node --test tests/unit/homepage-*.test.mjs` for retained homepage behavior. Reproducible data rebuild commands are in `scripts/st-louis/README.md`. Saved data passed source-ID uniqueness, geometry/height/coverage checks. Unit fixtures cover walking invariants, weather freshness/null handling, tile selection and stabilized finance/CSV semantics. Source texture hashes and image decoding were verified; roof detail had independent hole/overhang/elevation/triangle-budget checks. These establish their specific invariants, not the truth of every source record or successful publication.

The loan fixture independently checks a $100,000 principal at 6% over 360 months against a $599.5505251527528 payment and a month-by-month zero-balance recurrence. Region ray fixtures use actual Three.js roof/wall geometry, including minimum-height clearance and hidden/flattened layers. UI fixtures use synthetic imported records only. These deterministic models do not integrate a physical time evolution requiring a timestep convergence study. Geometry simplification is a documented visual resolution, not convergence evidence for surveyed building geometry.

## Explicit non-claims

A broader site-feasibility claim requires official parcel/jurisdiction resolution, cited zoning rules, verified constraints and benchmarked site calculations. No current automated zoning envelope, permit approval, comprehensive flood/environmental/title assessment or superiority over another product is established by this register. Public competitor claims or unavailable product pages cannot substitute for a same-site, same-input benchmark. Browser checks of free-core access, imports, export replay, failure states, mobile/keyboard interaction and optional authenticated photographic coverage must be recorded separately before those behaviors are claimed as tested.
