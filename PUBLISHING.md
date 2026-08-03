# Publishing on this site

The public site is a file-backed archive. A new Markdown file becomes a permanent public record after the production build passes and the change reaches `main`.

## Where each object goes

- `src/content/research/` holds papers, preprints, and active research records.
- `src/content/datasets/` holds released and in-progress datasets.
- `src/content/writing/` holds essays, research notes, and blog posts.
- `src/content/projects/` holds software, viewers, and research infrastructure.
- `src/content/talks/` holds talks, seminars, workshops, and conference appearances.
- `src/content/teaching/` holds courses and open teaching environments.
- `public/data/` holds small files that can be downloaded directly from the site.

The schemas in `src/content.config.ts` define the required metadata. The site builds the individual record page, unified `/library` index, site-wide command index, sitemap, RSS feed, and `/archive.json` machine-readable catalogue from those files.

## Release rule

Label the actual state. A draft can describe a question or design. A working paper can describe supported results. A released dataset needs a license, provenance, and citation path. Do not publish restricted data, client material, personally identifying information, or a collaborator's work without permission.

Run `npm run check` before a draft release and `npm run build` for the complete Pagefind production build. The deployment workflow runs the factual and voice gate again before publishing.
