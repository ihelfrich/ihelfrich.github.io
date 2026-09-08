# Shared UI components

Astro components below are the principal reusable interaction and record primitives on the current site.

## CaseRecord
- Source: `src/components/CaseRecord.astro`
- Evidence-led project/research record with question, contribution, result, limit, and actions.
```astro
---
interface Link {
  label: string;
  href: string;
  external?: boolean;
}

interface Case {
  id: string;
  title: string;
  question: string;
  whyLabel?: string;
  why?: string;
  builtLabel?: string;
  built?: string;
  status: string;
  role: string;
  method: readonly string[];
  stateLabel?: string;
  state: string;
  limit: string;
  links?: readonly Link[];
}

interface Props {
  record: Case;
  headingLevel?: "h2" | "h3";
}

const { record, headingLevel = "h2" } = Astro.props;
const Heading = headingLevel;
const linkIsExternal = (link: Link) => link.external ?? /^https?:\/\//.test(link.href);
---

<article class="case-record" id={`case-${record.id}`} aria-labelledby={`case-${record.id}-title`}>
  <header>
    <p class="case-record__accession">Selected work</p>
    <Heading id={`case-${record.id}-title`}>{record.title}</Heading>
  </header>
  <dl class="case-record__fields">
    <div><dt>Question</dt><dd>{record.question}</dd></div>
    {record.why && <div><dt>{record.whyLabel ?? "Why it matters"}</dt><dd>{record.why}</dd></div>}
    {record.built && <div><dt>{record.builtLabel ?? "What I built"}</dt><dd>{record.built}</dd></div>}
    <div><dt>Status</dt><dd>{record.status}</dd></div>
    <div><dt>Role</dt><dd>{record.role}</dd></div>
    <div><dt>Method</dt><dd>{record.method.join(" · ")}</dd></div>
    <div><dt>{record.stateLabel ?? "Finding or current state"}</dt><dd>{record.state}</dd></div>
    <div class="case-record__limit"><dt>Limit</dt><dd>{record.limit}</dd></div>
  </dl>
  {record.links && record.links.length > 0 && (
    <nav aria-label={`${record.title} artifacts`}>
      {record.links.map((link) => (
        <a href={link.href} target={linkIsExternal(link) ? "_blank" : undefined} rel={linkIsExternal(link) ? "noopener" : undefined}>
          {link.label}{linkIsExternal(link) ? " ↗" : " →"}
        </a>
      ))}
    </nav>
  )}
</article>

<style>
  .case-record { border-top: 1px solid color-mix(in srgb, var(--ef-ink) 18%, var(--ef-paper)); padding-block: 1.25rem; }
  .case-record__accession,
  .case-record dt {
    color: color-mix(in srgb, var(--ef-ink) 65%, transparent);
    font: 600 0.68rem/1.35 var(--font-data);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .case-record header :is(h2, h3) { margin-block: 0.25rem 1rem; }
  .case-record__fields { display: grid; gap: 0.9rem; margin: 0; }
  .case-record__fields > div { display: grid; gap: 0.2rem; }
  .case-record dd { margin: 0; max-width: 72ch; }
  .case-record__limit { border-left: 3px solid var(--ef-signal); padding-left: 0.7rem; }
  .case-record nav { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-top: 1rem; }
  @media (min-width: 48rem) {
    .case-record__fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
```

