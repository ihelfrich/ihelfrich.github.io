import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shortestPaths,
  walkingComparison,
  decodeCityState,
  encodeCityState,
} from "../../src/lib/city-analysis.mjs";
const graph = {
  nodes: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
    [500, 500],
  ],
  edges: [
    [0, 1, 100],
    [1, 2, 100],
    [2, 3, 100],
  ],
};
test("walking follows connected streets, never an apparent geometric shortcut", () => {
  const r = shortestPaths(graph, 0);
  assert.equal(r.distance[3], 300);
  assert.deepEqual(r.pathTo(3), [0, 1, 2, 3]);
});
test("disconnected destinations stay unreachable", () => {
  const r = shortestPaths(graph, 0);
  assert.equal(r.distance[4], Infinity);
  assert.deepEqual(r.pathTo(4), []);
});
test("comparison includes both entrance offsets at a declared walking speed", () => {
  const r = walkingComparison(
    graph,
    { nodeIndex: 0, snapMeters: 10 },
    [{ id: "park", nodeIndex: 2, snapMeters: 30 }],
    240,
    1,
  );
  assert.equal(r.places[0].seconds, 240);
  assert.equal(r.reachable.length, 1);
  assert.equal(
    walkingComparison(
      graph,
      { nodeIndex: 0, snapMeters: 10 },
      [{ id: "park", nodeIndex: 2, snapMeters: 30 }],
      239,
      1,
    ).reachable.length,
    0,
  );
});
test("missing graph attachment never becomes a zero-minute journey", () => {
  const r = walkingComparison(
    graph,
    { nodeIndex: null },
    [{ id: "x", nodeIndex: 0, snapMeters: 0 }],
    900,
    1.3,
  );
  assert.equal(r.reachable.length, 0);
});
test("rejects negative graph lengths and invalid travel speeds", () => {
  assert.throws(() =>
    shortestPaths({ nodes: graph.nodes, edges: [[0, 1, -1]] }, 0),
  );
  assert.throws(() => walkingComparison(graph, { nodeIndex: 0 }, [], 900, 0));
});
test("shared state round-trips analytical parameters and source version", () => {
  const s = {
    v: 1,
    data: "osm-2026-09-08",
    a: "node/1",
    b: "node/2",
    minutes: 15,
    light: 17,
    layer: "city",
  };
  assert.deepEqual(decodeCityState(encodeCityState(s)), s);
});
test("malformed or out-of-range URLs use explicit safe defaults", () => {
  assert.equal(decodeCityState("#city=not-json"), null);
  assert.equal(
    decodeCityState(
      "#city=" +
        encodeURIComponent(
          JSON.stringify({ v: 1, data: "x", minutes: -10, light: 50 }),
        ),
    ),
    null,
  );
});

test("shared comparison preserves the selected destination route", () => {
  const s = {
    v: 1,
    data: "osm-2026-09-08",
    a: "n1",
    b: "n2",
    destination: "w15",
    minutes: 15,
    light: 17,
    layer: "city",
  };
  assert.deepEqual(decodeCityState(encodeCityState(s)), s);
});
test("a midnight light study can be shared without losing its environment mode", () => {
  const s = {
    v: 1,
    data: "osm",
    a: "n1",
    b: "n2",
    minutes: 15,
    light: 0,
    layer: "city",
    environment: "study",
  };
  assert.deepEqual(decodeCityState(encodeCityState(s)), s);
});
