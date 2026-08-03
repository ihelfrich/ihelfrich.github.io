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
- `src/layouts/Base.astro` — global metadata, navigation, and footer
- `src/styles/instrument.css` — editorial, interaction, and responsive design system
- `public/cv/` — public CV documents

Publishing conventions are documented in `PUBLISHING.md`; the visual and motion rules are documented in `DESIGN_SYSTEM.md`.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`. The workflow builds the site, refreshes the reading cache, creates the Pagefind index, and deploys the `dist/` artifact to GitHub Pages.

The custom-domain process and rollback notes are documented in `DNS_AND_DOMAINS.md`. Do not change DNS or remove the WordPress host until the GitHub Pages build, custom-domain certificate, email MX records, redirects, and rollback records have all been verified.