## FieldRail
- Source: `src/components/FieldRail.astro`
- Shared side rail for route context and scroll-linked navigation.
```astro
<aside class="field-rail" aria-label="Sections on this page" data-field-rail hidden>
  <span class="field-rail-current" data-field-current>Overview</span>
  <div class="field-rail-track">
    <i data-field-progress aria-hidden="true"></i>
    <nav aria-label="Jump to a section" data-field-markers></nav>
  </div>
  <output data-field-progress-text aria-live="off">0%</output>
</aside>

<script is:inline>
  (() => {
    const rail = document.querySelector("[data-field-rail]");
    if (!(rail instanceof HTMLElement)) return;
    const current = rail.querySelector("[data-field-current]");
    const progress = rail.querySelector("[data-field-progress]");
    const markers = rail.querySelector("[data-field-markers]");
    const progressText = rail.querySelector("[data-field-progress-text]");
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let sections = [];
    let frame = 0;

    const labelFor = (section, index) => {
      const heading = section.querySelector("h1, h2");
      return section.dataset.railLabel || heading?.textContent?.replace(/\s+/g, " ").trim() || `Section ${index + 1}`;
    };

    const ensureId = (section, index) => {
      if (section.id) return section.id;
      const stem = labelFor(section, index).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      section.id = stem || `section-${index + 1}`;
      return section.id;
    };

    const build = () => {
      sections = Array.from(document.querySelectorAll("main section[data-rail-label], main > section, main > div > section"))
        .filter((section) => section.querySelector("h1, h2") && section.getBoundingClientRect().height > 160)
        .map((section, index) => ({
          section,
          id: ensureId(section, index),
          label: labelFor(section, index),
          top: section.getBoundingClientRect().top + scrollY,
        }));
      if (sections.length < 2 || !(markers instanceof HTMLElement)) {
        rail.hidden = true;
        return;
      }
      rail.hidden = false;
      markers.replaceChildren(...sections.map((entry, index) => {
        const link = document.createElement("a");
        link.href = `#${entry.id}`;
        link.setAttribute("aria-label", `Go to ${entry.label}`);
        link.title = entry.label;
        link.style.top = `${index / (sections.length - 1) * 100}%`;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          entry.section.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
          history.replaceState(null, "", `#${entry.id}`);
        });
        return link;
      }));
      update();
    };

    const update = () => {
      frame = 0;
      const available = document.documentElement.scrollHeight - innerHeight;
      const ratio = available > 0 ? Math.max(0, Math.min(1, scrollY / available)) : 0;
      if (progress) progress.style.transform = `scaleY(${ratio})`;
      const percent = Math.round(ratio * 100);
      if (progressText) progressText.textContent = `${percent}%`;
      const probe = scrollY + innerHeight * .38;
      let active = 0;
      sections.forEach((entry, index) => { if (entry.top <= probe) active = index; });
      if (current && sections[active]) current.textContent = sections[active].label;
      markers?.querySelectorAll("a").forEach((marker, index) => {
        marker.classList.toggle("is-active", index === active);
        if (index === active) marker.setAttribute("aria-current", "location");
        else marker.removeAttribute("aria-current");
      });
    };

    addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    addEventListener("resize", build);
    if (document.fonts?.ready) document.fonts.ready.then(build); else build();
  })();
</script>

<style>
  .field-rail[hidden] { display: none !important; }
  .field-rail-track nav a {
    position: absolute;
    left: 50%;
    display: block;
    width: 9px;
    height: 9px;
    color: inherit;
    background: var(--ef-paper);
    border: 1px solid var(--ef-ink);
    transform: translate(-50%, -50%);
  }
  .field-rail-track nav a::before { position: absolute; inset: -17px; content: ""; }
  .field-rail-track nav a:is(:hover, :focus-visible, .is-active) { background: var(--ef-signal); border-color: var(--ef-signal); }
  .field-rail output { font: 600 0.45rem/1 var(--font-data); text-align: center; }
</style>
```

## SiteIndex
- Source: `src/components/SiteIndex.astro`
- Command-palette index available from every route.
```astro
---
import { getCollection } from "astro:content";
import { isArchivalProject } from "../data/archival-projects.mjs";
import { filterDiscoverableResearch } from "../data/research-discovery.mjs";

