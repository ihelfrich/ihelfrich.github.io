# Spatial Investment Lab

Client-demonstration prototype at `/spatial-economics/`, linked from the Lab, project collection and selected GIS portfolio. Built at Dr. Helfrich's request for an investment-incentives and regional-growth example. Public inputs only. Publication to the existing GitHub Pages site authorized on October 16, 2026. Deployment verification is recorded separately.

## Empirical inputs

LODES 8.4 North Carolina 2023 WAC/RAC S000 JT01 and the 2020-block geography crosswalk supply 92,264 workplace primary jobs and 54,050 residential primary jobs in the bounded window (-82.65, 35.50, -82.45, 35.68). Records are assigned by published block centroid to 1 km UTM 17N cells. There are 298 included cells and zero excluded by the 750 m nearest-node threshold. Small-area LODES counts have disclosure protection; residential primary-job counts are worker weights, not household population or income.

An explicit Overpass query supplies roads and river geometry with a surrounding routing buffer. Numeric speed tags and one-way directions are retained, while missing speeds use documented class assumptions. Private/no motor-access ways are excluded. The largest weak component is retained; directed unreachability remains infinite. Degree-two compression yields 16,350 nodes and 36,303 directed edges. Turn restrictions, intersection delay, traffic, service roads and transit are not modeled. The public source manifest records source URLs, exact query, vintage and SHA-256 hashes. External job opportunities are excluded.

## Policy model

An upfront budget B and uniform subsidy s imply Q=B/s supported offers. Site additionality a gives Qa induced site jobs, of which fraction d is relocated from other study-area cells. Additional study-area employment is Qa(1-d). Displaced jobs are removed proportional to baseline employment, including candidate cells. The donor rule is a simplifying assumption. The model conserves the implied employment mass.

Six candidate cells are chosen by descending baseline jobs with centres at least 2 km apart. They are analytical locations, not verified properties or eligible incentive sites. With constant subsidy and behavioral response, maximizing weighted gravity accessibility subject to a per-site budget-share cap is a continuous linear allocation problem. Descending-score allocation is exact for these constraints. It does not optimize employer behavior, construction capacity or fiscal returns.

Gravity weights are exp(-ln(2)t/h), with directed road times plus 15 mph access connectors and a two-minute own-cell assumption. Group means use residential primary jobs in the LODES earnings bins. Zero access can reflect directed disconnection. A fixed dislocation donor term is independent of the choice of receiving sites. The earnings objective can leave rankings unchanged; the interface reports the resulting flat trade-off rather than fabricating variation.

Net employment is held constant for T years with end-of-year real discounting. Cost per additional job-year divides upfront budget by discounted additional employment-years. Zero additionality or full relocation yields an undefined ratio, not zero cost. No tax revenue, wage response, multiplier, agglomeration mechanism, general equilibrium or identified causal coefficient is supplied. Defaults are illustrative, not Asheville calibration or an empirical recommendation.

## Implementation and reproduction

1. `uv run --no-project python scripts/spatial-economics/fetch_sources.py` retrieves only the explicit public files. Cached raw inputs stay in ignored `.geospatial-cache/`. Retain the cache for exact regeneration; a fresh Overpass request reflects a newer source snapshot.
2. `uv run --no-project --with numpy --with scipy --with pyproj --with shapely python scripts/spatial-economics/build_dataset.py` builds the public inputs and independent original-geometry routing oracle.
3. `node --test tests/unit/spatial-investment.test.mjs` checks routes against the oracle, allocation against a small exhaustive grid, budget and employment conservation, edge cases and discount timing.
4. `npm run build:fast` builds the Astro site. Existing site checks cover public copy, tokens and rendered styles.

The browser worker computes its own shortest-path matrix once, then recomputes policy scenarios. Controls invalidate pending outputs and exports. JSON export includes all policy inputs, allocations, cell effects, coverage and provenance, with no Cesium credentials. The public input download includes the OSM-derived graph to permit reproduction.

## 3D and token boundary

The existing Cesium connector gained an optional `onScene` callback for analytical overlays. It exposes the renderer, not the token. The deployment continues to use the existing GitHub `CESIUM_ION_TOKEN` secret mapped to `PUBLIC_CESIUM_ION_TOKEN`. A browser asset token is necessarily visible to page visitors after compilation. Its scope and allowed URLs were not independently audited; no token was printed, committed or added to exports.

World Terrain, imagery and OSM buildings connected in the preview; all 298 column centres received terrain heights. Height encodings are statistical display scales, not physical buildings or water surfaces. Attribution is preserved. The live credit shows “Upgrade for commercial use”; review the account entitlement before commercial production use. No subscription or account change was made.

## Verification

`docs/spatial-investment-verification.json` records the tested state. Nine numerical tests passed, including 144 original-graph route comparisons. Browser checks cover desktop/mobile overflow, zero additionality, equal versus optimized allocation, all three map layers and a real JSON download. Default illustrative inputs yield 60 additional study-area jobs, $19,538 per discounted additional job-year, and +41.1 mean gravity-weighted opportunities for the lower-earnings group versus +36.3 under equal allocation. These are conditional model outputs, not estimated real-world impacts.

The full English Avenue report is not linked by this application. Earlier portfolio changes are preserved; no raw client data was added to the investment model.
