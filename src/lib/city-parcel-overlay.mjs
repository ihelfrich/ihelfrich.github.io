/** Keep polygon parts and holes as separate closed outlines. */
export function parcelOutlineRings(feature) {
  const g=feature?.geometry;
  const parts=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
  if(!Array.isArray(parts))return [];
  return parts.flatMap(part=>Array.isArray(part)?part:[]).filter(ring=>Array.isArray(ring)&&ring.length>=4&&ring.every(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90));
}
