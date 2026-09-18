// Release gate: raw colors live only in src/styles/tokens.css.
// Scope: .css under src/styles and <style> blocks in .astro under src/components, src/pages, src/layouts.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|(?<![\w-])(?:white|black|red|blue|green|gray|grey|gold|silver|orange|purple|yellow|navy|teal|aqua|fuchsia|lime|maroon|olive)\b/gi;

const isValuePosition = (lineText, index) => {
  for (let i = index - 1; i >= 0; i -= 1) {
    const ch = lineText[i];
    if (ch === ":") return true;
    if (ch === ";" || ch === "{" || ch === "}") return false;
  }
  // Continuation of a multi-line value: assume value position only if the line does not look like a selector.
  return !/[{]\s*$/.test(lineText) && !/^[\s.#\[\]a-z0-9:>+~,*-]*\{?$/i.test(lineText.slice(0, index));
};

// Page-scoped palettes that predate tokens.css redefine the deprecated --ef-* aliases on a body class.
// They are grandfathered until each becomes a data-surface in tokens.css; no other file may do this.
export const LEGACY_EF_OVERRIDES = new Set([
  "src/styles/homepage-studio.css",
  "src/styles/calculus.css",
  "src/styles/content-clarity.css",
  "src/styles/macroeconomics.css",
  "src/styles/teaching-studio.css",
  "src/styles/visitor-experience.css",
  "src/pages/projects/[slug].astro",
]);

export function findViolations(text, file) {
  if (file.endsWith("tokens.css")) return [];
  const violations = [];
  const styleOnly = file.endsWith(".astro")
    ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
    : text;
  const cleaned = styleOnly.replace(/\/\*[\s\S]*?\*\/|url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, (m) => m.replace(/[^\n]/g, " "));
  cleaned.split("\n").forEach((lineText, index) => {
    for (const m of lineText.matchAll(LITERAL)) {
      if (!isValuePosition(lineText, m.index)) continue;
      if (/\b(?:var|calc|env|min|max|clamp)\(/i.test(m[0])) continue; // computed color, not a literal
      violations.push({ file, line: index + 1, literal: m[0], reason: "raw color outside tokens.css" });
    }
    if (LEGACY_EF_OVERRIDES.has(file)) return;
    for (const m of lineText.matchAll(/--ef-[a-z0-9-]+\s*:/g)) {
      violations.push({ file, line: index + 1, literal: m[0].trim(), reason: "new --ef- declaration; declare roles in tokens.css" });
    }
  });
  return violations;
}

const walk = async (dir, ext) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async (e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p, ext) : ext.some((x) => p.endsWith(x)) ? [p] : [];
}))).flat();

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const files = [
    ...await walk("src/styles", [".css"]),
    ...await walk("src/components", [".astro"]),
    ...await walk("src/pages", [".astro"]),
    ...await walk("src/layouts", [".astro"]),
  ];
  const all = [];
  for (const file of files) all.push(...findViolations(await readFile(file, "utf8"), file));
  if (all.length) {
    console.error(`[check-tokens] ${all.length} raw color(s) outside tokens.css:\n` + all.map((v) => `  ${v.file}:${v.line}  ${v.literal}  (${v.reason})`).join("\n"));
    process.exit(1);
  }
  console.log(`[check-tokens] ${files.length} files clean; every color resolves through src/styles/tokens.css`);
}
