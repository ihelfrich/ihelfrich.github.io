import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { Window } from "happy-dom";

const palette = {
  "--ef-ink": "#11131D",
  "--ef-paper": "#F1F3F2",
  "--ef-figure": "#FFFFFF",
  "--ef-signal": "#3156E8",
  "--ef-teal": "#28706B",
  "--ef-oxide": "#9E4D38",
};

const fonts = [
  {
    file: "public/fonts/geist-variable.woff2",
    builtFile: "dist/fonts/geist-variable.woff2",
    url: "/fonts/geist-variable.woff2",
    family: "Geist Variable",
    token: "--font-display",
    weights: "100 900",
    sha256: "2ffebe993e969069a9789d15164b7715d42491b5835516c5e3b935d5f81b05f1",
    licenseFile: "public/fonts/OFL-Geist.txt",
    licensePattern: /The Geist Project Authors/i,
  },
  {
    file: "public/fonts/newsreader-variable.woff2",
    builtFile: "dist/fonts/newsreader-variable.woff2",
    url: "/fonts/newsreader-variable.woff2",
    family: "Newsreader Variable",
    token: "--font-text",
    weights: "200 800",
    sha256: "1faa3380ac0e87e057b180e03fd94bd708a612afb67d2590677be4508909fae9",
    licenseFile: "public/fonts/OFL-Newsreader.txt",
    licensePattern: /The Newsreader Project Authors/i,
  },
  {
    file: "public/fonts/geist-mono-variable.woff2",
    builtFile: "dist/fonts/geist-mono-variable.woff2",
    url: "/fonts/geist-mono-variable.woff2",
    family: "Geist Mono Variable",
    token: "--font-data",
    weights: "100 900",
    sha256: "afaacc4c5fbba89d2ebf7a02dc4070208540874592a5504d57175782fe893101",
    licenseFile: "public/fonts/OFL-Geist.txt",
    licensePattern: /The Geist Project Authors/i,
  },
];

const failures = [];

const stripCSSComments = (css) => {
  let output = "";
  let quote = null;
  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    const next = css[index + 1];
    if (quote) {
      output += character;
      if (character === "\\" && next) {
        output += next;
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      output += character;
      continue;
    }
    if (character === "/" && next === "*") {
      output += " ";
      index += 2;
      while (index < css.length && !(css[index] === "*" && css[index + 1] === "/")) {
        if (css[index] === "\n") output += "\n";
        index += 1;
      }
      index += 1;
      continue;
    }
    output += character;
  }
  return output;
};

const fontFaceBlocks = (css) => [...stripCSSComments(css).matchAll(/@font-face\s*\{([^{}]*)\}/gis)].map((match) => match[1]);

const declarationValue = (block, property) => block.match(
  new RegExp(`(?:^|;)\\s*${property.replace("-", "\\-")}\\s*:\\s*([^;]+)`, "i"),
)?.[1].trim() ?? "";

const unquote = (value) => value.trim().replace(/^(["'])(.*)\1$/, "$2");

const urlsIn = (value) => [...value.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^\s"')]+))\s*\)/gi)]
  .map((match) => match[2] ?? match[3]);

const isRemoteURL = (url) => /^(?:https?:)?\/\//i.test(url);

const collectFiles = async (directory, extension) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path, extension);
    return extname(entry.name) === extension ? [path] : [];
  }));
  return paths.flat();
};

const readOrFail = async (path, description) => {
  try {
    return await readFile(path);
  } catch {
    failures.push(`${description} is missing at ${path}`);
    return null;
  }
};

const parseColor = (value) => {
  const normalized = value.trim();
  if (/^white$/i.test(normalized)) return { r: 255, g: 255, b: 255, a: 1 };
  if (/^black$/i.test(normalized)) return { r: 0, g: 0, b: 0, a: 1 };
  if (/^transparent$/i.test(normalized)) return { r: 0, g: 0, b: 0, a: 0 };
  const hex = normalized.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3
      ? [...hex[1]].map((digit) => `${digit}${digit}`).join("")
      : hex[1];
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }
  const match = normalized.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
};

