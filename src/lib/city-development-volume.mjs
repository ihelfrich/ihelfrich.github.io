import { parcelGeometryBounds } from "./city-parcels.mjs";

export const DEVELOPMENT_VOLUME_LIMITS = Object.freeze({ polygons: 16, rings: 64, vertices: 4096 });
const unavailable = (reason, message) => ({ status: "unavailable", reason, message });

/** Validate and copy the exact parcel rings. No setback, coverage or footprint inference. */
export function developmentVolume(value) {
  if (value == null) return { status: "cleared" };
  const { parcel, stories, floorHeightMetres } = value;
  if (!Number.isInteger(stories) || stories < 1 || stories > 100)
    return unavailable("invalid-stories", "Choose 1–100 whole stories for the height study.");
  if (!Number.isFinite(floorHeightMetres) || floorHeightMetres < 2 || floorHeightMetres > 6)
    return unavailable("invalid-floor-height", "Choose a floor height between 2 and 6 metres.");
  if (parcel?.properties?.geometryStatus === "invalid-source")
    return unavailable("invalid-source-geometry", "The source parcel geometry cannot support a height study.");
  const geometry = parcel?.geometry;
  const parts = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : null;
  if (!Array.isArray(parts) || !parts.length)
    return unavailable("invalid-parcel", "Select a parcel with valid polygon geometry.");
  if (parts.length > DEVELOPMENT_VOLUME_LIMITS.polygons)
    return unavailable("geometry-limit", "This parcel exceeds the bounded height-study geometry limit.");
  let rings = 0, vertices = 0;
  for (const part of parts) {
    if (!Array.isArray(part) || !part.length)
      return unavailable("invalid-parcel", "The parcel contains an empty polygon.");
    rings += part.length;
    if (rings > DEVELOPMENT_VOLUME_LIMITS.rings)
      return unavailable("geometry-limit", "This parcel exceeds the bounded height-study geometry limit.");
    for (const ring of part) {
      if (!Array.isArray(ring)) return unavailable("invalid-parcel", "The parcel contains an invalid ring.");
      vertices += ring.length;
      if (vertices > DEVELOPMENT_VOLUME_LIMITS.vertices)
        return unavailable("geometry-limit", "This parcel exceeds the bounded height-study geometry limit.");
    }
  }
  let bounds;
  try { bounds = parcelGeometryBounds(geometry); }
  catch { return unavailable("invalid-parcel", "The parcel coordinates are invalid or its rings are not closed."); }
  for (const part of parts) for (const ring of part) {
    // Local differences avoid cancellation at longitude/latitude magnitudes.
    const [x, y] = ring[0];
    let twiceArea = 0;
    for (let i = 1; i < ring.length; i++)
      twiceArea += (ring[i - 1][0] - x) * (ring[i][1] - y) - (ring[i][0] - x) * (ring[i - 1][1] - y);
    if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) < 1e-16)
      return unavailable("invalid-parcel", "The parcel contains a degenerate ring.");
  }
  return {
    status: "ready", stories, floorHeightMetres, heightMetres: stories * floorHeightMetres,
    recordKey: parcel?.properties?.recordKey ?? null,
    bounds, vertexCount: vertices,
    polygons: parts.map(part => part.map(ring => ring.map(position => [...position]))),
  };
}
