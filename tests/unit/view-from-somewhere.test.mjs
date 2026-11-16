import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { book, ROUTE, chapterRoute, chapterRoutes, sheet } from "../../src/data/view-from-somewhere.mjs";
import { PRIMARY, RECORDS, SECONDARY_PAGES, STANDALONE_ROUTES, sitemapStaticRoutes } from "../../src/data/navigation.mjs";
import { crumbsFor } from "../../src/data/breadcrumbs.mjs";
import { LABELS, ROUTES, topicsFor, typeFor } from "../../src/data/field-topics.mjs";

// The View from Somewhere is exported from the book's own LaTeX build (docs/view-from-somewhere.md).
// These tests hold the export and the site's navigation tables to each other, so a new export or a
// change to the tables fails here before it reaches the build.

const hrefs = (html) => [...html.matchAll(/href="([^"]*)"/g)].map(([, href]) => href);

// Counts that the site's prose writes out as words ("seventeen chapters", "Twenty-two figures").
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const inWords = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`);

test("the exported book lists its chapters in order, each with a sheet", async () => {
  assert.equal(book.route, `${ROUTE}/`);
  assert.ok(book.title && book.author && book.description, "the book needs a title, an author and a description");
  assert.ok(book.chapters.length > 0, "the book has chapters");
  book.chapters.forEach((chapter, index) => {
    assert.equal(chapter.num, index + 1, `chapter ${index + 1} is out of order`);
    assert.match(chapter.slug, new RegExp(`^ch${String(chapter.num).padStart(2, "0")}-[a-z0-9-]+$`), `${chapter.slug} must begin with its chapter number`);
    for (const field of ["title", "summary", "description"]) assert.ok(chapter[field]?.trim(), `${chapter.slug} needs a ${field}`);
    assert.ok(chapter.firstPage <= chapter.lastPage, `${chapter.slug} needs its printed page range`);
    assert.doesNotMatch(chapter.description, /demos\/|\.html|\.tex\b/, `${chapter.slug}: the description must not name a local file`);
  });
  assert.equal(new Set(book.chapters.map(({ slug }) => slug)).size, book.chapters.length, "chapter slugs must be unique");
  assert.deepEqual(book.parts.flatMap(({ chapters }) => chapters), book.chapters.map(({ slug }) => slug), "the parts list every chapter once, in order");
  assert.equal(book.chapters.reduce((sum, { liveFigures }) => sum + liveFigures, 0), book.liveFigures, "the count of live figures is the sum over chapters");

  const files = (await readdir("src/data/view-from-somewhere/chapters")).sort();
  assert.deepEqual(files, book.chapters.map(({ slug }) => `${slug}.html`).sort(), "one exported sheet per chapter and no others");
  for (const chapter of book.chapters) {
    const html = sheet(`chapters/${chapter.slug}.html`);
    assert.ok(html.startsWith('<div class="desk" lang="en">\n<article class="sheet">'), `${chapter.slug} must begin with its sheet`);
    assert.equal((html.match(/<figure[^>]*class="(?:[^"]* )?live-figure[ "]/g) ?? []).length, chapter.liveFigures, `${chapter.slug}: live figures as counted in book.json`);
    assert.doesNotMatch(html, /<\/?(?:html|head|body)[\s>]/, `${chapter.slug} is a fragment for the layout and must not carry a document skeleton`);
  }
});

test("every link inside the book is an anchor, an outside address or one of the book's routes", () => {
  const routes = new Set([`${ROUTE}/`, ...chapterRoutes()]);
  const pages = [["contents.html", sheet("contents.html")], ...book.chapters.map(({ slug }) => [slug, sheet(`chapters/${slug}.html`)])];
  // The colophon points to the font notice, which is published beside the style sheet.
  const notice = `${ROUTE}/FONTS.txt`;
  for (const [name, html] of pages) {
    for (const href of hrefs(html)) {
      if (/^(#|https?:\/\/|mailto:|data:)/.test(href) || (name === "contents.html" && href === notice)) continue;
      assert.ok(routes.has(href.split("#")[0]), `${name} links ${href}, which is not a page of the book`);
    }
  }
  assert.ok(hrefs(sheet("contents.html")).includes(notice), "the colophon links the font notice");
  const contents = hrefs(sheet("contents.html"));
  for (const route of chapterRoutes()) assert.ok(contents.includes(route), `the map of the book must link ${route}`);
  book.chapters.forEach((chapter, index) => {
    const links = hrefs(sheet(`chapters/${chapter.slug}.html`)).map((href) => href.split("#")[0]);
    assert.ok(links.includes(`${ROUTE}/`), `${chapter.slug} must link the book's opening page`);
    for (const neighbor of [book.chapters[index - 1], book.chapters[index + 1]].filter(Boolean)) {
      assert.ok(links.includes(chapterRoute(neighbor)), `${chapter.slug} must link its neighbor ${neighbor.slug}`);
    }
  });
});

