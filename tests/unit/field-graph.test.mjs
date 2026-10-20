import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGraph, bfs, maxHop, shortest, hopLevel, ringRadii, withinHops, parentRoute,
  authorList, byline, reference, groupLinked, searchRank, stepThrough,
} from "../../src/lib/field-graph.mjs";

const ids = ["/", "/a/", "/b/", "/c/", "/d/", "/lonely/"];
const links = [
  { source: "/", target: "/a/" },
  { source: "/", target: "/b/" },
  { source: "/a/", target: "/c/" },
  { source: "/c/", target: "/d/" },
];
const { adj, deg } = buildGraph(ids, links);

test("graph building counts degrees and keeps links symmetric", () => {
  assert.deepEqual(deg, { "/": 2, "/a/": 2, "/b/": 1, "/c/": 2, "/d/": 1 });
  assert.ok(adj.get("/a/").has("/") && adj.get("/").has("/a/"));
  assert.equal(adj.get("/lonely/").size, 0);
});

test("bfs gives hop counts and omits unreachable pages", () => {
  const home = bfs(adj, "/");
  assert.deepEqual(home, { "/": 0, "/a/": 1, "/b/": 1, "/c/": 2, "/d/": 3 });
  assert.equal(home["/lonely/"], undefined);
  assert.equal(maxHop({ ...home, __s: "/" }), 3);
});

test("shortest returns the chain of ids, or null when no chain exists", () => {
  assert.deepEqual(shortest(adj, "/b/", "/d/"), ["/b/", "/", "/a/", "/c/", "/d/"]);
  assert.deepEqual(shortest(adj, "/a/", "/a/"), ["/a/"]);
  assert.equal(shortest(adj, "/a/", "/lonely/"), null);
});

test("hop levels and ring radii place home at the center and unreachable pages outermost", () => {
  const home = bfs(adj, "/");
  assert.equal(hopLevel("/", home, 3), 0);
  assert.equal(hopLevel("/lonely/", home, 3), 4);
  const radii = ringRadii(ids, home, 3, 100);
  assert.equal(radii[0], 0);
  assert.equal(radii.at(-1), 100);
  for (let i = 1; i < radii.length; i += 1) assert.ok(radii[i] >= radii[i - 1] + 9, "rings keep a minimum gap");
  assert.equal(withinHops(ids, home, 2), 4);
});

test("parent routes fall back to the nearest existing ancestor", () => {
  const has = (route) => ["/", "/research/"].includes(route);
  assert.equal(parentRoute("/research/paper/", has), "/research/");
  assert.equal(parentRoute("/research/a/b/", has), "/research/");
  assert.equal(parentRoute("/contact/", has), "/");
});

test("bylines and references read like citations", () => {
  assert.equal(authorList(["A"]), "A");
  assert.equal(authorList(["A", "B"]), "A and B");
  assert.equal(authorList(["A", "B", "C"]), "A, B, and C");
  const paper = { type: "paper", title: "Short", full: "A Full Title", meta: { authors: ["Elizaveta Gonchar", "Ian Helfrich"], year: "2025", status: "preprint" } };
  assert.equal(byline(paper.meta), "Elizaveta Gonchar and Ian Helfrich, 2025. Preprint.");
  assert.equal(reference(paper, "https://x/y/"), "Elizaveta Gonchar and Ian Helfrich (2025). A Full Title. Preprint. https://x/y/");
  assert.equal(reference({ type: "page", title: "CV", meta: null }, "https://x/cv/"), "CV. https://x/cv/");
  assert.equal(byline(null), "");
});

test("linked pages are grouped by type with specific pages before hubs", () => {
  const nodes = [
    { id: "/p1/", type: "paper", title: "P1" },
    { id: "/hub/", type: "page", title: "Hub" },
    { id: "/p2/", type: "page", title: "P2" },
  ];
  const degrees = { "/p1/": 3, "/hub/": 40, "/p2/": 5 };
  const groups = groupLinked(nodes, degrees, [["paper", "Papers"], ["data", "Data"], ["page", "Other pages"]]);
  assert.deepEqual(groups.map((g) => g.label), ["Papers", "Other pages"]);
  assert.deepEqual(groups[1].items.map((n) => n.id), ["/p2/", "/hub/"]);
});

test("search ranks label matches first, then titles, then descriptions", () => {
  const nodes = [
    { id: "/a/", title: "Penumbra", full: "Penumbra: closed-loop observation", desc: "" },
    { id: "/b/", title: "Measurement", full: "Measurement", desc: "mentions penumbra here" },
    { id: "/c/", title: "The penumbra lab", full: "The penumbra lab", desc: "" },
    { id: "/d/", title: "Other", full: "Other", desc: "nothing" },
  ];
  const result = searchRank(nodes, { "/a/": 1, "/b/": 9, "/c/": 1 }, "Penumbra").map((n) => n.id);
  assert.deepEqual(result, ["/a/", "/c/", "/b/"]);
  assert.deepEqual(searchRank(nodes, {}, "  "), []);
});

test("stepping through a list wraps in both directions", () => {
  assert.equal(stepThrough(["a", "b", "c"], "c", 1), "a");
  assert.equal(stepThrough(["a", "b", "c"], "a", -1), "c");
  assert.equal(stepThrough(["a", "b"], "zzz", 1), "a");
  assert.equal(stepThrough([], "a", 1), null);
});
