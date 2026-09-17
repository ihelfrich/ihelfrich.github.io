export function selectRegionTiles(tiles, view, limit = 16) {
  if (!Array.isArray(view) || view.length !== 4 || !view.every(Number.isFinite))
    return [];
  const [x0, z0, x1, z1] = view,
    cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2;
  return tiles
    .filter((t) => {
      const b = t.bounds;
      return b && b[0] <= x1 && b[2] >= x0 && b[1] <= z1 && b[3] >= z0;
    })
    .sort((a, b) => {
      const distance = (t) => {
        const q = t.gridBounds || t.bounds;
        return Math.hypot((q[0] + q[2]) / 2 - cx, (q[1] + q[3]) / 2 - cz);
      };
      return distance(a) - distance(b) || a.id.localeCompare(b.id);
    })
    .slice(0, Math.max(0, limit));
}
export const regionLevel = (zoom) =>
  zoom < 0.075 ? "overview" : zoom < 0.45 ? "district" : "detail";

export function regionRequestPlan(tiles, view, zoom, budget = 16) {
  const candidates = selectRegionTiles(tiles, view, Infinity);
  const requestedLevel = regionLevel(zoom);
  const level = candidates.length > Math.max(0, budget)
    ? "overview"
    : requestedLevel;
  return {
    level,
    tiles: level === "overview" ? [] : candidates,
    visibleTileCount: candidates.length,
  };
}

// A tiny southward component avoids the lookAt singularity while keeping north up.
export function regionViewDirection(zoom, current = [1950, 1065, 1560]) {
  const length = Math.hypot(...current);
  let direction = current.map(value => value / length);
  if (regionLevel(zoom) === "overview") direction = [0, 1, .001];
  else if (!Number.isFinite(length) || length === 0 || direction[1] > .95)
    direction = [1950, 1065, 1560];
  const magnitude = Math.hypot(...direction);
  return direction.map(value => value / magnitude);
}