test("the shared style sheet and script are published at the version the sheets ask for", async () => {
  for (const asset of ["book.css", "book.js"]) assert.ok((await stat(`public/view-from-somewhere/${asset}`)).size > 0, `${asset} must be published`);
  const script = `<script src="${ROUTE}/book.js?v=${book.assets}"></script>`;
  for (const name of ["contents.html", ...book.chapters.map(({ slug }) => `chapters/${slug}.html`)]) {
    assert.equal(sheet(name).split(script).length - 1, 1, `${name} must load the shared script once, at the exported version`);
  }
  const css = await readFile("public/view-from-somewhere/book.css", "utf8");
  assert.match(css, /--paper:/, "the style sheet defines the sheet's own paper and ink");
  assert.match(css, /@font-face/, "the style sheet carries the book's type");
  // The embedded type is a modified copy of Latin Modern; its notice and license travel with it.
  const notice = await readFile("public/view-from-somewhere/FONTS.txt", "utf8");
  assert.match(notice, /Latin Modern/);
  assert.match(notice, /GUST Font License/);
  assert.match(notice, /LaTeX Project Public License/);
});

test("the navigation registry, the site index, the breadcrumb trail and the site map know the book", async () => {
  // Like the three course texts, the book is a standalone route with a Course record in the command-K index.
  assert.ok(STANDALONE_ROUTES.includes(`${ROUTE}/`) && sitemapStaticRoutes().includes(`${ROUTE}/`), "the opening page is in the sitemap's static routes");
  assert.ok(![...PRIMARY, ...RECORDS, ...SECONDARY_PAGES].some(({ href }) => href === ROUTE), "the book has one record in the index, the Course record, and no Go record beside it");
  const index = await readFile("src/components/SiteIndex.astro", "utf8");
  const record = index.match(/\{ kind: "Course", code: "K-\d{4}-\d{2}", title: "([^"]+)", detail: "[^"]+", href: "\/view-from-somewhere\/" \}/);
  assert.ok(record, "the command-K index carries a Course record for the book");
  assert.equal(record[1], book.title);
  // The index record and the teaching record write the counts out; a new export must not leave them behind.
  const chapters = inWords(book.chapters.length), live = inWords(book.liveFigures);
  assert.ok(record[0].includes(`${chapters} chapters`), `the index record says how many chapters the book has (${chapters})`);
  const teaching = await readFile("src/content/teaching/view-from-somewhere.md", "utf8");
  assert.ok(teaching.toLowerCase().includes(`${chapters} chapters`), `the teaching record says how many chapters the book has (${chapters})`);
  assert.ok(teaching.toLowerCase().includes(`${live} figures are live`), `the teaching record says how many figures are live (${live})`);

  const first = book.chapters[0];
  assert.deepEqual(crumbsFor(chapterRoute(first), `${first.num}. ${first.title}`), [
    { label: "Teaching", href: "/teaching/" },
    { label: book.title, href: `${ROUTE}/` },
    { label: `${first.num}. ${first.title}`, href: null },
  ]);
  assert.deepEqual(crumbsFor(`${ROUTE}/`, book.title), [], "the opening page is one level deep and has no trail");

  assert.equal(LABELS[`${ROUTE}/`], book.title);
  // The committed site map is what the deployed site serves. Its chapter labels come from the export
  // when the map is regenerated, so a retitled chapter shows here until that is done.
  const map = JSON.parse(await readFile("public/field.json", "utf8"));
  const labels = new Map(map.nodes.map((node) => [node.id, node.label]));
  assert.equal(labels.get(`${ROUTE}/`), book.title, "the committed site map lists the book");
  for (const chapter of book.chapters) {
    const route = chapterRoute(chapter);
    assert.equal(labels.get(route), chapter.title, `public/field.json labels ${route} with the chapter's title; regenerate it (docs/view-from-somewhere.md)`);
    assert.ok(chapter.title.length <= 40, `${route}: the chapter title is the map label and must fit in 40 characters`);
    assert.deepEqual(topicsFor(route), ["teaching", "measurement"]);
    assert.equal(typeFor(route), "course");
  }
  assert.equal(map.nodes.filter((node) => node.id.startsWith(`${ROUTE}/`)).length, book.chapters.length + 1, "the committed site map lists the opening page and every chapter, and no page the book no longer has");
  assert.deepEqual(topicsFor(`${ROUTE}/`), ["teaching", "measurement"]);
  assert.ok(ROUTES.Student.steps.some(([route]) => route === `${ROUTE}/`), "the Student route passes through the book");
});

test("the layout renders the shared bar above the sheet and loads the site's tokens before the book's styles", async () => {
  const source = await readFile("src/layouts/ViewFromSomewhere.astro", "utf8");
  assert.ok(source.indexOf("<SiteBar") > 0 && source.indexOf("<SiteBar") < source.indexOf('<main id="main-content">'), "the shared bar comes before the page content");
  assert.doesNotMatch(source, /role="region"[^>]*>\s*<SiteBar/, "the bar is its own landmark and must not be wrapped in a second one");
  assert.match(source, /<Analytics \/>/, "book pages are counted like every other page");
  // Both style sheets define --ink, --paper and --rule. The sheet keeps its own only while the book's comes second.
  assert.doesNotMatch(source, /import\s+['"][^'"]*tokens\.css['"]/, "a plain import of tokens.css would be placed after the book's style sheet");
  const tokensAt = source.indexOf("set:html={siteTokens}");
  assert.ok(tokensAt > 0 && tokensAt < source.indexOf('<link rel="stylesheet" href={`/view-from-somewhere/book.css'), "the site's tokens are inlined before the book's style sheet");
  assert.match(source, /href=\{`\/view-from-somewhere\/book\.css\?v=\$\{book\.assets\}`\}/, "the style sheet is requested at the exported version");
  const pages = await readFile("src/pages/sitemap.xml.js", "utf8");
  assert.match(pages, /viewFromSomewhereChapters\(\)/, "the sitemap adds the chapters from the book's structure");
});
