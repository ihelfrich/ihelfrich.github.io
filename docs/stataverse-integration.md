# STATAverse integration

STATAverse is mounted at `/learn/stata/` as part of this website's static build. The teaching engine, curriculum and references remain owned by `ihelfrich/STATAverse`. This integration adds shared navigation, typography, canonical links and public discovery without an iframe or runtime backend.

`config/stataverse.json` pins the exact source commit. GitHub Actions checks out that commit under `.sources/stataverse`, installs its pinned dependencies and runs `npm run package:site`. The website's prebuild step verifies all package hashes and mounts only its student-facing files. The generated `public/learn/stata/` directory is ignored by git. Pagefind indexes it as part of the website; it is retained in the Pages artifact, unlike separately published indexing-only spokes.

For local development, build a clean checkout of the pinned source, then run:

```sh
STATAVERSE_PACKAGE_DIR=/absolute/path/to/STATAverse/dist npm run build:fast
npm run pagefind
```

A temporary local preview may set `STATAVERSE_ALLOW_DIRTY=1`. CI rejects dirty packages even with this flag. A normal release requires the clean pinned source and its committed generated bundles. To update STATAverse, verify its source branch, commit it, rebuild its package, and update the one pinned commit in this website. A release pin must be available remotely before the website workflow can build it.

The shared navigation registry supplies the compact menu on every STATAverse HTML page. Teaching and Lab link directly to the app; the teaching collection and project record feed the public catalogue and site index. Directory pages enter the sitemap, Pagefind and field map, and the Student route includes the app. No existing primary header labels are changed.

Practice and investigation storage keys are unchanged. Reading progress reuses its original project-path keys at the new mount. The app's service worker controls only `/learn/stata/`; it leaves the rest of this website alone. Long simulations run in a local worker, and student imports remain on the device. No credentials, server-side Stata or model API are needed.

Verification includes `npm run check:stataverse`, the existing navigation/discovery/copy/token/style checks and the STATAverse integration browser runner against this built site. The browser receipt and selected reusable procedure are registered by the owning STATAverse overhaul project in its `.scholon-outputs.json`.

The current pin includes the fourth browser lab, instrumental variables, at `/learn/stata/Labs/IV/`. Its first-stage/2SLS calculations and Anderson–Rubin confidence sets have nine independent R/native Stata verification cases. The integration runner exercises a checked weak-instrument comparison offline, the shared navigation and the phone layout. The new route enters the sitemap and site-wide search with the other packaged pages.

This candidate has not been published. Before release, verify the new public route and arrange compatibility at the former `/STATAverse/` project address. GitHub Pages may route that address to the separately published project; adding a root-site redirect does not by itself establish compatibility. Preserve query strings, lesson fragments and browser-local work during the transition. No domain or DNS changes are required.
