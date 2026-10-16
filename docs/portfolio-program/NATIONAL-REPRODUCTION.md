# National investment atlas

The public atlas is a descriptive financing instrument, separate from the earlier research paper and from Asheville's conditional model. It uses the FY2025 public NMTC release updated August 7, 2026, not the older local NMTC viewer's dataset.

## Rebuild

Run from the website root:

```sh
uv run --no-project python scripts/spatial-economics/fetch_national.py
uv run scripts/spatial-economics/build_national.py
node --test tests/unit/national-investment.test.mjs
```

The fetcher reads exact URLs and SHA-256 expectations from the public source manifest. Existing cached files are checked rather than replaced. Workbook extraction uses openpyxl, read-only/data-only; the source workbook is never edited. Amounts convert to integer cents before all reconciliation. Each project's full financing must match the sum of its transactions. There are 8,439 projects, 21,202 transactions and $71,018,792,858.55 in financing. Five unmatched Gazetteer locations account for $45.2 million and remain in all relevant totals.

The optional state outlines reuse the public American Policy Atlas's TIGER2023 county geometry. `build_national_context.py --source /path/to/us_counties.min.geojson` dissolves state outlines. `context-sources.json` identifies its public URL, source hash and transformation. No ACS or health values are included, joined or used as denominators. Outlines are cartographic context only; financing joins use 2020 tract identifiers.

## Units and filters

- Financing flows are grouped by project ID and transaction origination year. Repeated years do not multiply project counts within an interval.
- Project-sheet state, representative tract, metro status and borrower type apply to all of a project's flows. This is explicit representative attribution, not reconstruction of transaction-specific footprints.
- All amounts are nominal QLICI financing, not tax expenditure, additional capital or causal outcomes. Source estimated cost is retained in the analytical download but not used to infer private co-investment.
- Screen values are rounded; exports retain integer cents, selected flows, full-release amounts, explicit missing locations and exact filter settings.
- National and tract display-height scales remain fixed within each map level. National summary locations are fixed financing-weighted tract points based on the full release. They are not sites.

## Checks

Numerical tests reconcile all projects, annual flows, state sums and tract sums; preserve unmapped territories; verify interval accounting and export consistency. Browser checks must additionally cover a state drill-down, an unmapped territory, empty filters, year ordering, all-record pagination/export, mobile layout and non-WebGL usability. Successful HTTP responses alone do not establish analytical correctness.