const [allResearch, writing, datasets, allProjects] = await Promise.all([
  getCollection("research"),
  getCollection("writing", ({ data }) => !data.draft),
  getCollection("datasets"),
  getCollection("projects"),
]);
const research = filterDiscoverableResearch(allResearch);
const projects = allProjects.filter((entry) => !isArchivalProject(entry.id));
const teachingFamilies = [
  ["Statistics & inference", "Probability, estimation, regression, diagnostics, causal inference, and visual reasoning", "statistics-inference"],
  ["Econometrics & research design", "Identification, measurement, panel methods, specification strategy, and reproducibility", "econometrics-research-design"],
  ["Python & SQL", "Analytical programming, data workflows, query design, debugging, and code review", "python-sql"],
  ["Microeconomics", "Principles, theory, game theory, market structure, managerial economics, and policy", "microeconomics"],
  ["Macroeconomics", "Principles, intermediate models, money, growth, international macro, and live public data", "macroeconomics"],
  ["Business, strategy & marketing", "Quantitative decision models, finance, competitive analysis, market research, and communication", "business-strategy-marketing"],
  ["GIS & public data", "Spatial analysis, remote sensing, public datasets, geographic measurement, and mapping", "gis-public-data"],
];

const records = [
  { kind: "Go", code: "GO-01", title: "Contact", detail: "Hiring, research, teaching, coaching, and applied quantitative inquiries", href: "/contact" },
  { kind: "Go", code: "GO-02", title: "Selected work", detail: "Case studies in econometrics, spatial systems, and interactive evidence", href: "/work" },
  { kind: "Go", code: "GO-04", title: "Interactive lab", detail: "Working analytical instruments with methods and decision context", href: "/lab" },
  { kind: "Go", code: "GO-05", title: "Research", detail: "Papers, programs, methods, data, and current questions", href: "/research" },
  { kind: "Go", code: "GO-06", title: "Teaching", detail: "University teaching, online instruction, independent tutoring, and quantitative research-design coaching", href: "/teaching" },
  { kind: "Go", code: "GO-07", title: "Public index", detail: "Papers, data, essays, and tools in one searchable record", href: "/library" },
  { kind: "Go", code: "GO-08", title: "Third Space Labs", detail: "The independent research venture Ian is building with Elizaveta Gonchar, Ph.D.", href: "/third-space" },
  { kind: "Go", code: "GO-09", title: "About Ian", detail: "Education, current practice, leadership, and service", href: "/about" },
  { kind: "Go", code: "GO-10", title: "Curriculum vitae", detail: "Executive resume, academic CV, career summary, availability, and contact", href: "/cv" },
  { kind: "Go", code: "GO-11", title: "Job market", detail: "Candidate page for the 2026-27 economics job market: fields, paper, availability", href: "/job-market" },
  { kind: "Go", code: "GO-12", title: "Colophon", detail: "How this site works: the homepage solver's mathematics, the motion doctrine, the stack", href: "/colophon" },
  ...research.map((entry, index) => ({
    kind: "Paper", code: `P-${entry.data.year}-${String(index + 1).padStart(2, "0")}`,
    title: entry.data.title, detail: `${entry.data.authors.join(", ")} · ${entry.data.displayStatus}`,
    search: entry.data.searchTerms.join(" "), href: `/research/${entry.id}`,
  })),
  ...datasets.map((entry, index) => ({
    kind: "Data", code: `D-${entry.data.year}-${String(index + 1).padStart(2, "0")}`,
    title: entry.data.title, detail: `${entry.data.status} · ${entry.data.license}`, href: `/datasets/${entry.id}`,
  })),
  ...writing.map((entry, index) => ({
    kind: "Essay", code: `W-${entry.data.date.getFullYear()}-${String(index + 1).padStart(2, "0")}`,
    title: entry.data.title, detail: entry.data.summary, href: `/writing/${entry.id}`,
  })),
  ...projects.map((entry, index) => ({
    kind: "Tool", code: `T-${entry.data.date.getFullYear()}-${String(index + 1).padStart(2, "0")}`,
    title: entry.data.title, detail: `${entry.data.status} · ${entry.data.blurb}`, href: entry.data.url ?? `/projects/${entry.id}`,
    external: Boolean(entry.data.url),
  })),
  ...teachingFamilies.map(([title, detail], index) => ({
    kind: "Teach", code: `L-2026-${String(index + 1).padStart(2, "0")}`,
    title, detail, href: "/teaching",
  })),
];
---

