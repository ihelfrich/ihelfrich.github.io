# Ian Helfrich — public site

Public website for Dr. Ian Helfrich: quantitative teaching practice, applied economics research, open teaching tools, datasets, and writing.

The site is built with Astro and deployed to GitHub Pages. The current production URL is `https://ihelfrich.github.io/`; the legacy WordPress site remains at `https://ianhelfrich.com/` until the custom-domain cutover is explicitly approved and completed.

## Local development

Node 22.12 or newer is required.

```sh
npm ci
npm run dev
```

Production build:

```sh
npm run build
npm run preview
```

## Structure

- `src/pages/` — routes and commercial pages
- `src/content/teaching/` — courses and open teaching tools
- `src/content/research/` — papers and active research pages
- `src/content/datasets/` — public datasets and release records
- `src/content/projects/` — software, viewers, and research infrastructure
- `src/content/writing/` — essays and notes
- `src/content/talks/` — talks, seminars, and workshops
- `src/pages/library.astro` — unified public index
- `src/pages/archive.json.js` — machine-readable public catalogue
- `src/data/navigation.mjs` — the one place navigation labels, routes, redirects, and sitemap static routes are defined
- `src/layouts/Base.astro` — global metadata, navigation, and footer
- `src/styles/instrument.css` — editorial, interaction, and responsive design system
- `public/cv/` — public CV documents

Publishing conventions are documented in `PUBLISHING.md`; the visual and motion rules are documented in `DESIGN_SYSTEM.md`.

## Property Lab licensing

The St. Louis City & Property Lab has [component-specific terms](public/st-louis/LICENSE.txt). Commercial use requires a signed agreement with Dr. Ian Helfrich specifying a base license fee plus a percentage-of-sales royalty. His own use is exempt. Third-party software and public-source data retain their own terms; this does not relicense the site's other teaching materials.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`. The workflow builds the site, refreshes the reading cache, creates the Pagefind index, and deploys the `dist/` artifact to GitHub Pages.

The custom-domain process and rollback notes are documented in `DNS_AND_DOMAINS.md`. Do not change DNS or remove the WordPress host until the GitHub Pages build, custom-domain certificate, email MX records, redirects, and rollback records have all been verified.

### Regional Property Lab data

The property atlas defaults to all of St. Louis City and County. Regional manifests describe source identity, record counts, vintages and spatial tiles; the browser loads overview cells before bounded individual-property tiles. Source records are not unique houses. Recorded transfer amounts, assessments, current owner-name indicators, permits and planning events are separate evidence.

Repeatable source builders live in `scripts/st-louis/`: `fetch_county_region.py`, `build_city_region.py`, `fetch_property_permits.py`, `fetch_property_ownership.py` and `fetch_property_planning.py`. Each script documents its arguments with `--help`. Published data are dated snapshots, not a continuous feed. The daily website build is separate from the scheduled property observation collector described below.

Activity currently connects City permits issued in 2025, the County historical zoning-petition index, selected official planning notices, County organization-name indicators and City LRA availability. Owner-name search groups literal source names, preserving spelling variants; it does not assert common control or a buyer at a historical transfer. County permits, a comprehensive private-market listing feed and nationwide coverage are not connected. Private listing imports remain available.


### Regional Observatory observations and refresh

Activity now has Ownership, Development and Utilities views, geographic rectangle selection, browser-local saved searches, precise event-date filters, source health and evidence JSON exports. The map displays the active evidence separately from the value map so different units are not confused. Search results preserve source record identifiers; a foreign utility/permit/planning point is never passed as a parcel GIS identifier.

`property-observations.yml` runs daily at 10:43 UTC or on workflow dispatch. It runs `scripts/st-louis/refresh_property_observations.py --all-sources`, validates the retained ledger, commits only approved public-data directories, then dispatches the existing Pages deployment. A `GITHUB_TOKEN` data commit alone would not start another workflow. A failed source preserves its last complete snapshot and publishes failure health; deployment and data refresh are separate outcomes. No email/SMS alerts are connected.

The ownership ledger has one immutable baseline, a compact latest state, immutable change partitions and checksummed collection receipts. It starts at the retained September 12, 2026 observation and supplies no earlier history. Name changes are observations, not acquisitions. Browser history reads at most 12 matching change partitions and 5,000 events; truncation and failed partitions are explicit. Utility history stores aggregate classification counts and source-state fingerprints, not household-level history. Planning document indexes retain observed versions and original source links. TIF and abatement source vintages are independent of retrieval dates.

Current utilities connect only the City's published service-line material inventory. Both sides, coded evidence and unknown status remain distinct. Official broadband, utility-provider, regulatory and capital-project links are context, not asserted route geometry or live availability feeds. Restricted operator feeds are not mirrored. Public source terms and third-party licenses remain applicable.

Verification: `npm run check`, the focused `city-property-*` tests and `scripts/st-louis/test_property_utilities.py`. Collector tests cover repeat observations, failed-source retention, interrupted publication, checksum reconciliation and strict identities. The full site artifact must remain below GitHub Pages’ 1 GB limit; observations do not duplicate full raw utility snapshots on every run.