const colorTokens = (value) => value.match(/#[\da-f]{3,6}\b|rgba?\([^)]*\)|\b(?:black|white|transparent)\b/gi) ?? [];

const rulesIn = (rules) => [...rules].flatMap((rule) => {
  if (rule.cssRules?.length) return rulesIn(rule.cssRules);
  return [rule];
});

const selectorRules = (window, selector) => rulesIn(
  [...window.document.styleSheets].flatMap((sheet) => [...sheet.cssRules]),
).filter((rule) => rule.selectorText?.split(",").map((part) => part.trim()).includes(selector));

const hasDeclarationContract = (window, selector, contract) => selectorRules(window, selector).some((rule) => (
  Object.entries(contract).every(([property, expected]) => rule.style.getPropertyValue(property).trim() === expected)
));

const mediaAppliesAtWidth = (condition, width) => {
  if (!condition) return true;
  if (/print|prefers-|forced-colors/i.test(condition)) return false;
  const bounds = [...condition.matchAll(/width\s*(<=|>=|<|>)\s*([\d.]+)(px|rem)/gi)];
  if (!bounds.length) return true;
  return bounds.every(([, operator, rawValue, unit]) => {
    const value = Number(rawValue) * (unit.toLowerCase() === "rem" ? 16 : 1);
    if (operator === "<=") return width <= value;
    if (operator === ">=") return width >= value;
    if (operator === "<") return width < value;
    return width > value;
  });
};

const specificity = (selector) => {
  const withoutWhere = selector.replace(/:where\([^)]*\)/g, "");
  const ids = withoutWhere.match(/#[\w-]+/g)?.length ?? 0;
  const classes = withoutWhere.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g)?.length ?? 0;
  const elements = withoutWhere
    .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?/g, " ")
    .match(/(?:^|[\s>+~])([a-z][\w-]*)/gi)?.length ?? 0;
  return [ids, classes, elements];
};

const winsCascade = (next, current) => {
  if (!current) return true;
  if (next.important !== current.important) return next.important;
  for (let index = 0; index < next.specificity.length; index += 1) {
    if (next.specificity[index] !== current.specificity[index]) return next.specificity[index] > current.specificity[index];
  }
  return next.order >= current.order;
};

const cascadedPropertiesAtWidth = (window, element, width, properties) => {
  const resolved = new Map();
  let order = 0;
  const visit = (rules, active = true) => {
    for (const rule of rules) {
      if (rule.cssRules?.length) {
        const nextActive = active && (rule.conditionText ? mediaAppliesAtWidth(rule.conditionText, width) : true);
        visit(rule.cssRules, nextActive);
        continue;
      }
      order += 1;
      if (!active || !rule.selectorText || !rule.style) continue;
      for (const selector of rule.selectorText.split(",")) {
        const candidateSelector = selector.trim();
        try {
          if (!element.matches(candidateSelector)) continue;
        } catch {
          continue;
        }
        const candidateSpecificity = specificity(candidateSelector);
        for (const property of properties) {
          const value = rule.style.getPropertyValue(property).trim();
          if (!value) continue;
          const candidate = {
            value,
            important: rule.style.getPropertyPriority(property) === "important",
            specificity: candidateSpecificity,
            order,
          };
          if (winsCascade(candidate, resolved.get(property))) resolved.set(property, candidate);
        }
      }
    }
  };
  for (const sheet of window.document.styleSheets) visit(sheet.cssRules);
  return Object.fromEntries([...resolved].map(([property, candidate]) => [property, candidate.value]));
};