<dialog class="site-index" data-site-index aria-labelledby="site-index-title">
  <div class="site-index-shell">
    <header class="site-index-head">
      <div>
        <span>IAN HELFRICH / SITE INDEX</span>
        <strong id="site-index-title">Find anything.</strong>
      </div>
      <button type="button" data-index-close aria-label="Close site index">ESC <i>×</i></button>
    </header>

    <div class="site-index-query">
      <label for="site-index-input">Search the site</label>
      <span aria-hidden="true">/</span>
      <input id="site-index-input" type="search" autocomplete="off" placeholder="paper, method, dataset, person, problem…" data-index-query />
      <output data-index-count>{records.length} records</output>
    </div>

    <div class="site-index-columns" aria-hidden="true">
      <span>ACCESSION</span><span>TYPE</span><span>RECORD</span><span>OPEN</span>
    </div>
    <nav class="site-index-results" aria-label="Search results" data-index-results>
      {records.map((record) => (
        <a
          href={record.href}
          target={record.external ? "_blank" : undefined}
          rel={record.external ? "noopener" : undefined}
          data-index-record
          data-search={`${record.kind} ${record.code} ${record.title} ${record.detail} ${record.search ?? ""}`.toLowerCase()}
        >
          <span>{record.code}</span>
          <small>{record.kind}</small>
          <div><strong>{record.title}</strong><p>{record.detail}</p></div>
          <i aria-hidden="true">{record.external ? "↗" : "→"}</i>
        </a>
      ))}
      <p class="site-index-empty" data-index-empty hidden>No record matches that query.</p>
    </nav>

    <footer class="site-index-foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> MOVE</span>
      <span><kbd>ENTER</kbd> OPEN</span>
      <span><kbd>ESC</kbd> CLOSE</span>
      <a href="/library">OPEN THE COMPLETE PUBLIC INDEX →</a>
    </footer>
  </div>
</dialog>

<script is:inline>
  (() => {
    const dialog = document.querySelector("[data-site-index]");
    if (!(dialog instanceof HTMLDialogElement)) return;
    const input = dialog.querySelector("[data-index-query]");
    const records = Array.from(dialog.querySelectorAll("[data-index-record]"));
    const count = dialog.querySelector("[data-index-count]");
    const empty = dialog.querySelector("[data-index-empty]");
    let visible = records;
    let active = -1;

    const setActive = (index) => {
      visible.forEach((record) => record.classList.remove("is-active"));
      if (!visible.length) { active = -1; return; }
      active = (index + visible.length) % visible.length;
      visible[active].classList.add("is-active");
      visible[active].scrollIntoView({ block: "nearest" });
    };

    const filter = () => {
      const query = input?.value.trim().toLowerCase() ?? "";
      visible = records.filter((record) => {
        const match = !query || record.dataset.search.includes(query);
        record.hidden = !match;
        return match;
      });
      if (count) count.textContent = `${visible.length} ${visible.length === 1 ? "record" : "records"}`;
      if (empty) empty.hidden = visible.length > 0;
      setActive(visible.length ? 0 : -1);
    };

    const open = () => {
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add("index-is-open");
      if (input instanceof HTMLInputElement) {
        input.value = "";
        filter();
        window.setTimeout(() => input.focus(), 0);
      }
    };
    const close = () => {
      dialog.close();
      document.documentElement.classList.remove("index-is-open");
    };

    document.querySelectorAll("[data-index-open]").forEach((button) => button.addEventListener("click", open));
    dialog.querySelector("[data-index-close]")?.addEventListener("click", close);
    dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    dialog.addEventListener("close", () => document.documentElement.classList.remove("index-is-open"));
    input?.addEventListener("input", filter);
    input?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setActive(active + 1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); setActive(active - 1); }
      else if (event.key === "Enter" && active >= 0) { event.preventDefault(); visible[active]?.click(); }
    });
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      if (event.key === "Escape" && dialog.open) { event.preventDefault(); close(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); dialog.open ? close() : open(); }
      else if (event.key === "/" && !editing && !dialog.open) { event.preventDefault(); open(); }
    });
  })();
</script>
```
