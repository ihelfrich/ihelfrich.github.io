# Site map (`/field/`)

The site map is an interactive graph of every page and the links between them. It is built from the
published pages, so it stays current without hand-maintained lists.

## How it is built

1. `npm run build` builds the site, then runs `scripts/build-field-data.mjs`.
2. That script reads `dist/sitemap.xml` for the page list and the main content of each page for its
   links. Header and footer links are ignored, since every page has them.
3. It writes `dist/field.json`: nodes (route, title, short label, description, size, type, topics,
   section, and for papers the byline, question, role, limit and methods), links as index pairs, and
   the guided routes.
4. `/field/` loads `field.json` in the browser. `src/scripts/field-map.mjs` draws it with d3;
   `src/lib/field-graph.mjs` holds the graph logic (shortest path, ring radii, search ranking,
   references) and is covered by unit tests.

`public/field.json` is a committed copy so that `npm run dev` works. Refresh it with
`node scripts/build-field-data.mjs --public` after a build.

## Adding or changing a page

- A new page appears on the map by itself the next time the site builds, as long as another page
  links to it from its main content. The build reports any page that nothing links to.
- Topics: add the route to `OVERRIDES` in `src/data/field-topics.mjs`. The first topic is the primary
  one and sets the page's color when a topic is selected. Until then the page gets a provisional tag from
  keyword rules, and the build prints it.
- Short label: add the route to `LABELS` in the same file. Labels must be unique and 40 characters or fewer.
- Guided routes (Hiring committee, Student, Collaborator, Industry and policy): edit `ROUTES` in the same
  file. The build fails if a route lists a page that does not exist.
- Paper details come from the page's content file: `authors`, `year`, `displayStatus` or `status`,
  `question`, `role`, `limit` and `method`.

## Reading the map

- Clusters: pages that link to each other sit closer together. Selecting a page re-forms the map in
  rings, one ring per link between that page and the others.
- Sections: pages on a ring grouped by folder, with links bent through the folder tree.
- Topics: one wedge per topic, rings by number of links from the home page.
- Color appears only when a topic or page is selected. Shape shows the type of page.

## Tools

- Routes: short guided paths for a hiring committee, a student, a collaborator, or an industry or policy client.
- Dossier: collect pages, then copy a link that restores the selection, copy a list of references, email
  it, or print it. The selection lives in the address bar.
- Trace path: select a page, choose Trace path, then select a second page to see the shortest chain of links.
- Keyboard: arrow keys preview the pages linked from the selected page, Enter travels to the previewed page,
  O opens the selected page, Escape clears.

## Limits

- Links reflect how pages were written. A missing link means no link was written, not that two pages are unrelated.
- Topic tags are editorial judgments.
- Tested in Chromium at desktop and phone width. Not yet tested in Safari, Firefox, or with a screen reader.

## Checks

`npm run check:navigation` runs the unit tests for the graph helpers, topics, labels, routes, breadcrumbs, and the
built `field.json` (when `dist/` exists). `npm run check:tokens` keeps colors in `tokens.css`.
