# Local font provenance

All three webfonts are served from this directory. The site makes no remote font request.

## Geist Variable and Geist Mono Variable

- Upstream: Vercel, `vercel/geist-font`
- Pinned release: `v1.7.1`
- Release commit: `8b8b75fa63e339db10a3cd52fb28536615b5cc63`
- Source files:
  - `fonts/Geist/webfonts/Geist[wght].woff2`
  - `fonts/GeistMono/webfonts/GeistMono[wght].woff2`
- Embedded metadata verified with fontTools:
  - Geist, Version 1.800, `wght` 100–900
  - Geist Mono, Version 1.700, `wght` 100–900
- SHA-256:
  - `geist-variable.woff2`: `2ffebe993e969069a9789d15164b7715d42491b5835516c5e3b935d5f81b05f1`
  - `geist-mono-variable.woff2`: `afaacc4c5fbba89d2ebf7a02dc4070208540874592a5504d57175782fe893101`
- License: SIL Open Font License 1.1; see `OFL-Geist.txt`.

## Newsreader Variable

- Upstream: Production Type, `productiontype/Newsreader`
- Pinned commit: `cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155`
- Source file: `fonts/variable/woff2/Newsreader[opsz,wght].woff2`
- Embedded metadata verified with fontTools: Newsreader 16pt, Version 1.003, `wght` 200–800 and `opsz` 0–72
- SHA-256: `newsreader-variable.woff2`: `1faa3380ac0e87e057b180e03fd94bd708a612afb67d2590677be4508909fae9`
- License: SIL Open Font License 1.1; see `OFL-Newsreader.txt`.

Verification performed 2026-08-18 with `file`, SHA-256, and fontTools `TTFont`. The license texts are unmodified copies from the pinned upstream revisions.
