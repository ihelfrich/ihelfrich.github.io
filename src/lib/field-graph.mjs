// Pure graph helpers for the site map at /field/. No DOM, no d3, so they can be tested directly.

/** Builds adjacency sets and degree counts from node ids and {source, target} links. */
export function buildGraph(ids, links) {
  const adj = new Map(ids.map((id) => [id, new Set()]));
  const deg = {};
  for (const { source, target } of links) {
    adj.get(source).add(target);
    adj.get(target).add(source);
    deg[source] = (deg[source] ?? 0) + 1;
    deg[target] = (deg[target] ?? 0) + 1;
  }
  return { adj, deg };
}

/** Breadth-first distances from start. Unreachable ids are absent from the result. */
export function bfs(adj, start) {
  const dist = { [start]: 0 };
  const queue = [start];
  while (queue.length) {
    const here = queue.shift();
    for (const next of adj.get(here)) {
      if (dist[next] == null) {
        dist[next] = dist[here] + 1;
        queue.push(next);
      }
    }
  }
  return dist;
}

/** Largest hop count in a bfs result (ignores the "__s" marker the map stores beside it). */
export function maxHop(dist) {
  return Math.max(...Object.keys(dist).filter((key) => key !== "__s").map((key) => dist[key]));
}

/** Shortest chain of ids from a to b, or null when no chain of links connects them. */
export function shortest(adj, a, b) {
  const previous = { [a]: null };
  const queue = [a];
  while (queue.length) {
    const here = queue.shift();
    if (here === b) break;
    for (const next of adj.get(here)) {
      if (!(next in previous)) {
        previous[next] = here;
        queue.push(next);
      }
    }
  }
  if (!(b in previous)) return null;
  const chain = [];
  for (let id = b; id != null; id = previous[id]) chain.unshift(id);
  return chain;
}

/** Hop level of a page for the Topics layout: the home page is 0, unreachable pages sit one past the last level. */
export function hopLevel(id, home, maxHops) {
  return id === "/" ? 0 : (home[id] ?? maxHops + 1);
}

/**
 * Ring radii for the Topics layout. Each ring is placed so that ring area follows the number of pages
 * up to that level, with a minimum gap so sparse outer rings stay apart. Returns radii for levels 0..maxHops+1.
 */
export function ringRadii(ids, home, maxHops, radius) {
  const counts = Array(maxHops + 2).fill(0);
  for (const id of ids) counts[hopLevel(id, home, maxHops)] += 1;
  let cumulative = counts[0];
  const radii = [0];
  for (let level = 1; level <= maxHops + 1; level += 1) {
    const mid = cumulative + counts[level] / 2;
    cumulative += counts[level];
    radii[level] = Math.sqrt(mid / ids.length);
  }
  for (let level = 2; level < radii.length; level += 1) radii[level] = Math.max(radii[level], radii[level - 1] + 0.1);
  const outer = radii[radii.length - 1];
  return radii.map((value) => (value / outer) * radius);
}

/** Number of pages within `limit` links of the home page, counting the home page itself. */
export function withinHops(ids, home, limit) {
  return ids.filter((id) => id === "/" || (home[id] != null && home[id] <= limit)).length;
}

/** Nearest existing ancestor route of a page, or "/" when none exists. */
export function parentRoute(id, has) {
  let parent = id.replace(/[^/]+\/$/, "");
  while (parent && parent !== "/" && !has(parent)) parent = parent.replace(/[^/]+\/$/, "");
  return parent && has(parent) && parent !== id ? parent : "/";
}

const capitalise = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

export function authorList(authors = []) {
  if (authors.length > 2) return `${authors.slice(0, -1).join(", ")}, and ${authors[authors.length - 1]}`;
  return authors.join(" and ");
}

/** One-line byline for the panel: authors, year, status. */
export function byline(meta) {
  if (!meta) return "";
  const parts = [authorList(meta.authors), meta.year, capitalise(meta.status)].filter(Boolean);
  if (!parts.length) return "";
  return `${parts.join(". ").replace(/\. (\d{4})/, ", $1")}.`;
}

/** A plain-text reference for a page in a dossier. Papers get authors, year and status; other pages get their title. */
export function reference(node, url) {
  const meta = node.meta;
  const name = node.full ?? node.title;
  if (node.type === "paper" && meta && (meta.authors?.length || meta.year)) {
    const head = [authorList(meta.authors), meta.year ? `(${meta.year})` : ""].filter(Boolean).join(" ");
    const status = meta.status ? ` ${capitalise(meta.status)}.` : "";
    return `${head}. ${name}.${status} ${url}`;
  }
  return `${name}. ${url}`;
}

/** Links of a page grouped by page type, specific pages before hubs (pages linked from many places). */
export function groupLinked(neighbors, deg, groups, perGroup = 7, hubDegree = 25) {
  return groups
    .map(([type, label]) => ({
      type,
      label,
      items: neighbors
        .filter((node) => node.type === type)
        .sort((x, y) => Number(deg[x.id] >= hubDegree) - Number(deg[y.id] >= hubDegree) || deg[x.id] - deg[y.id])
        .slice(0, perGroup),
    }))
    .filter((group) => group.items.length);
}

/**
 * Ranks pages for a search query. Label matches come first, then title or address matches, then
 * description matches; ties go to the more linked page. Returns at most `limit` nodes.
 */
export function searchRank(nodes, deg, query, limit = 7) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (node) => {
    const label = node.title.toLowerCase();
    const full = (node.full ?? node.title).toLowerCase();
    if (label.startsWith(q)) return 0;
    if (label.includes(q)) return 1;
    if (full.includes(q) || node.id.includes(q)) return 2;
    if ((node.desc ?? "").toLowerCase().includes(q)) return 3;
    return 4;
  };
  return nodes
    .map((node) => ({ node, rank: score(node) }))
    .filter(({ rank }) => rank < 4)
    .sort((a, b) => a.rank - b.rank || (deg[b.node.id] ?? 0) - (deg[a.node.id] ?? 0))
    .slice(0, limit)
    .map(({ node }) => node);
}

/** The next or previous id in a list, wrapping around. Returns the first id when `current` is not in the list. */
export function stepThrough(list, current, direction) {
  if (!list.length) return null;
  const index = list.indexOf(current);
  if (index < 0) return list[0];
  return list[(index + direction + list.length) % list.length];
}
