import test from "node:test";
import assert from "node:assert/strict";
import { OVERRIDES, ROUTES, TOPIC_ORDER, topicsFor, typeFor } from "../../src/data/field-topics.mjs";
import { extractPage } from "../../scripts/build-field-data.mjs";

test("every hand-set topic list uses known topics and has at least one", () => {
  for (const [route, topics] of Object.entries(OVERRIDES)) {
    assert.match(route, /^\/([a-z0-9-]+\/)*$/, `${route} must be a route with a trailing slash`);
    assert.ok(topics.length > 0, `${route} needs a topic`);
    for (const topic of topics) assert.ok(TOPIC_ORDER.includes(topic), `${route}: unknown topic ${topic}`);
  }
});

test("pages without a hand-set tag still get a provisional topic", () => {
  assert.deepEqual(topicsFor("/research/a-new-trade-paper/", "A new gravity paper", ""), ["trade"]);
  assert.deepEqual(topicsFor("/something-else/", "Untitled", ""), ["profile"]);
});

test("page types follow the route", () => {
  assert.equal(typeFor("/research/x/"), "paper");
  assert.equal(typeFor("/research/"), "page");
  assert.equal(typeFor("/datasets/x/"), "data");
  assert.equal(typeFor("/hidden-rivers/"), "tool");
  assert.equal(typeFor("/econometrics/01-argument/"), "course");
});

test("every route has a summary and at least three stops", () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    assert.ok(route.summary.trim(), `${name} needs a summary`);
    assert.ok(route.steps.length >= 3, `${name} needs at least three stops`);
    for (const [id, caption] of route.steps) {
      assert.match(id, /^\/([a-z0-9-]+\/)*$/);
      assert.ok(caption.trim(), `${name}: ${id} needs a caption`);
    }
  }
});

test("link extraction reads main content only and normalises paths", () => {
  const html = `<html><head><title>Research | Ian Helfrich, PhD</title><meta name="description" content="Papers &amp; data"></head>
    <body><header><a href="/contact">Contact</a></header>
    <main id="main-content"><a href="/datasets#top">Data</a><a href="/research/x/?a=1">X</a><a href="https://example.org/">Out</a><a href="//cdn.example.org/">Cdn</a></main>
    <footer><a href="/cv">CV</a></footer></body></html>`;
  const page = extractPage(html);
  assert.equal(page.title, "Research");
  assert.equal(page.description, "Papers & data");
  assert.deepEqual(page.hrefs, ["/datasets/", "/research/x/"]);
});

test("link extraction leaves out elements marked data-field-skip, nested or not", () => {
  const html = `<main><a href="/a">A</a><details class="all" data-field-skip><summary>All</summary>
    <details><summary>Inner</summary><a href="/b">B</a></details><a href="/c">C</a></details>
    <a href="/d">D</a><div data-field-skip><div><a href="/e">E</a></div></div><a href="/f">F</a></main>`;
  assert.deepEqual(extractPage(html).hrefs, ["/a/", "/d/", "/f/"]);
});

test("every short label is for a route and stays short", async () => {
  const { LABELS, labelFor } = await import("../../src/data/field-topics.mjs");
  for (const [route, label] of Object.entries(LABELS)) {
    assert.match(route, /^\/([a-z0-9-]+\/)*$/, `${route} must be a route with a trailing slash`);
    assert.ok(label.length <= 40, `${route}: label is longer than 40 characters`);
  }
  assert.equal(labelFor("/research/", "Research | Ian"), "Research");
  assert.equal(labelFor("/new-page/", "A new page"), "A new page");
  assert.equal(new Set(Object.values(LABELS)).size, Object.keys(LABELS).length, "labels must be unique so the map is unambiguous");
});
