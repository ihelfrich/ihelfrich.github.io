export const PROPERTY_ATLAS_LIMIT = 10000;
export const PROPERTY_ATLAS_COLORS = Object.freeze(["#77cbd3", "#dae8b6", "#e39759", "#bb5279"]);
export const PROPERTY_ATLAS_UNKNOWN_COLOR = "#a0aab4";

/** Measure the main unobscured map rectangle from actual layout boxes. Thin
 * floating buttons are not treated as full-screen strips. Coordinates are CSS
 * pixels relative to the canvas; no geographic transform lives in UI code. */
export function propertyAtlasAvailableViewport(viewport, blockers = []) {
  if (!(viewport?.width > 0) || !(viewport?.height > 0)) return null;
  const width = viewport.width, height = viewport.height, x0 = viewport.left || 0, y0 = viewport.top || 0;
  let left = 0, top = 0, right = width, bottom = height;
  for (const rect of blockers) {
    if (!(rect?.width > 0) || !(rect?.height > 0)) continue;
    const x = Math.max(0, rect.left - x0), y = Math.max(0, rect.top - y0);
    const endX = Math.min(width, rect.left - x0 + rect.width), endY = Math.min(height, rect.top - y0 + rect.height);
    if (endX <= x || endY <= y) continue;
    if (endX - x >= width * (width <= 720 ? 0.35 : 0.55)) {
      if ((y + endY) / 2 < height / 2) top = Math.max(top, endY + 12);
      else bottom = Math.min(bottom, y - 12);
    } else if (endY - y >= height * 0.45) {
      if ((x + endX) / 2 < width / 2) left = Math.max(left, endX + 12);
      else right = Math.min(right, x - 12);
    }
  }
  if (right - left < 48 || bottom - top < 48) return null;
  return { left, top, width: right - left, height: bottom - top, fullWidth: width, fullHeight: height };
}

const finite = value => typeof value === "number" && Number.isFinite(value);
const hex = value => typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
const validDomain = value => Array.isArray(value) && value.length === 2 && value.every(finite) && value[0] <= value[1];

function gradientColor(ratio) {
  const step = Math.min(2, Math.floor(ratio * 3)), amount = ratio * 3 - step;
  const from = PROPERTY_ATLAS_COLORS[step], to = PROPERTY_ATLAS_COLORS[step + 1];
  return "#" + [1, 3, 5].map(i => Math.round(parseInt(from.slice(i, i + 2), 16) * (1 - amount) + parseInt(to.slice(i, i + 2), 16) * amount).toString(16).padStart(2, "0")).join("");
}
// Avoid repeated hex parsing and string allocation for every map update. All
// four CSS-legend stops are represented exactly in this fixed linear ramp.
const gradient = Array.from({ length: 769 }, (_, index) => gradientColor(index / 768));

/** Linear, shared color mapping. Missing values stay distinct from a recorded zero. */
export function propertyAtlasColor(value, domain) {
  if (!finite(value) || !validDomain(domain)) return PROPERTY_ATLAS_UNKNOWN_COLOR;
  const ratio = domain[0] === domain[1] ? 0.5 : Math.max(0, Math.min(1, (value - domain[0]) / (domain[1] - domain[0])));
  return gradient[Math.round(ratio * 768)];
}

/**
 * Renderer input, not a data loader or a comparable-sales filter. The caller
 * supplies either exact records or explicitly identified aggregate cells.
 * Original feature objects and their recordKey/parcelKey are never rewritten.
 * More than 10,000 unique valid features produces an explicit partial status;
 * callers should aggregate before that limit, rather than imply full coverage.
 */
export function preparePropertyAtlas(input = {}) {
  const features = Array.isArray(input?.features) ? input.features : [];
  const items = [], seen = new Set();
  let invalid = 0, duplicates = 0, truncated = 0, minimum = Infinity, maximum = -Infinity;
  for (const feature of features) {
    const id = feature?.id ?? feature?.recordKey;
    if (typeof id !== "string" || !id.trim() || !finite(feature?.longitude) || !finite(feature?.latitude) ||
      Math.abs(feature.longitude) > 180 || Math.abs(feature.latitude) > 90) { invalid++; continue; }
    if (seen.has(id)) { duplicates++; continue; }
    seen.add(id);
    if (items.length === PROPERTY_ATLAS_LIMIT) { truncated++; continue; }
    const value = finite(feature.value) ? feature.value : null;
    if (value !== null) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
    items.push({ feature, id, longitude: feature.longitude, latitude: feature.latitude, value,
      pixelSize: finite(feature.pixelSize) ? Math.max(3, Math.min(40, feature.pixelSize)) : feature.kind === "cell" ? 14 : 7,
      heightMetres: finite(feature.heightMetres) ? feature.heightMetres : 0 });
  }
  const domain = validDomain(input?.domain) ? [...input.domain] : minimum !== Infinity ? [minimum, maximum] : null;
  for (const item of items) item.color = hex(item.feature.color) ? item.feature.color : propertyAtlasColor(item.value, domain);
  return { items, onSelect: typeof input?.onSelect === "function" ? input.onSelect : () => {},
    status: { status: truncated || invalid || duplicates ? "partial" : items.length ? "shown" : "cleared",
      shown: items.length, inputCount: features.length, invalid, duplicates, truncated, domain } };
}
