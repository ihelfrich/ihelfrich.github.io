const BASE = "/st-louis/street-labels";
const MAX_BYTES = 768 * 1024;
const MAX_LABELS = 10000;
const validBounds = value => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && value[0] <= value[2] && value[1] <= value[3];
const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const abortError = () => Object.assign(new Error("Street-label request cancelled."), { name: "AbortError" });

export function streetLabelPlan(manifest, bounds, budget = 16) {
  if (!validBounds(bounds) || !Array.isArray(manifest?.tiles)) return { level: "empty", tiles: [] };
  const tiles = manifest.tiles.filter(tile => overlaps(tile.bounds, bounds));
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  if (span > 14000 || tiles.length > Math.min(16, Math.max(0, budget)))
    return { level: "overview", tiles: [] };
  return { level: "detail", tiles };
}

export function selectStreetLabels(labels, bounds, limit = 240) {
  if (!validBounds(bounds)) return [];
  const cx = (bounds[0] + bounds[2]) / 2, cz = (bounds[1] + bounds[3]) / 2;
  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  const rank = span > 45000 ? 1 : span > 14000 ? 2 : span > 5000 ? 3 : span > 1600 ? 4 : 6;
  return labels.filter(label => label.priority <= rank && label.x >= bounds[0] && label.x <= bounds[2] && label.z >= bounds[1] && label.z <= bounds[3])
    .sort((a, b) => a.priority - b.priority || Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz) || a.id.localeCompare(b.id))
    .slice(0, Math.min(240, Math.max(0, limit)));
}

/** CSS-pixel collision pass; labels are already in stable road-priority order. */
export function thinStreetLabels(labels, { width, height, limit = 56 } = {}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || limit <= 0) return [];
  const accepted = [];
  for (const label of labels) {
    if (!Number.isFinite(label.screenX) || !Number.isFinite(label.screenY)) continue;
    const w = Math.min(1200, label.name.length * 7.3 + 20), h = 25;
    const box = [label.screenX - w / 2, label.screenY - h / 2, label.screenX + w / 2, label.screenY + h / 2];
    // Keep the provider attribution and lower map controls free of street text.
    if (box[0] < 12 || box[2] > width - 12 || box[1] < 26 || box[3] > height - 80) continue;
    if (accepted.some(other => overlaps([box[0] - 10, box[1] - 8, box[2] + 10, box[3] + 8], other.box) ||
      (other.name === label.name && Math.hypot(other.screenX - label.screenX, other.screenY - label.screenY) < 240))) continue;
    accepted.push({ ...label, box });
    if (accepted.length >= Math.min(56, Math.max(0, limit))) break;
  }
  return accepted;
}

function normalizeLabels(data) {
  if (data?.version !== 1 || !Array.isArray(data.labels) || data.labels.length > MAX_LABELS) throw new Error("Invalid label tile.");
  const seen = new Set();
  return data.labels.map(label => {
    if (typeof label?.id !== "string" || label.id.length > 100 || seen.has(label.id) ||
        typeof label.name !== "string" || !label.name.trim() || label.name.length > 160 || /[\u0000-\u001f\u007f]/u.test(label.name) ||
        !Number.isFinite(label.x) || Math.abs(label.x) > 200000 || !Number.isFinite(label.z) || Math.abs(label.z) > 200000 ||
        !Number.isInteger(label.priority) || label.priority < 0 || label.priority > 6) throw new Error("Invalid label anchor.");
    seen.add(label.id);
    return { id: label.id, name: label.name, x: label.x, z: label.z, priority: label.priority };
  });
}

function normalizeManifest(value) {
  if (value?.version !== 1 || value.units !== "meters" || value.origin?.[0] !== -90.193 || value.origin?.[1] !== 38.628 ||
      !Array.isArray(value.tiles) || value.tiles.length > 600) throw new Error("Invalid label manifest.");
  const seen = new Set();
  const tiles = value.tiles.map(tile => {
    if (!/^-?\d{1,3}_-?\d{1,3}$/u.test(tile?.id || "") || seen.has(tile.id) || !validBounds(tile.bounds) ||
        !tile.bounds.every(number => Math.abs(number) <= 200000) || !Number.isInteger(tile.bytes) || tile.bytes < 1 || tile.bytes > MAX_BYTES)
      throw new Error("Invalid label tile index.");
    seen.add(tile.id);
    return { id: tile.id, bounds: tile.bounds, bytes: tile.bytes };
  });
  return { tiles, source: { name: "OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright",
    snapshot: typeof value.source?.osmSnapshotTimestamp === "string" ? value.source.osmSnapshotTimestamp.slice(0, 40) : null } };
}

