// "Connected pages" strip at the end of a page: the pages this one links to or from, grouped by kind,
// marked with the same shapes as the site map. Reads /field.json; stays hidden if the page is not on the map.
import { buildGraph, groupLinked } from "../lib/field-graph.mjs";

const GROUPS = [["paper", "Papers"], ["data", "Data"], ["tool", "Instruments"], ["course", "Courses"], ["page", "Pages"]];
const MARK = {
  paper: '<rect x="-4" y="-4" width="8" height="8"/>',
  data: '<path d="M0-5.5L4.5 0 0 5.5-4.5 0z"/>',
  tool: '<path d="M0-5.5L1.6-1.7 5.5-1.7 2.4.8 3.4 5 0 2.5-3.4 5-2.4.8-5.5-1.7-1.6-1.7z"/>',
  course: '<path d="M0-5.5L4.8 4.2-4.8 4.2z"/>',
  page: '<circle r="4"/>',
};

export async function mountNearby(root) {
  const path = root.dataset.path.endsWith("/") ? root.dataset.path : `${root.dataset.path}/`;
  let data;
  try {
    const res = await fetch("/field.json");
    if (!res.ok) return;
    data = await res.json();
  } catch { return; }
  const nodes = data.nodes;
  const ids = nodes.map((n) => n.id);
  if (path === "/" || !ids.includes(path)) return;
  const links = data.links.map(([a, b]) => ({ source: ids[a], target: ids[b] }));
  const { adj, deg } = buildGraph(ids, links);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbours = [...adj.get(path)].filter((id) => id !== "/").map((id) => byId.get(id));
  if (!neighbours.length) return;
  const groups = groupLinked(neighbours, deg, GROUPS, 6);
  const box = root.querySelector("[data-nearby-groups]");
  for (const group of groups) {
    const section = document.createElement("div");
    section.className = "nearby-group";
    const label = document.createElement("h3");
    label.textContent = group.label;
    const list = document.createElement("ul");
    for (const node of group.items) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = node.id;
      a.innerHTML = `<svg viewBox="-6 -6 12 12" aria-hidden="true" style="fill:var(--topic-${(node.topics || [])[0] || "profile"})">${MARK[node.type] || MARK.page}</svg>`;
      a.append(document.createTextNode(node.label || node.title));
      li.append(a);
      list.append(li);
    }
    section.append(label, list);
    box.append(section);
  }
  root.hidden = false;
}
