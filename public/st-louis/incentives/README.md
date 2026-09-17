# Published City incentive files

These layers preserve all 197 TIF features and 1,440 tax-abatement features in the official distributed files reviewed on September 12, 2026. This is not verified as a complete current-year inventory. HTTP Last-Modified dates describe distribution files, not current project activity. TIF recorded approval dates in this file reach July 30, 2021. All 197 TIF `Project_Amount` values are missing and remain null.

Refresh from the repository:

```
uv run --no-project --with shapely python scripts/st-louis/fetch_property_incentives.py
```

`--cached` rebuilds verified allowlisted acquisitions without changing their observation dates. Each official response is bounded to 10 MB and checked for source/schema/identity changes. Owner and contact fields are removed before local caching or publication. Receipts retain the original response hash and headers; the cached body contains only allowlisted attributes and source geometry. Failed acquisition retains prior public data and history input, records failure in `status.json`, and exits nonzero.

Original source polygons remain available. Representative points are for map display only; invalid polygons are repaired only to place the representative point, with the original geometry retained and the repair flagged. Abatement links to current parcel records require a unique exact match of both `ParcelId` and `HANDLE`. Ambiguous/unmatched records remain unlinked. Generic history observations carry source feature identity, with parcel identity fields null.

TIF source status codes lack a verified legend and are not translated into current approval or active states. Explicit approval dates, construction labels, completion dates and scheduled payoff dates remain distinct. Tax-abatement dates have year precision and use interval-overlap filtering; no exact beginning/end day or actual tax saving is invented. A recorded abatement period alone does not establish current eligibility or entitlement.

`manifest.json` reconciles counts, byte sizes, content hashes and known date coverage. `history-input.json` is the normalized input for the refresh pipeline. Read `status.json` separately so a retained snapshot is not mistaken for a successful refresh.
