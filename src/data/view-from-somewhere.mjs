// The View from Somewhere, a textbook set from its LaTeX source.
//
// The book is written and built in its own project. That build exports the pieces this site
// needs: src/data/view-from-somewhere/book.json (structure), contents.html and one file per
// chapter in chapters/ (each page's printed sheet with its figures and scripts), and the shared
// style sheet and script in public/view-from-somewhere/. Nothing in those files is edited here;
// docs/view-from-somewhere.md describes how to refresh them.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve("src/data/view-from-somewhere");

export const ROUTE = "/view-from-somewhere";

/** The exported structure of the book: title, parts, and one record per chapter. */
export const book = Object.freeze(JSON.parse(readFileSync(resolve(directory, "book.json"), "utf8")));

/** The route of a chapter, with the trailing slash GitHub Pages serves without a redirect. */
export const chapterRoute = ({ slug }) => `${ROUTE}/${slug}/`;

/** Every chapter route in reading order, for the sitemap. */
export const chapterRoutes = () => book.chapters.map(chapterRoute);

/** One exported sheet: "contents.html" or "chapters/<slug>.html". */
export const sheet = (name) => readFileSync(resolve(directory, name), "utf8");
