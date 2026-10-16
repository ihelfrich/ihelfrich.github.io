# Portfolio release decisions, October 16, 2026

## Scope and public-work readiness

The release adds a geospatial entry page and national financing instrument while preserving existing routes, primary navigation labels, interactive tools and research vintages. The desktop Records navigation is now visible; mobile retains the existing menu. Work, Lab, Projects, Datasets, command search and sitemap connect the new work. The existing English Avenue report is not featured or copied into this portfolio.

The audit uses the canonical public projects collection, research records, public source repositories and already-curated GIS assets. `public-work-inventory.json` records the bounded URL check: all 14 listed demo/repository URLs returned HTTP 200. An HTTP response is availability evidence, not replication or validation of every application's claims. The release adds missing canonical records for the GIS portfolio and existing St. Louis property lab, updates Spatial Investment's scope and registers the distinct national data vintage. It does not claim an exhaustive search of every private file on the machine.

Featured geospatial work has an inspectable artifact: national NMTC financing; Asheville incentive/access scenarios; classified English Avenue LiDAR media; the North Carolina terrain diagnostic; the Haiti gridded mesh; St. Louis property analysis; Hidden Rivers; American Policy Atlas. The older academic GIS page stays linked as a supporting archive. In-progress oceanographic systems and EffDist extensions retain their actual status and are not presented as completed client deliverables. Existing non-spatial research, teaching tools and reusable code remain in the canonical collections; no competing public registry is introduced.

## Independent review and adjudication

Claude audited navigation and public-work structure, implemented a bounded hub/navigation change and repaired selected model defects. AGY reviewed the existing model and national architecture. Findings were checked against code and numerical execution rather than accepted automatically.

- **Parallel road edges:** A synthetic two-neighbour chain confirmed that duplicate directed edges could prevent contraction traversal. The builder now deduplicates each directed pair/intervention identity at its minimum time. The current Asheville published graph is unchanged. The rebuilt graph was checked against the original unsimplified graph for all 88,804 modeled origin–destination pairs; maximum absolute time difference is under 0.000001 minutes, below the 0.00001-minute tolerance.
- **Candidate spacing:** Exact UTM-grid separation replaces the local angular approximation, with deterministic ties. Current real-data candidates are unchanged. Non-grid test fixtures retain a geodesic fallback. Dataset grid size is respected.
- **Infinite half-life:** The input was accepted previously. It did not poison the current fully reachable Asheville OD matrix, contrary to the strongest reviewer phrasing; an unreachable-pair fixture establishes the latent NaN risk. Nonfinite inputs now fail validation.
- **Sensitivity:** Scalar sensitivity no longer computes full accessibility 20 times. Infeasible donor-stock cases are explicit null results. Such cases are outside the current Asheville slider bounds; the fix protects the general calculation path. Stale worker errors cannot overwrite newer results.
- **Visual accounting:** Gains use teal, losses rust; allocation columns use a true gold token; zero-budget allocation columns are hidden. Candidate cards distinguish gross induced jobs from net cell change. Access-layer residential coverage is explicit. Travel matrices retain double precision.
- **Rejected or scoped suggestions:** The token checker already scans all CSS; no styling exemption existed. No nationwide OSM simulation is claimed or required for an observed financing atlas. Total project cost minus QLICI does not identify private capital, and no such ratio is published. Original bridge helpers and all existing features are preserved.

## National identification limits

Every project reconciles to its financial notes in integer cents. Filters select transaction-year flows and count projects once per interval. Representative project geography and classifications are held fixed. Missing territory locations stay in totals and exports. The 2026 release is independent of the paper's 2022-vintage sample. No nationwide causal effect, fiscal return, private-capital mobilization or growth forecast is inferred from geographic totals.

The Census state-outline derivative is context only. There are no county/ACS joins in this release, avoiding mismatched county vintages and unsupported denominators. National regional totals are explicitly not normalized for population or eligible communities.

The final bounded Claude national review found no blocking issue within its read-only source scope. Its two non-blocking observations were resolved: the map legend explicitly names AS/GU/VI as tables-only because they lack matching tract points, and executable source assertions confirm nonnegative integer flows, preventing interval-netting discrepancies. AGY’s final national pass timed out without a verdict and is not counted as a completed review.
