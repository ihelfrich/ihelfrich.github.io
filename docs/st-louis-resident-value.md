# Resident value and offer workspace

The property workspace now includes **Tools → Value & offers**, with a direct action on an exact selected parcel. It assembles nearby transfer evidence, calculates a seller net sheet, and compounds an entered value range under explicit annual-rate scenarios. It does not generate an appraisal or a calibrated property forecast.

## Evidence boundary

Regional parcel tiles lack condition, comparable living area, concessions, and financing terms. City latest observed transfers stop in February 2025 (the separate PrclSale archive stops in November 2024); the County 2025 archive's latest observed transfer is October 29, 2025. Retrieval dates are not transaction-coverage dates. The latest observed date does not establish complete coverage through that date.

`property-resident-sales.mjs` resolves the exact selected source record, requests detailed regional records within a bounded radius, applies exact dates and geodesic distance, and returns at most 20 candidates. It excludes subject and ambiguous identities, invalid or unsupported prices, explicitly adverse source flags, dates outside the window, and foreign jurisdictions. It retains raw transaction codes and source identities. Unknown or administrative-valid codes do not independently qualify a comparable sale. Multi-transfer history, building condition and recent missing transactions remain unresolved. Aggregate map cells never become comps. Partial tile coverage stays explicit. New requests and parcel changes invalidate prior results.

## Seller pro forma

The benchmark and offer are entered by the resident. No tax assessment, historical purchase amount or neighborhood average is silently substituted. For each route:

`net = price × (1 − selling fee / 100) − closing costs − repairs − concessions − months × monthly carrying costs − mortgage payoff`

The tool compares the offer with both benchmark endpoints and solves the buyer price required to match each endpoint's net proceeds under the buyer's cost terms. Negative proceeds remain a cash shortfall. Nonpositive algebraic break-even values are explained as a zero-price transfer meeting the modeled benchmark, not a recommended negative-price offer. All default zero cost allowances are visible; the tool does not imply they were verified. Mortgage payoff is held equal across routes. Income taxes, capital gains, contract completion risk, relocation and different future payoff schedules are outside this arithmetic.

Required values must be explicit finite numbers. Annual scenarios use ordered rates between −50% and +50%, one to ten whole years, and a positive starting range. The interface recalculates after the first calculation; invalid edits clear results. Selecting another parcel clears all entered financial assumptions. Inputs are session-local and are not uploaded or automatically persisted.

## Historical context and future scenarios

[FHFA purchase-only metropolitan HPI](https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_po_metro.txt), CBSA 41180, provides nominal, not-seasonally-adjusted St. Louis MO–IL history. See [FHFA methodology](https://www.fhfa.gov/faqs/hpi). The initial dated snapshot contains 142 quarters through 2026Q2. This geography includes areas outside City and County and the sample does not cover every transaction type.

The collector validates the source header, CBSA and metro name, base period, contiguous quarters, finite indices and dates; it publishes atomically with a source digest. A failed refresh retains the previous dated snapshot. It runs in the existing property-source workflow. UI requests are cached, bounded and lazy; sale evidence can render before HPI arrives.

Scenario rates begin at illustrative −3%, 0% and +3%. An optional control centers three illustrative paths around the most recent one-year regional change with ±3 percentage points. The spread is not fitted, probabilistic, calibrated or property-specific. The chart bands represent the entered starting value range, with a numeric table for every year. No automated current-price estimate is emitted until comparable-property evidence and out-of-time validation can support one.

## Exports and validation

The printable HTML report includes source dates, candidate transaction codes, raw-date interpretation, source links, exclusions, FHFA limitations, the entered benchmark basis and all calculated assumptions. CSV exports the seller net sheet with numeric deductions preserved; JSON exports the structured evidence packet. Reports verify calculation output against its assumptions before rendering. Text and URLs are escaped/validated; CSV text cells protect against spreadsheet formula execution.

Unit coverage exercises independent arithmetic fixtures, invalid input boundaries, negative equity, negative break-even, exact parcel identity, date and source exclusions, asynchronous cancellation, stale-state handling, report provenance and injection protection. Browser verification is also required before deployment; tests alone do not establish usability or current source coverage.

## Release verification — September 13, 2026

The complete site check passed with 681 city/property tests, 19 component tests, a production build, rendered-style checks and public-CV checks. The six Python HPI collector tests also passed. Native browser checks exercised the seller net-sheet arithmetic, explicit FHFA scenario rates, exact County and City parcel selections, financial reset, and a 390-pixel phone viewport without page overflow. Neighborhood evidence returned 20 displayed transfers in both jurisdictions. The initial search radius is 500 meters: the wider 1.5-km City query exceeded the detailed-record budget and correctly required a smaller radius. Larger radii remain available with an explicit coverage response. These checks do not establish appraisal accuracy or full contemporary transaction coverage.
