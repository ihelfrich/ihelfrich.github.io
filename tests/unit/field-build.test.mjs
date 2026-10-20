import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { TOPIC_ORDER } from "../../src/data/field-topics.mjs";
import { buildField } from "../../scripts/build-field-data.mjs";

// These checks read the built site. They are skipped when dist/ has not been built yet.
const built = await access("dist/sitemap.xml").then(() => true, () => false);

test("field.json covers the sitemap, with valid links, topics, labels and routes", { skip: !built }, async () => {
  const data = await buildField();
  const ids = new Set(data.nodes.map((node) => node.id));
  assert.equal(ids.size, data.nodes.length, "node ids are unique");
  assert.ok(!ids.has("/field/"), "the map does not list itself");
  assert.ok(ids.has("/"), "the home page is the root of the graph");
  for (const [a, b] of data.links) {
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && a < b, "links are ordered index pairs");
    assert.ok(data.nodes[a] && data.nodes[b], "link indices point at nodes");
  }
  for (const node of data.nodes) {
    assert.ok(node.title.trim(), `${node.id} needs a title`);
    assert.ok(node.label.trim(), `${node.id} needs a label`);
    assert.ok(node.topics.length >= 1 && node.topics.every((t) => TOPIC_ORDER.includes(t)), `${node.id} needs known topics`);
  }
  const labels = data.nodes.map((node) => node.label);
  assert.equal(new Set(labels).size, labels.length, "map labels are unique");
  for (const [name, route] of Object.entries(data.routes)) {
    for (const [id] of route.steps) assert.ok(ids.has(id), `${name}: ${id} must be a page`);
  }
});

test("no page is left without a link to or from another page", { skip: !built }, async () => {
  const data = await buildField();
  assert.deepEqual(data.isolated, [], "every page should be reachable by a link inside page content");
});
