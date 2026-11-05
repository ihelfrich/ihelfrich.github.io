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

The current pin includes three saved IV investigations with 16 tasks at `/learn/stata/Labs/IV/`. Its first-stage/2SLS calculations and Anderson–Rubin confidence sets have eleven independent R/native Stata verification cases. Each task retains its own experiment and response, with shared investigation notes and Workspace backup support. The integration runner checks a weak-instrument task offline and restores its response, settings and note after reload, alongside shared navigation and phone layout. The route enters the sitemap and site-wide search with the other packaged pages.

STATAverse retains its existing tracker-free runtime. The analytics build gate requires zero counter snippets on the configured app mount, while keeping the ordinary site-wide counting and click-event checks elsewhere. The browser integration runner independently rejects external runtime requests from the app. This makes the existing integration boundary explicit; it does not disable analytics on the rest of the website.

The release must publish this canonical route before merging the source release into the STATAverse project’s main branch. That source includes the legacy-route bridge and worker migration, verified against the actual older v7 worker. It preserves query strings, fragments and local storage and retires only the old STATAverse caches. Canonical pages omit the bridge script. Public destination and deployment receipts are checked separately after release; no domain or DNS changes are required.

The canonical site was deployed on 5 November 2026 UTC through PR #22. Public browser checks verified beginner execution, saved work, old reading-key compatibility, the IV lab, offline practice and simulation, Teaching links, Pagefind, mobile layout and targeted accessibility. A delayed-module check identified an early-click gap; the updated pin keeps the practice workspace inactive until initialization completes. The pinned source’s public-site receipt records the tested deployment rather than inferring publication from a local build.
