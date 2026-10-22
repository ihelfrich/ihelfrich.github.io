// Collision-aware placement for the section labels in the home page network.
// Each label tries a short list of positions around its own mark and keeps the one that
// covers the fewest other marks, earlier labels and fixed boxes (topic and Home labels).
// The previous position wins ties, so labels do not flicker while the simulation settles.

// Text metrics for 11.5px Geist: the box runs from the cap height to the descender plus the halo.
const ASCENT = 10;
const DESCENT = 4;
const HALO = 2;
const MARK_COST = 1;
const BOX_COST = 4;
const OUTSIDE_COST = 10;
const KEEP_BONUS = 0.5;

export const LABEL_POSITIONS = Object.freeze([
  "right", "left", "above", "below", "upper-right", "lower-right", "upper-left", "lower-left",
]);

/** Text anchor, offset from the mark centre to the text origin, and baseline for one position. */
export function labelOffset(position, r) {
  switch (position) {
    case "left": return { anchor: "end", dx: -(r + 6), dy: 4 };
    case "above": return { anchor: "middle", dx: 0, dy: -(r + 6) };
    case "below": return { anchor: "middle", dx: 0, dy: r + 14 };
    case "upper-right": return { anchor: "start", dx: r + 3, dy: -(r + 3) };
    case "lower-right": return { anchor: "start", dx: r + 3, dy: r + 12 };
    case "upper-left": return { anchor: "end", dx: -(r + 3), dy: -(r + 3) };
    case "lower-left": return { anchor: "end", dx: -(r + 3), dy: r + 12 };
    default: return { anchor: "start", dx: r + 6, dy: 4 };
  }
}

/** The box a label of `width` occupies at `position` around a mark at (x, y) with radius r. */
export function labelBox(position, { x, y, r, width }) {
  const { anchor, dx, dy } = labelOffset(position, r);
  const tx = x + dx;
  const baseline = y + dy;
  const left = anchor === "start" ? tx : anchor === "end" ? tx - width : tx - width / 2;
  return { x0: left - HALO, y0: baseline - ASCENT, x1: left + width + HALO, y1: baseline + DESCENT, anchor, x: tx, y: baseline };
}

export const boxesOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function boxHitsMark(box, { x, y, r }) {
  const nx = Math.max(box.x0, Math.min(x, box.x1));
  const ny = Math.max(box.y0, Math.min(y, box.y1));
  return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
}

/**
 * Place every label in order.
 * labels:    [{ id, x, y, r, width }]  r is the mark's outer radius (ring included)
 * marks:     [{ id, x, y, r }]         every drawn mark; a label ignores its own
 * obstacles: [{ x0, y0, x1, y1 }]      fixed boxes, such as the topic labels
 * bounds:    { x0, y0, x1, y1 }        the drawing area
 * previous:  Map(id -> position)       last placement; updated in place
 * Returns Map(id -> box with its position, anchor and text origin).
 */
export function placeLabels(labels, { marks = [], obstacles = [], bounds, previous = new Map() } = {}) {
  const placed = new Map();
  const taken = [...obstacles];
  for (const label of labels) {
    let best = null;
    LABEL_POSITIONS.forEach((position, order) => {
      const box = labelBox(position, label);
      let cost = order * 0.01;
      for (const mark of marks) if (mark.id !== label.id && boxHitsMark(box, mark)) cost += MARK_COST;
      for (const other of taken) if (boxesOverlap(box, other)) cost += BOX_COST;
      if (bounds && (box.x0 < bounds.x0 || box.y0 < bounds.y0 || box.x1 > bounds.x1 || box.y1 > bounds.y1)) cost += OUTSIDE_COST;
      if (previous.get(label.id) === position) cost -= KEEP_BONUS;
      if (!best || cost < best.cost) best = { ...box, position, cost };
    });
    previous.set(label.id, best.position);
    placed.set(label.id, best);
    taken.push(best);
  }
  return placed;
}
