# Routes

Framework: Astro 7 file-based routing. All HTML routes use `src/layouts/Base.astro` unless noted.

## Primary public routes

| URL | Entry | Purpose |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | Home: positioning, selected work, interactive evidence instruments |
| `/work` | `src/pages/work.astro` | Applied work and capability cases |
| `/research` | `src/pages/research/index.astro` | Research program, records, and maturity/status boundaries |
| `/research/[slug]` | `src/pages/research/[slug].astro` | Individual research record |
| `/teaching` | `src/pages/teaching/index.astro` | Teaching, tutoring, and quantitative coaching |
| `/about` | `src/pages/about.astro` | Biography, working style, and portrait |
| `/cv` | `src/pages/cv.astro` | Public CV presentation and downloads |
| `/contact` | `src/pages/contact.astro` | Contact and engagement entry point |

## Supporting records

| URL | Entry |
| --- | --- |
| `/projects`, `/projects/[slug]` | `src/pages/projects/index.astro`, `src/pages/projects/[slug].astro` |
| `/datasets`, `/datasets/[slug]` | `src/pages/datasets/index.astro`, `src/pages/datasets/[slug].astro` |
| `/library` | `src/pages/library.astro` |
| `/writing`, `/writing/[slug]` | `src/pages/writing/index.astro`, `src/pages/writing/[slug].astro` |
| `/job-market` | `src/pages/job-market.astro` |
| `/people`, `/people/[slug]` | `src/pages/people/index.astro`, `src/pages/people/[slug].astro` |
| `/search` | `src/pages/search.astro` |

## Direct-only / archival / legacy surfaces

`/capabilities`, `/start`, `/program`, `/lab`, `/gis`, `/book`, `/third-space`, `/now`, `/reading`, `/colophon`, and selected project detail routes. Discovery rules and noindex boundaries are enforced by repository checks.

## Machine outputs

`/rss.xml`, `/sitemap.xml`, and `/archive.json` are produced from corresponding files in `src/pages/`.
