// Walking distances in metres on a fixed OSM snapshot. Rendering never changes this graph.
const adjacencyCache = new WeakMap();
function adjacency(graph) {
  if (adjacencyCache.has(graph)) return adjacencyCache.get(graph);
  const a = graph.nodes.map(() => []);
  for (const [u, v, w] of graph.edges) {
    if (
      !Number.isInteger(u) ||
      !Number.isInteger(v) ||
      !a[u] ||
      !a[v] ||
      !Number.isFinite(w) ||
      w < 0
    )
      throw new RangeError("Invalid walking edge");
    a[u].push([v, w]);
    a[v].push([u, w]);
  }
  adjacencyCache.set(graph, a);
  return a;
}
export function shortestPaths(graph, start) {
  const a = adjacency(graph),
    distance = Array(a.length).fill(Infinity),
    previous = Array(a.length).fill(-1),
    heap = [];
  function push(item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= item[0]) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = item;
  }
  function pop() {
    const first = heap[0],
      last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (2 * i + 1 < heap.length) {
        let k = 2 * i + 1;
        if (k + 1 < heap.length && heap[k + 1][0] < heap[k][0]) k++;
        if (heap[k][0] >= last[0]) break;
        heap[i] = heap[k];
        i = k;
      }
      heap[i] = last;
    }
    return first;
  }
  if (Number.isInteger(start) && a[start]) {
    distance[start] = 0;
    push([0, start]);
  }
  while (heap.length) {
    const [d, u] = pop();
    if (d !== distance[u]) continue;
    for (const [v, w] of a[u])
      if (d + w < distance[v]) {
        distance[v] = d + w;
        previous[v] = u;
        push([d + w, v]);
      }
  }
  return {
    distance,
    pathTo(end) {
      if (!Number.isInteger(end) || !Number.isFinite(distance[end])) return [];
      const path = [];
      for (let v = end; v !== -1; v = previous[v]) path.push(v);
      return path.reverse();
    },
  };
}
export function walkingComparison(
  graph,
  origin,
  pois,
  budgetSeconds = 900,
  speed = 1.3,
) {
  if (
    !Number.isFinite(speed) ||
    speed <= 0 ||
    !Number.isFinite(budgetSeconds) ||
    budgetSeconds < 0
  )
    throw new RangeError("Invalid walking assumptions");
  const paths = shortestPaths(graph, origin?.nodeIndex);
  const startSnap =
    Number.isFinite(origin?.snapMeters) && origin.snapMeters >= 0
      ? origin.snapMeters
      : 0;
  const places = pois
    .map((p) => {
      const d = Number.isInteger(p.nodeIndex)
        ? paths.distance[p.nodeIndex]
        : Infinity;
      const snap =
        Number.isFinite(p.snapMeters) && p.snapMeters >= 0 ? p.snapMeters : 0;
      const meters = d + startSnap + snap;
      return {
        ...p,
        meters,
        seconds: meters / speed,
        path: paths.pathTo(p.nodeIndex),
      };
    })
    .sort((a, b) => a.seconds - b.seconds);
  return {
    places,
    reachable: places.filter((p) => p.seconds <= budgetSeconds),
    distance: paths.distance,
    paths,
  };
}
export function encodeCityState(state) {
  return "#city=" + encodeURIComponent(JSON.stringify(state));
}
export function decodeCityState(hash) {
  try {
    if (!hash.startsWith("#city=") || hash.length > 3000) return null;
    const s = JSON.parse(decodeURIComponent(hash.slice(6)));
    if (
      s.v !== 1 ||
      typeof s.data !== "string" ||
      s.data.length > 100 ||
      !Number.isFinite(s.minutes) ||
      s.minutes < 5 ||
      s.minutes > 30 ||
      !Number.isFinite(s.light) ||
      s.light < 6 ||
      s.light > 22 ||
      !["city", "network"].includes(s.layer)
    )
      return null;
    if (
      s.destination !== undefined &&
      s.destination !== null &&
      (typeof s.destination !== "string" || s.destination.length > 120)
    )
      return null;
    if (
      [s.a, s.b].some(
        (v) => v !== null && (typeof v !== "string" || v.length > 120),
      )
    )
      return null;
    return {
      v: 1,
      data: s.data,
      a: s.a,
      b: s.b,
      minutes: s.minutes,
      light: s.light,
      layer: s.layer,
      ...(s.destination !== undefined ? { destination: s.destination } : {}),
    };
  } catch {
    return null;
  }
}
