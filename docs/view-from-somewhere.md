# The View from Somewhere

*The View from Somewhere* is a textbook by Ian Helfrich, published at `/view-from-somewhere/`: an opening page with the title page, the note before the book and the map of its chapters, and one page per chapter at `/view-from-somewhere/<chapter>/`. Each page is set like the printed book, in Latin Modern, with the printed page numbers in the margin. Twenty-two of its figures are live: the reader changes the inputs and the figure recomputes.

## Where the text lives

The book is written in LaTeX in its own project (`positional-economics/textbook`). That project's web build turns each chapter into HTML: pandoc for the prose, MathJax to SVG for the mathematics, the chapter's own TikZ compiled to SVG for the printed figures, and a script per chapter for the live ones. This repository holds an export of that build and never edits it:

- `src/data/view-from-somewhere/book.json`: the book's structure (title, parts, and for each chapter its number, slug, title, printed pages, summary, description and chapter-only styles). Its `source` entry records which state of the book the export was made from: a hash of the LaTeX, a hash of the web edition's own code and chapter settings, and the date.
- `src/data/view-from-somewhere/contents.html` and `chapters/<slug>.html`: each page's sheet, with its figures, data and live script.
- `public/view-from-somewhere/book.css` and `book.js`: the style sheet shared by every page (the type is embedded in it) and the script that fits display mathematics to the column. Pages request them with the version recorded in `book.json`, so a new export is never paired with a cached old style sheet.
- `public/view-from-somewhere/FONTS.txt`: what the embedded type is (subsets of five Latin Modern fonts), how it was changed, and the GUST Font License it is distributed under.

To refresh the export after the book changes, from the book project:

```sh
cd textbook/web
node build.cjs                                  # rebuild every page from the LaTeX
node site.cjs /path/to/ihelfrich.github.io      # write the files listed above
```

Then, in this repository, run `npm run check:navigation` and build. The exporter stops if a built page does not have the form it expects, and it rewrites the links between the book's pages to this site's routes.

The committed copy of the site map, `public/field.json`, is what the deployed site serves and what the home page lists, because the deploy runs `astro build` without the site-map step. It needs regenerating only when a chapter is added, removed or retitled. Chapter labels on the map are the chapter titles, read from `book.json` by the generator, so nothing else needs editing. After a build:

```sh
node scripts/build-field-data.mjs --public
```

then build again, since the home page lists the map's pages, and repeat until the file stops changing (once is usually enough).

## What this site adds

`src/layouts/ViewFromSomewhere.astro` wraps each sheet with the page metadata, the shared bar (`SiteBar.astro`, with the trail Teaching / The View from Somewhere / chapter) and the visit counter. The site's `tokens.css` and the book's style sheet both define `--ink`, `--paper` and `--rule`, so the layout inlines the tokens first and links the book's style sheet after them; the sheet keeps its own values. The bar keeps the site's type and layout and takes its colors from the sheet, so it follows the sheet in dark mode. The book's own colors live in `public/view-from-somewhere/book.css`, outside the token gate's scope, like the other static mounts.

`scripts/check-rendered-styles.mjs` loads every built page into happy-dom. A chapter carries megabytes of inline SVG, more than happy-dom can hold, so that gate drops the drawings and scripts from the book's pages before loading them; its heading and font checks are unaffected.

The book is registered in the places the rest of the site reads:

- `src/data/navigation.mjs`: the opening page in `STANDALONE_ROUTES`, which puts it in the sitemap. The primary header labels are unchanged.
- `src/components/SiteIndex.astro`: a Course record, which puts the book in the command-K index beside the three course texts.
- `src/pages/sitemap.xml.js`: the chapter routes, from `book.json`.
- `src/data/breadcrumbs.mjs`: the section label and its parent, Teaching.
- `src/data/field-topics.mjs`: topics, short labels, the page type and a step on the Student route of the site map.
- `src/pages/teaching/index.astro`: the entry among the open courses and the card under them.
- `src/content/teaching/view-from-somewhere.md`: the book's record in the teaching collection, beside the other course texts.
- `public/field.json`: the committed copy of the site map, regenerated so the map shows the book.

## Checks

`tests/unit/view-from-somewhere.test.mjs` (part of `npm run check:navigation`) holds the export and these tables to each other: chapters in order with one sheet each, every link inside the book an anchor, an outside address or one of the book's routes, the shared files published at the requested version, the breadcrumb and topic tables in step with `book.json`, the labels of the committed site map equal to the chapter titles, and the chapter and live-figure counts written out in the index record and the teaching record equal to the export's. `scripts/check-public-discovery.mjs` checks the built pages: the teaching page links the book, the opening page links every chapter, every chapter is in the sitemap, and a chapter renders the shared bar with the same links as the course layouts.

The book project has its own browser check, which can be pointed at a local build of this site:

```sh
node check.cjs ch03 --base http://localhost:4321/view-from-somewhere/
```

It loads the chapter at desktop width in light mode and phone width in dark mode, reports console errors and sideways overflow, and works every control of every live figure.

## What the site does not carry

The book's text names the scripts behind its figures and results (`figures/...`, `experiments/...`) and a printed edition. Neither is published on the site, and the edition note on the opening page says so.

The book is listed for students: on the teaching page, in the command-K index and on the Student route of the site map. It is not in the course materials on `/job-market/` or on the Hiring committee route. That is left for Dr. Helfrich to decide; if it is added, extend the `/job-market/` check in `scripts/check-public-discovery.mjs` to match.
