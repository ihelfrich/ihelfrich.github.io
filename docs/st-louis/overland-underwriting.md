# Overland parcel and underwriting workspace

The entry points are `/st-louis/?area=overland` and `/st-louis/?area=page-i170`. Select a source record, inspect its geometry and dated building attributes, then choose **Build pro forma**. The expanded workspace supports keyboard focus containment, Escape, and a persistent Return to map control.

## Public parcel snapshot

Source: [County-published STLCO_STC_Parcels_Revised](https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/STLCO_STC_Parcels_Revised/FeatureServer/0), owned by `mwilson_stlcogis`; [catalog and terms](https://www.arcgis.com/home/item.html?id=06d43012de4a484ab004f5b34ea0e8e8).

- 6,933 records where `MUNICIPALI = 'OVERLAND'`; 6,237 report dwelling units greater than zero.
- 7,149 records intersect a 2,000 m search radius centered at approximately -90.35418, 38.686435, the Page Avenue / I-170 junction. Some parcels extend beyond the radius, and this area crosses municipal boundaries.
- Union: 11,152 distinct source object IDs. Overlap is deduplicated by source identity, not by address or locator. All source polygons are valid in this snapshot.
- 11,128 records report tax year 2023; 24 do not report a tax year. The source data edit timestamp is October 2, 2024. Retrieval occurred September 11, 2026.
- This is **historical source coverage**, not a current census of houses, an MLS feed, a title report, a zoning determination, a survey, or verified current property condition. Dwelling-unit count is an attribute filter, not a comprehensive residential use classifier.
- The newer County `maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer` returned HTTP 403 during this retrieval. It was not used to claim current coverage.
- Only public parcel identity, address, geometry, municipality, building, land-area and assessment fields are retained. Owner names, mailing addresses and contact details are excluded.

`public/st-louis/county-parcels/manifest.json` records exact counts, source dates, tile bounds and SHA-256 hashes. Expanded tile bounds preserve parcels crossing tile boundaries. The manifest coverage polygon is an envelope of selected source parcels, not the Overland municipal boundary. Invalid future source geometries remain flagged and cannot provide exact parcel confirmation.

To produce a new candidate snapshot, retrieve the layer metadata separately, then run `scripts/st-louis/fetch_county_parcels.py` with `uv run --no-project --with shapely python`, supplying a new `--cache`, a new `--output`, and `--metadata`. A cache belongs to one extraction; do not reuse old feature pages with a changed selection. The script checks source ID counts independently, requests only allowlisted attributes, verifies every geometry page, and refuses to overwrite an existing output. Raw pages remain outside the public repository.

The filtered parcel CSV export includes every matching record, not just the visible page, along with source dates and source URL. It is parcel evidence, not a listing feed; private market availability and prices are not supplied.

## Financial contract

The model covers acquisition, renovation and rental operations for 1–30 whole years. It is a pre-tax scenario engine, with a sale and optional single refinance. There is no assertion that illustrative inputs describe an Overland property or market. Selecting a different property clears financial assumptions; assessor values never become price, rent, or a tax bill.

- Sources and uses include renovation contingency, closing costs, upfront loan fees and a held cash reserve. Initial equity funds uses less initial debt.
- Rent is per unit; other income is per property. Initial downtime is applied before vacancy; fixed expenses continue during downtime. Income and cost growth are separate.
- NOI excludes debt and capital replacements. The replacement budget is spent annually; the initial reserve is held unchanged and returned on sale.
- Debt is monthly, with nominal annual interest divided by 12. Interest-only periods defer amortization but do not extend maturity. Balloons are explicit capital cash requirements. A same-month refinance pays the remaining old debt once.
- Refinance occurs after that year's scheduled payments. Its fees are a fraction of the new loan. Refinance value is a user assumption.
- Sale occurs after the final year's operations and debt payment. Choose an entered future sale price or next-year NOI divided by an exit cap rate. Sales costs and remaining debt are deducted; reserves are returned.
- DSCR uses scheduled debt service; maturity balloons remain visible separately. Cash-on-cash uses operating cash after scheduled debt, before sale/refinance/balloon flows.
- Levered IRR and NPV use year-end equity cash flows. IRR is withheld when sign changes make uniqueness unresolved. Equity multiple divides all positive distributions by all negative contributions, including later equity calls.
- Sensitivity varies per-unit monthly rent and exit value. For capitalized exits, the value shift is implemented through the cap rate; changed rents also change NOI. Unsupported stress cells show a dash.
- Income taxes, depreciation recapture, reassessment, lender-specific covenants, construction draw schedules and partnership waterfalls are outside this model.

Reference terminology: [OCC Commercial Real Estate Lending handbook](https://www.occ.gov/publications-and-resources/publications/comptrollers-handbook/files/commercial-real-estate-lending/pub-ch-commercial-real-estate.pdf). No underwriting thresholds or financing terms are represented as lender requirements.

The Develop tab can explicitly import year-one NOI from the current calculated pro forma, retaining the assumptions and illustrative status in its scenario evidence. The older one-year calculator remains available as a fallback.

## Exports and checks

ExcelJS is loaded only when an XLSX export is requested. The workbook has editable assumptions and formulas for sources/uses, monthly debt, annual operations and equity returns. It has no macros or external data connections. Its 30-year operating/debt schedule remains visible; equity cash flows end at the selected hold. Workbook inputs must remain within the app's documented model bounds. Sensitivity and source evidence are dated snapshots and must be regenerated in the app after changing assumptions.

The printable HTML report can be opened and printed to PDF. CSV provides annual cash flows. Versioned JSON preserves explicit assumptions and allowlisted property evidence. Named scenarios are local to the current browser; JSON is the portable backup. Failed storage access does not disable downloads.

`npm run check:city` includes independently hand-calculated cash purchase, zero-rate debt, interest-only, refinance, balloon, downtime, growth and capitalized exit fixtures; source count/hash/geometry checks; and workflow invalidation/storage tests. `scripts/st-louis/verify_proforma_workbooks.mjs` compares independently recalculated XLSX files to saved engine outputs. Before invoking Excel/LibreOffice for that check, remove all cached formula results to establish actual independent calculation rather than merely re-reading the app's values.
