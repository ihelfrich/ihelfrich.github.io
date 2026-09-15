# Property search by road distance

**Properties → Tools → Commute search** combines explicit listing criteria with driving constraints to one or two selected destinations. A property must satisfy every requested destination's mile and/or minute limit. Driving direction is property to destination; reverse commutes can differ.

## Data actually connected

- The existing CSV import remains the canonical user-supplied inventory. `getListingsSnapshot()` exposes all validated rows independent of the Inventory tab's visible filters. Successful replacement and clearing invalidate commute results and map markers.
- Optional CSV columns now include `beds`, `baths`, `living_area_sqft`, and `property_type` (`house`, `condo`, `townhouse`, `multifamily`, `land`, `other`). Missing fields remain null; malformed supplied values fail row validation. These fields participate in duplicate-conflict checks.
- The public choice includes only records explicitly classified `Building` in the City's LRA inventory. It excludes vacant lots but does not imply residential use, habitability or complete active-home coverage. On September 15, 2026, the snapshot contains 881 Building records out of 8,555 LRA rows, with no published asking prices or bedroom/bathroom fields.
- Broad private listings are not connected. MARIS/MLS Grid requires the relevant participation, licensing and feed access; see [MARIS rules](https://marismls.com/userfiles/kcfinder/files/240823%20MARIS%20rules%283%29.pdf) and [MLS Grid](https://www.mlsgrid.com/resources). No listing scraping or invented inventory is used.

Price, bedrooms, bathrooms, living area and property-type criteria use explicit reported fields. Unknown values cannot satisfy a criterion needing them. Only active/available records with usable regional coordinates and unique exact listing IDs are candidates. A tax assessment is never an asking price. The pure filter is bounded to 5,000 rows; the public building subset is selected explicitly before this limit.

## Routing and coverage

[FOSSGIS](https://routing.openstreetmap.de/about.html) runs the public OSRM car routing service. The [OSRM Table API](https://project-osrm.org/docs/v5.24.0/api/#table-service) supplies distance and duration along the modeled fastest route. This is not necessarily the shortest-distance route and has no live traffic, departure-time or rush-hour adjustment. The provider receives coordinates only; addresses, prices, notes and listing IDs are not sent. Its route queries are logged by the provider.

The interface ranks eligible candidates by maximum straight-line proximity to the chosen destinations solely to select a bounded batch. It does **not** use that distance to decide whether a property meets the driving constraint. Each explicit run routes at most 25 origins to two destinations. The denominator and partial-search status are visible; a partial search never claims to cover the market. Large or sustained production scans require a dedicated routing service and an appropriate listing feed.

The client shares a serialized queue across instances, spaces requests by at least 1.1 seconds, limits response size to 200 KB and operation time to 20 seconds, and caches at most 32 coordinate-matched successful matrices for five minutes. It validates every matrix cell, waypoint and source/destination dimension. It does not request or accept straight-line fallback cells. Null/unreachable routes or road snaps exceeding 100 meters remain unavailable. An unavailable result cannot become a zero-minute or zero-mile match. Provider data vintage is distinct from calculation time and remains in the export when supplied.

## User workflow and state

Search an address and choose its exact returned location, or use an already selected map location. Set a mile and/or modeled-minute limit for each destination, then set optional property criteria. Source identifiers, source dates and coordinate basis for selected destinations remain in the search evidence. Editing a criterion or destination, replacing inventory or canceling immediately invalidates results and markers; late network responses cannot repopulate them.

Matches show asking-price availability, reported housing attributes, source date, each destination's road metrics, a property inspection action and source links when available. Matches also appear in a separate map-marker channel so imported and public inventory overlays are preserved. LRA inspection retains exact trusted source parcel IDs; an imported parcel reference is not promoted into a verified public-record join.

The JSON download contains the input criteria, selected destinations and provenance, inventory scope, excluded counts, all checked records (including outside-limit and unavailable results), provider metadata and road-data vintage. Financial/imported data remains in this browser session unless the visitor chooses an export.

## Verification

The full site check covers the new parser fields, inclusive criteria bounds, duplicate identities, unknown attributes, route-response validation, rate limiting, cancellation, caching, two-destination constraints, partial counts, exact source provenance and UI stale-response behavior. Production build/style checks and direct browser routing/mobile checks complement the unit tests. Tests do not establish traffic accuracy, live listing availability or market-wide coverage.

Release check, September 15, 2026: 728 city/property tests and 19 component tests passed, followed by production build, rendered styles and public-CV checks. Native browser testing queried actual public building inventory against two explicit City/County destination points: 25 checked records met two ten-mile limits; tightening one limit to six driving miles produced 14 matches using cached coordinate-matched road results. Source dates and unavailable prices stayed visible. The 390-pixel viewport had no horizontal document overflow. Browser error/warning logs were empty during this check.
