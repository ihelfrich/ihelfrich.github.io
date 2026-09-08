# Key page dependency trees

All pages import `src/layouts/Base.astro`; Base imports global styles, `SiteIndex.astro`, and `FieldRail.astro`.

## `/` Home

Entry: `src/pages/index.astro`

- `src/layouts/Base.astro`
  - `src/styles/global.css`
  - `src/styles/instrument.css`
  - `src/styles/fieldbook.css`
  - `src/components/SiteIndex.astro`
  - `src/components/FieldRail.astro`
- `src/components/CaseRecord.astro`
- `src/components/OptimalTransportAperture.astro`
- `src/components/LeastSquaresLab.astro`
- `src/components/RepresentationRelay.astro`
- `src/data/public-record.mjs`

## `/work`

Entry: `src/pages/work.astro`

- `src/layouts/Base.astro`
- `src/components/CaseRecord.astro`
- `src/components/RepresentationRelay.astro`
- `src/components/CdeDecomposition.astro`
- content collections: projects, research

## `/research`

Entry: `src/pages/research/index.astro`

- `src/layouts/Base.astro`
- `src/components/ResearchGraph.astro`
- `src/data/research-evidence.mjs`
- content collection: research

## `/teaching`

Entry: `src/pages/teaching/index.astro`

- `src/layouts/Base.astro`
- `src/components/LeastSquaresLab.astro`
- `src/components/RepresentationRelay.astro`
- `src/components/CaseRecord.astro`
- `src/data/public-record.mjs`

## `/about`

Entry: `src/pages/about.astro`

- `src/layouts/Base.astro`
- durable portrait asset: `public/people/ian-editorial.webp`
- `src/data/public-record.mjs`

## `/cv`

Entry: `src/pages/cv.astro`

- `src/layouts/Base.astro`
- verified PDF assets under `public/cv/`
- `src/data/public-record.mjs`

## `/projects` and `/projects/[slug]`

- `src/pages/projects/index.astro`
- `src/pages/projects/[slug].astro`
- `src/layouts/Base.astro`
- content collection: projects

## `/library`

Entry: `src/pages/library.astro`

- `src/layouts/Base.astro`
- research/project/dataset/writing collections

## `/contact`

Entry: `src/pages/contact.astro`

- `src/layouts/Base.astro`
- contact actions and engagement positioning

## `/search`

Entry: `src/pages/search.astro`

- `src/layouts/Base.astro`
- Pagefind runtime assets generated at build time
