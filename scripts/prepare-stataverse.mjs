import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRIMARY, BOOK, CONTACT, withSlash } from "../src/data/navigation.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const release = JSON.parse(
  await fs.readFile(
    new URL("../config/stataverse.json", import.meta.url),
    "utf8",
  ),
);
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
export function integrateHtml(html, relative) {
  // The project Pages bridge runs only at the retired /STATAverse/ address.
  // Canonical pages need no extra blocking request for that redirect.
  html = html.replace(
    /<script src="[^"]*assets\/js\/legacy-location\.js"><\/script>\s*/g,
    "",
  );
  const route = release.base + relative.replace(/index\.html$/, "");
  const url = new URL(route, "https://ihelfrich.github.io");
  const links = [
    ...PRIMARY,
    { label: "Site map", href: "/field" },
    { label: "Search website", href: "/search" },
    BOOK,
    CONTACT,
  ];
  const menu = links
    .map(
      ({ label, href }) =>
        `<a href="${escape(withSlash(href))}">${escape(label)}</a>`,
    )
    .join("");
  const nav = `<nav class="sv-site-nav" aria-label="Ian Helfrich website" data-pagefind-ignore><a class="sv-site-name" href="/">Ian Helfrich</a><a href="/teaching/">Teaching</a><span aria-hidden="true">/</span><a href="${release.base}">STATAverse</a><details class="sv-site-menu"><summary>Site navigation</summary><div>${menu}</div></details></nav>`;
  html = html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, "");
  html = html.replace(/href="([^"#][^"]*)"/g, (match, href) => {
    if (/^(?:[a-z]+:|\/)/i.test(href)) return match;
    const resolved = new URL(href.replaceAll("&amp;", "&"), url);
    return `href="${escape(resolved.pathname + resolved.search + resolved.hash)}"`;
  });
  html = html.replace(
    "</head>",
    `<link rel="canonical" href="${url.href}"><link rel="stylesheet" href="${release.base}assets/css/website-navigation.css"></head>`,
  );
  // Keep a skip link before the added navigation. No JavaScript or iframe wrapper.
  const skip =
    /(<body\b[^>]*>\s*<a\b[^>]*class="skip-link"[^>]*>[\s\S]*?<\/a>)/i;
  html = skip.test(html)
    ? html.replace(skip, `$1\n${nav}`)
    : html.replace(/<body\b[^>]*>/i, `$&\n${nav}`);
  return html;
}
export async function validatePackage({ packageDir, allowDirty = false } = {}) {
  packageDir ??=
    process.env.STATAVERSE_PACKAGE_DIR ||
    path.join(root, ".sources/stataverse/dist");
  let manifest;
  try {
    manifest = JSON.parse(
      await fs.readFile(path.join(packageDir, "site-package.json"), "utf8"),
    );
  } catch {
    throw new Error(
      "STATAverse package missing. Build the pinned source with npm run package:site; set STATAVERSE_PACKAGE_DIR to its dist directory. See docs/stataverse-integration.md.",
    );
  }
  if (
    manifest.version !== 1 ||
    typeof manifest.dirty !== "boolean" ||
    !Array.isArray(manifest.files) ||
    manifest.files.length > 2000 ||
    manifest.sourceCommit !== release.commit
  )
    throw new Error("STATAverse package does not match the pinned release.");
  if (manifest.dirty && !(allowDirty && !process.env.CI))
    throw new Error(
      "The public site requires a clean STATAverse source package.",
    );
  if (release.base !== "/learn/stata/")
    throw new Error("Unexpected STATAverse mount.");
  const seen = new Set(),
    verified = [];
  let total = 0;
  for (const entry of manifest.files) {
    if (
      typeof entry.path !== "string" ||
      !/^[A-Za-z0-9_@./-]+$/.test(entry.path) ||
      entry.path.startsWith("/") ||
      entry.path.split("/").some((p) => !p || p === "." || p === "..") ||
      seen.has(entry.path)
    )
      throw new Error("Unsafe or repeated STATAverse package path.");
    if (
      /\.(?:map|smcl|log)$/.test(entry.path) ||
      /^(?:src|tests|docs|node_modules)\//.test(entry.path)
    )
      throw new Error("Non-public file in STATAverse package.");
    seen.add(entry.path);
    const file = path.join(packageDir, entry.path);
    const resolved = await fs.realpath(file),
      packageRoot = await fs.realpath(packageDir);
    if (!resolved.startsWith(packageRoot + path.sep))
      throw new Error("STATAverse package link escapes its directory.");
    const bytes = await fs.readFile(file);
    total += bytes.length;
    if (
      bytes.length !== entry.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== entry.sha256 ||
      total > 40_000_000
    )
      throw new Error(
        `STATAverse package failed integrity or size checks: ${entry.path}`,
      );
    verified.push([entry.path, bytes]);
  }
  for (const file of [
    "index.html",
    "Learn/index.html",
    "Labs/index.html",
    "Labs/Inference/index.html",
    "Labs/Data/index.html",
    "service-worker.js",
  ])
    if (!seen.has(file))
      throw new Error(`STATAverse package is incomplete: ${file}`);
  return { manifest, verified, total };
}
export async function prepareStataverse(options = {}) {
  const { manifest, verified, total } = await validatePackage(options);
  const destination = path.resolve(root, "public", "." + release.base),
    staging = destination + ".staging";
  await fs.rm(staging, { recursive: true, force: true });
  for (const [relative, bytes] of verified) {
    const target = path.join(staging, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(
      target,
      relative.endsWith(".html")
        ? integrateHtml(bytes.toString(), relative)
        : bytes,
    );
  }
  const tokens = await fs.readFile(
    path.join(root, "src/styles/tokens.css"),
    "utf8",
  );
  const token = (name) => {
    const m = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
    if (!m) throw new Error(`Missing site token ${name}`);
    return m[1];
  };
  const css = await fs.readFile(
    path.join(root, "src/styles/stataverse-bar.css"),
    "utf8",
  );
  // The navigation and the STATAverse Console take their typefaces from the
  // hub's own faces. Each must be found exactly once: a renamed or moved
  // face would otherwise drop out silently and the Console would fall back
  // to a system font.
  const families = [
    "Geist Variable",
    "Newsreader Variable",
    "Geist Mono Variable",
  ];
  const faces =
    (
      await fs.readFile(path.join(root, "src/styles/fieldbook.css"), "utf8")
    ).match(/@font-face\s*\{[^}]+\}/g) ?? [];
  const familyOf = (face) =>
    /font-family:\s*["']?([^"';]+)["']?\s*;/.exec(face)?.[1].trim();
  const picked = faces.filter((face) => families.includes(familyOf(face)));
  for (const family of families) {
    const found = picked.filter((face) => familyOf(face) === family).length;
    if (found !== 1)
      throw new Error(
        `src/styles/fieldbook.css has ${found} @font-face rules for "${family}"; the STATAverse navigation and Console need exactly one`,
      );
  }
  const fontFaces = picked.join("\n");
  const typography =
    ":root{" +
    ["font-display", "font-text", "font-data"]
      .map((name) => "--" + name + ":" + token(name) + ";")
      .join("") +
    "}";
  const navigationCss =
    fontFaces +
    "\n" +
    typography +
    "\n" +
    `.sv-site-nav{--sv-ink:${token("p-ink")};--sv-paper:${token("p-paper")};--sv-focus:${token("p-signal")}}\n` +
    css;
  await fs.writeFile(
    path.join(staging, "assets/css/website-navigation.css"),
    navigationCss,
  );
  const workerPath = path.join(staging, "service-worker.js");
  const integrationHash = createHash("sha256")
    .update(navigationCss + integrateHtml("<body></body>", "index.html"))
    .digest("hex")
    .slice(0, 12);
  const worker = (await fs.readFile(workerPath, "utf8"))
    .replace(
      "const CORE_ASSETS = [",
      'const CORE_ASSETS = [\n  "assets/css/website-navigation.css",',
    )
    .replace(
      /const CACHE_NAME = CACHE_PREFIX \+ "[^"]+";/,
      'const CACHE_NAME = CACHE_PREFIX + "site-' +
        release.commit.slice(0, 12) +
        "-" +
        integrationHash +
        '";',
    );
  await fs.writeFile(workerPath, worker);
  await fs.writeFile(
    path.join(staging, "site-release.json"),
    JSON.stringify(
      {
        source: release.repository,
        commit: manifest.sourceCommit,
        base: release.base,
        development: manifest.dirty,
      },
      null,
      2,
    ) + "\n",
  );
  await fs.rm(destination, { recursive: true, force: true });
  await fs.rename(staging, destination);
  return {
    files: verified.length,
    bytes: total,
    base: release.base,
    development: manifest.dirty,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  console.log(
    JSON.stringify(
      await prepareStataverse({
        allowDirty: process.env.STATAVERSE_ALLOW_DIRTY === "1",
      }),
    ),
  );