/** Local static data only; bounded requests, concurrency, deadline, and LRU. */
export function createStreetLabelLoader({ fetchImpl = globalThis.fetch, timeoutMs = 10000, maxCachedTiles = 24 } = {}) {
  let manifest = null, overview = null, disposed = false;
  const cache = new Map(), requests = new Set();
  const cacheLimit = Math.min(24, Math.max(1, Math.floor(maxCachedTiles) || 24));
  async function read(url, signal) {
    if (disposed || signal?.aborted) throw abortError();
    const controller = new AbortController();
    requests.add(controller);
    let timer, rejectBoundary;
    const boundary = new Promise((_, reject) => { rejectBoundary = reject; });
    const cancel = () => { controller.abort(); rejectBoundary(abortError()); };
    signal?.addEventListener("abort", cancel, { once: true });
    controller.signal.addEventListener("abort", () => rejectBoundary(abortError()), { once: true });
    timer = setTimeout(cancel, timeoutMs);
    const work = (async () => {
      const response = await fetchImpl(url, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error("Street-label source unavailable.");
      if (Number(response.headers?.get("content-length")) > MAX_BYTES) throw new Error("Street-label response too large.");
      let content;
      if (response.body?.getReader) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let bytes = 0; content = "";
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > MAX_BYTES) { void reader.cancel(); throw new Error("Street-label response too large."); }
            content += decoder.decode(part.value, { stream: true });
          }
          content += decoder.decode();
        } finally { reader.releaseLock(); }
      } else {
        content = await response.text();
        if (new TextEncoder().encode(content).byteLength > MAX_BYTES) throw new Error("Street-label response too large.");
      }
      if (controller.signal.aborted || disposed) throw abortError();
      return JSON.parse(content);
    })();
    try { return await Promise.race([work, boundary]); }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); requests.delete(controller); }
  }
  async function load(bounds, { signal } = {}) {
    if (disposed || signal?.aborted) throw abortError();
    if (!validBounds(bounds)) return { status: "unavailable", labels: [], reason: "The camera view is unavailable." };
    try {
      if (!manifest) manifest = normalizeManifest(await read(`${BASE}/manifest.json`, signal));
      const plan = streetLabelPlan(manifest, bounds);
      let labels = [], failures = 0;
      if (plan.level === "overview") {
        if (!overview) overview = normalizeLabels(await read(`${BASE}/overview.json`, signal));
        labels = overview;
      } else {
        let cursor = 0;
        const rows = new Array(plan.tiles.length);
        await Promise.all(Array.from({ length: Math.min(4, plan.tiles.length) }, async () => {
          while (cursor < plan.tiles.length) {
            const index = cursor++, tile = plan.tiles[index];
            if (signal?.aborted || disposed) throw abortError();
            try {
              let value = cache.get(tile.id);
              if (value) cache.delete(tile.id);
              else value = normalizeLabels(await read(`${BASE}/tiles/${tile.id}.json`, signal));
              cache.set(tile.id, value);
              while (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
              rows[index] = value;
            } catch (error) {
              if (signal?.aborted || disposed) throw abortError();
              failures++; rows[index] = [];
            }
          }
        }));
        labels = rows.flat();
      }
      if (signal?.aborted || disposed) throw abortError();
      const unique = [...new Map(labels.map(label => [label.id, label])).values()];
      return { status: failures ? (unique.length ? "partial" : "unavailable") : "ready",
        labels: selectStreetLabels(unique, bounds), level: plan.level, source: manifest.source,
        reason: failures ? "Some local street-label tiles could not load." : null };
    } catch (error) {
      if (signal?.aborted || disposed) throw abortError();
      return { status: "unavailable", labels: [], reason: "Street names could not load. The photographic map is still available." };
    }
  }
  return { load, dispose() { disposed = true; for (const request of requests) request.abort(); requests.clear(); cache.clear(); manifest = null; overview = null; } };
}