const resolveCustomProperty = (window, name, seen = new Set()) => {
  if (seen.has(name)) return "";
  seen.add(name);
  const value = window.getComputedStyle(window.document.documentElement)
    .getPropertyValue(name)
    .trim();
  const reference = value.match(/^var\(\s*(--[\w-]+)/)?.[1];
  return reference ? resolveCustomProperty(window, reference, seen) : value;
};

const resolveColor = (window, value, seen = new Set()) => {
  const reference = value.match(/var\(\s*(--[\w-]+)/)?.[1];
  if (!reference || seen.has(reference)) return parseColor(value);
  seen.add(reference);
  const token = window.getComputedStyle(window.document.documentElement)
    .getPropertyValue(reference)
    .trim();
  return resolveColor(window, token, seen);
};

const declaredBackground = (window, element) => {
  let value = "";
  for (const sheet of window.document.styleSheets) {
    for (const rule of rulesIn(sheet.cssRules)) {
      if (!rule.selectorText || !rule.style) continue;
      try {
        if (!element.matches(rule.selectorText)) continue;
      } catch {
        continue;
      }
      value = rule.style.backgroundColor || rule.style.background || value;
    }
  }
  const colors = colorTokens(value);
  for (let index = colors.length - 1; index >= 0; index -= 1) {
    const parsed = resolveColor(window, colors[index]);
    if (parsed && parsed.a > 0) return parsed;
  }
  return resolveColor(window, value);
};

const luminance = ({ r, g, b }) => {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (foreground, background) => {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
};

const inlineStylesheets = async (html, page) => {
  const cssLinks = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"[^>]*>/g)];
  const css = [];
  for (const [, href] of cssLinks) {
    try {
      css.push(await readFile(resolve("dist", href.replace(/^\//, "")), "utf8"));
    } catch {
      if (href !== "/pagefind/pagefind-ui.css") failures.push(`${page} references missing stylesheet ${href}`);
    }
  }
  const document = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="[^"]+\.css"[^>]*>/g, "")
    .replace("</head>", `<style>${css.join("\n")}</style></head>`);
  return { document, url: `https://example.test/${dirname(page)}/` };
};

const sourceStyles = await collectFiles(resolve("src/styles"), ".css");
const sourceCSS = (await Promise.all(sourceStyles.map((path) => readFile(path, "utf8")))).join("\n");
const fieldbookCSS = await readFile(resolve("src/styles/fieldbook.css"), "utf8");
const baseSource = await readFile(resolve("src/layouts/Base.astro"), "utf8");
const activeSourceCSS = stripCSSComments(sourceCSS);
const activeFieldbookCSS = stripCSSComments(fieldbookCSS);
const htmlFiles = await collectFiles(resolve("dist"), ".html");
const linkedStylesheetPaths = new Set();
for (const htmlPath of htmlFiles) {
  const html = await readFile(htmlPath, "utf8");
  for (const [, href] of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"[^>]*>/g)) {
    if (href === "/pagefind/pagefind-ui.css") continue;
    linkedStylesheetPaths.add(resolve("dist", href.replace(/^\//, "")));
  }
}
const linkedBuiltCSS = (await Promise.all([...linkedStylesheetPaths].map(async (path) => {
  const css = await readOrFail(path, "linked built stylesheet");
  return css?.toString("utf8") ?? "";
}))).join("\n");
const activeBuiltCSS = stripCSSComments(linkedBuiltCSS);

for (const [token, expected] of Object.entries(palette)) {
  const match = activeSourceCSS.match(new RegExp(`${token}\\s*:\\s*(#[\\da-f]{6})`, "i"));
  if (!match || match[1].toUpperCase() !== expected.toUpperCase()) {
    failures.push(`${token} must resolve to ${expected}`);
  }
}

if (/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|@import\s+(?:url\(\s*)?["']?(?:https?:)?\/\/)/i.test(activeSourceCSS)) {
  failures.push("source styles contain a remote font import or request");
}

const sourceFontFaces = fontFaceBlocks(activeSourceCSS);
const builtFontFaces = fontFaceBlocks(activeBuiltCSS);
const hasRemoteFontSource = (faces) => faces.some((face) => urlsIn(declarationValue(face, "src")).some(isRemoteURL));
if (hasRemoteFontSource(sourceFontFaces)) failures.push("source styles contain a remote @font-face source");
if (hasRemoteFontSource(builtFontFaces)) failures.push("linked built styles contain a remote @font-face source");

const assertCanonicalFace = (faces, { family, url, weights }, scope) => {
  const familyFaces = faces.filter((face) => unquote(declarationValue(face, "font-family")) === family);
  const boundFace = familyFaces.find((face) => urlsIn(declarationValue(face, "src")).includes(url));
  if (!familyFaces.length) {
    failures.push(`${scope} has no active ${family} @font-face declaration`);
    return;
  }
  if (!boundFace) {
    failures.push(`${scope} ${family} @font-face is not bound to ${url}`);
    return;
  }
  if (urlsIn(declarationValue(boundFace, "src")).some(isRemoteURL)) failures.push(`${scope} ${family} @font-face uses a remote source`);
  if (declarationValue(boundFace, "font-display").toLowerCase() !== "swap") failures.push(`${scope} ${family} @font-face does not use font-display: swap`);
  if (declarationValue(boundFace, "font-weight").replace(/\s+/g, " ") !== weights) failures.push(`${scope} ${family} @font-face does not declare weight range ${weights}`);
};

const provenanceBuffer = await readOrFail(resolve("public/fonts/PROVENANCE.md"), "font provenance document");
const provenance = provenanceBuffer?.toString("utf8") ?? "";
if (!/Pinned (?:release|commit):/i.test(provenance)) failures.push("public/fonts/PROVENANCE.md does not identify a pinned upstream revision");
const licenseCache = new Map();
for (const font of fonts) {
  const { file, builtFile, family, sha256, licenseFile, licensePattern } = font;
  const buffer = await readOrFail(resolve(file), family);
  if (buffer && (buffer.length < 1_000 || buffer.subarray(0, 4).toString("ascii") !== "wOF2")) {
    failures.push(`${file} is not a valid WOFF2 asset`);
  }
  if (buffer && createHash("sha256").update(buffer).digest("hex") !== sha256) failures.push(`${file} does not match its pinned SHA-256`);
  const builtBuffer = await readOrFail(resolve(builtFile), `${family} built asset`);
  if (buffer && builtBuffer && !buffer.equals(builtBuffer)) failures.push(`${builtFile} does not match ${file}`);
  const provenanceEntry = new RegExp(`${basename(file).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*${sha256}`, "i");
  if (!provenanceEntry.test(provenance)) failures.push(`public/fonts/PROVENANCE.md does not bind ${basename(file)} to its pinned SHA-256`);
  if (!licenseCache.has(licenseFile)) licenseCache.set(licenseFile, await readOrFail(resolve(licenseFile), `${family} license`));
  const license = licenseCache.get(licenseFile)?.toString("utf8") ?? "";
  if (!/SIL OPEN FONT LICENSE Version 1\.1/i.test(license) || !licensePattern.test(license)) failures.push(`${licenseFile} does not license ${family}`);

  assertCanonicalFace(sourceFontFaces, font, "source CSS");
  assertCanonicalFace(builtFontFaces, font, "linked built CSS");
}

if (!/@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/i.test(activeFieldbookCSS)) failures.push("fieldbook.css does not enable progressive cross-document View Transitions");
if (!/@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/i.test(activeBuiltCSS)) failures.push("linked built CSS does not enable progressive cross-document View Transitions");
if (!/view-transition-name:\s*site-brand/i.test(activeFieldbookCSS)) failures.push("fieldbook.css does not provide the stable site-brand View Transition name");
if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*::view-transition-group\(\*\)\s*\{\s*animation-duration:\s*0\.01ms;?\s*\}/i.test(activeFieldbookCSS)) {
  failures.push("fieldbook.css does not collapse View Transitions under reduced motion");
}

let darkHeadingCount = 0;
for (const htmlPath of htmlFiles) {
  const page = relative(resolve("dist"), htmlPath);
  const rawHTML = await readFile(htmlPath, "utf8");
  const { document, url } = await inlineStylesheets(rawHTML, page);
  const window = new Window({ url });
  window.document.write(document);

  const headings = [...window.document.querySelectorAll("h1")];
  if (headings.length !== 1) failures.push(`${page} renders ${headings.length} h1 elements; expected exactly one`);
  for (const heading of headings) {
    const foreground = resolveColor(window, window.getComputedStyle(heading).color);
    let background = null;
    let ancestor = heading;
    while (ancestor && (!background || background.a === 0)) {
      background = resolveColor(window, window.getComputedStyle(ancestor).backgroundColor)
        ?? declaredBackground(window, ancestor);
      ancestor = ancestor.parentElement;
    }
    if (background && luminance(background) <= 0.25) {
      darkHeadingCount += 1;
      if (!foreground) {
        failures.push(`${page} does not resolve its dark-surface h1 color`);
      } else {
        const ratio = contrast(foreground, background);
        if (ratio < 4.5) failures.push(`${page} dark-surface h1 contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
      }
    }
  }

  for (const { token, family } of fonts) {
    const resolved = resolveCustomProperty(window, token);
    if (!resolved || !resolved.includes(`"${family}"`) || /^(serif|sans-serif|monospace)$/i.test(resolved)) {
      failures.push(`${page} does not resolve ${token} to local ${family}`);
    }
  }
  window.close();
}

const homeHTML = await readFile(resolve("dist/index.html"), "utf8");
const { document: interactiveHome } = await inlineStylesheets(homeHTML, "index.html");
const noScriptWindow = new Window({ url: "https://example.test/" });
noScriptWindow.document.write(interactiveHome);
const siteTitle = baseSource.match(/const siteTitle = "([^"]+)";/)?.[1] ?? "";
const fullTitleExpression = baseSource.match(/const fullTitle = ([^;]+);/)?.[1] ?? "";
const defaultTitlePosition = fullTitleExpression.match(/:\s*`\$\{siteTitle\}\s*\|\s*([^`$]+)`\s*$/)?.[1].trim() ?? "";
const defaultDescription = baseSource.match(/const desc = description \?\? "([^"]+)";/)?.[1] ?? "";
const personJSON = [...noScriptWindow.document.querySelectorAll("script[type='application/ld+json']")]
  .map((script) => {
    try { return JSON.parse(script.textContent); } catch { return null; }
  })
  .find((entry) => entry?.["@type"] === "Person");
if (!siteTitle || !defaultTitlePosition || /[,;&|]/.test(defaultTitlePosition)) failures.push("Base default title must use one conservative canonical position");
if (!defaultDescription || defaultDescription.length > 100) failures.push("default description must be concise natural language");
if (!personJSON || (Array.isArray(personJSON.jobTitle) ? personJSON.jobTitle.length > 2 : typeof personJSON.jobTitle !== "string")) failures.push("Person metadata has an inflated jobTitle inventory");
if (!Array.isArray(personJSON?.knowsAbout) || personJSON.knowsAbout.length > 5) failures.push("Person metadata has an inflated knowsAbout inventory");
const footerLocations = noScriptWindow.document.querySelector(".site-footer")?.textContent.match(/St\. Louis, Missouri/g)?.length ?? 0;
if (footerLocations !== 1) failures.push(`footer must state St. Louis, Missouri once; found ${footerLocations}`);
for (const token of ["--ef-motion-fast", "--ef-motion-medium", "--ef-ease-standard"]) {
  if (!resolveCustomProperty(noScriptWindow, token)) failures.push(`index.html does not resolve purposeful motion token ${token}`);
}
const revealProbe = noScriptWindow.document.createElement("div");
revealProbe.setAttribute("data-fieldbook-reveal", "");
noScriptWindow.document.body.append(revealProbe);
const noScriptStyle = noScriptWindow.getComputedStyle(revealProbe);
if (noScriptStyle.opacity !== "1" || !["none", ""].includes(noScriptStyle.transform)) {
  failures.push("fieldbook reveal content is not visible without JavaScript");
}
revealProbe.remove();
noScriptWindow.document.documentElement.classList.add("has-js");
const enhancedRevealProbe = noScriptWindow.document.createElement("div");
enhancedRevealProbe.setAttribute("data-fieldbook-reveal", "");
noScriptWindow.document.body.append(enhancedRevealProbe);
if (noScriptWindow.getComputedStyle(enhancedRevealProbe).opacity !== "0") failures.push("fieldbook reveal state has no purposeful pre-reveal transition");
enhancedRevealProbe.setAttribute("data-revealed", "");
if (noScriptWindow.getComputedStyle(enhancedRevealProbe).opacity !== "1") failures.push("fieldbook reveal state does not expose completed content");

const mobilePrimaryContract = {
  position: "static",
  inset: "auto",
  padding: "0px",
  border: "0px",
  "box-shadow": "none",
};
const primaryReset = selectorRules(noScriptWindow, ".primary-nav").find((rule) => (
  Object.entries(mobilePrimaryContract).every(([property, expected]) => rule.style.getPropertyValue(property).trim() === expected)
));
if (!primaryReset || !primaryReset.style.getPropertyValue("background")) {
  failures.push("mobile .primary-nav does not fully reset the inherited absolute positioning and chrome");
}

const noScriptSheet = noScriptWindow.document.querySelector("[data-mobile-nav-sheet]");
const noScriptPrimary = noScriptWindow.document.querySelector(".primary-nav");
for (const width of [390, 320]) {
  noScriptWindow.document.documentElement.classList.remove("has-js");
  noScriptSheet?.classList.remove("is-open");
  if (noScriptPrimary) {
    const primaryLayout = cascadedPropertiesAtWidth(noScriptWindow, noScriptPrimary, width, ["position", "display"]);
    if (primaryLayout.position !== "static" || primaryLayout.display !== "grid") failures.push(`${width}px no-JavaScript primary navigation escapes normal flow`);
  }
  if (noScriptSheet) {
    const fallbackLayout = cascadedPropertiesAtWidth(noScriptWindow, noScriptSheet, width, ["position", "visibility", "opacity", "pointer-events"]);
    if (fallbackLayout.position !== "static" || fallbackLayout.visibility !== "visible" || fallbackLayout.opacity !== "1" || fallbackLayout["pointer-events"] !== "auto") {
      failures.push(`${width}px no-JavaScript navigation sheet is not exposed in normal flow`);
    }
  }

  noScriptWindow.document.documentElement.classList.add("has-js");
  noScriptSheet?.classList.add("is-open");
  if (noScriptSheet) {
    const enhancedLayout = cascadedPropertiesAtWidth(noScriptWindow, noScriptSheet, width, ["position", "visibility", "opacity", "pointer-events", "overflow-y"]);
    if (enhancedLayout.position !== "absolute" || enhancedLayout.visibility !== "visible" || enhancedLayout.opacity !== "1" || enhancedLayout["pointer-events"] !== "auto" || enhancedLayout["overflow-y"] !== "auto") {
      failures.push(`${width}px enhanced navigation sheet does not contain and scroll its open state`);
    }
  }
}

for (const selector of [".site-brand", ".footer-brand", ".secondary-nav a", ".footer-links a", ".site-footer-bottom button"]) {
  if (!hasDeclarationContract(noScriptWindow, selector, { "min-width": "44px", "min-height": "44px" })) {
    failures.push(`${selector} does not declare a 44 by 44 CSS-pixel touch target`);
  }
}
noScriptWindow.close();

const window = new Window({
  url: "https://example.test/",
  settings: {
    enableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    suppressInsecureJavaScriptEnvironmentWarning: true,
  },
});
window.document.write(interactiveHome);
await window.happyDOM.waitUntilComplete();

const toggle = window.document.querySelector(".nav-toggle");
const sheet = window.document.querySelector("[data-mobile-nav-sheet]");
const navSurface = window.document.querySelector("[data-nav-surface]");
const backdrop = window.document.querySelector("[data-nav-backdrop]");
const visibleLabel = toggle?.querySelector(".nav-toggle-label");
const primaryLinks = [...(sheet?.querySelectorAll("[data-primary-nav] > a") ?? [])];
const primaryContract = primaryLinks.map((link) => `${link.textContent.trim()}:${link.getAttribute("href")}`);
const expectedPrimary = ["Work:/work", "Research:/research", "Teaching:/teaching", "About:/about", "CV:/cv"];

if (!toggle || !sheet || !navSurface || toggle.getAttribute("aria-controls") !== sheet.id) failures.push("mobile navigation lacks a controlling button, modal surface, and identified sheet");
if (!visibleLabel || visibleLabel.textContent.trim() !== "Menu" || visibleLabel.classList.contains("sr-only")) failures.push("mobile navigation toggle needs a visible Menu label");
if (JSON.stringify(primaryContract) !== JSON.stringify(expectedPrimary)) failures.push(`primary navigation must be ${expectedPrimary.join(", ")}`);
if (!sheet?.querySelector("[data-secondary-nav] a[href='/job-market']")) failures.push("mobile navigation needs a secondary Job market record link");
if (!sheet?.querySelector("button[data-index-open]")) failures.push("mobile navigation needs Index as a utility control");
if (!sheet?.querySelector("a.nav-cta[href='/contact']")) failures.push("mobile navigation needs Contact as its single action");
if (!backdrop || backdrop.tagName !== "BUTTON" || backdrop.getAttribute("aria-hidden") !== "true" || backdrop.getAttribute("tabindex") !== "-1") failures.push("mobile navigation needs a pointer-only backdrop outside the focus order");

if (toggle && sheet && navSurface && visibleLabel && backdrop) {
  toggle.focus();
  toggle.click();
  if (toggle.getAttribute("aria-expanded") !== "true" || !sheet.classList.contains("is-open")) failures.push("mobile navigation does not expose its open state");
  if (!window.document.body.classList.contains("nav-open")) failures.push("opening mobile navigation does not lock body scroll");
  if (!sheet.contains(window.document.activeElement)) failures.push("opening mobile navigation does not move focus into the sheet");
  if (visibleLabel.textContent.trim() !== "Close") failures.push("open mobile navigation does not show a visible Close label");
  if (navSurface.getAttribute("role") !== "dialog" || navSurface.getAttribute("aria-modal") !== "true") failures.push("open mobile navigation does not expose modal dialog semantics");
  for (const selector of ["main", ".site-footer", ".site-brand"]) {
    const background = window.document.querySelector(selector);
    if (!background?.hasAttribute("inert") || background.getAttribute("aria-hidden") !== "true") failures.push(`open mobile navigation does not isolate ${selector}`);
  }
  if (toggle.hasAttribute("inert")) failures.push("open mobile navigation makes its visible Close toggle inert");

  const focusable = [toggle, ...sheet.querySelectorAll("a[href], button:not([disabled])")];
  const first = focusable[0];
  const last = focusable.at(-1);
  last?.focus();
  window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  if (window.document.activeElement !== first) failures.push("mobile navigation does not wrap forward focus to the visible Close toggle");
  first?.focus();
  window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
  if (last && window.document.activeElement !== last) failures.push("mobile navigation does not wrap reverse focus from the visible Close toggle");

  window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  if (toggle.getAttribute("aria-expanded") !== "false" || window.document.body.classList.contains("nav-open") || window.document.activeElement !== toggle) {
    failures.push("Escape does not close mobile navigation, unlock scroll, and restore focus");
  }
  if (navSurface.hasAttribute("role") || navSurface.hasAttribute("aria-modal") || window.document.querySelector("main")?.hasAttribute("inert")) {
    failures.push("closing mobile navigation does not restore background semantics");
  }

  toggle.click();
  backdrop.click();
  if (toggle.getAttribute("aria-expanded") !== "false") failures.push("backdrop selection does not close mobile navigation");

  toggle.click();
  primaryLinks[0]?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  if (toggle.getAttribute("aria-expanded") !== "false") failures.push("navigation selection does not close mobile navigation");
}
window.close();

if (failures.length) {
  console.error(`Rendered style check failed:\n- ${[...new Set(failures)].join("\n- ")}`);
  process.exit(1);
}

console.log(`Rendered style check passed for ${htmlFiles.length} pages, ${darkHeadingCount} dark-surface headings, 3 bound local variable fonts, and the mobile navigation semantics/CSS contract.`);
