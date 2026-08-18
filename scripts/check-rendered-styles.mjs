import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Window } from "happy-dom";

const pages = [
  { path: "work/index.html", hero: ".wk-hero" },
  { path: "capabilities/index.html", hero: ".cp-hero" },
];
const failures = [];

const parseColor = (value) => {
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
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
  const match = value.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
};

const colorTokens = (value) => value.match(/#[\da-f]{3,6}\b|rgba?\([^)]*\)/gi) ?? [];

const rulesIn = (rules) => [...rules].flatMap((rule) => {
  if (rule.cssRules) return rulesIn(rule.cssRules);
  return [rule];
});

const declaredBackground = (window, element) => {
  let value = "";
  for (const sheet of window.document.styleSheets) {
    for (const rule of rulesIn(sheet.cssRules)) {
      if (!rule.selectorText || !rule.style || !element.matches(rule.selectorText)) continue;
      value = rule.style.backgroundColor || rule.style.background || value;
    }
  }
  const colors = colorTokens(value);
  for (let index = colors.length - 1; index >= 0; index -= 1) {
    const parsed = parseColor(colors[index]);
    if (parsed && parsed.a > 0) return parsed;
  }
  return null;
};

const heroBackground = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = css.match(new RegExp(`${escaped}[^,{]*\\{([^}]+)\\}`));
  if (!rule) return null;
  const declarations = [...rule[1].matchAll(/background(?:-color)?:([^;]+)/g)];
  const value = declarations.at(-1)?.[1] ?? "";
  const colors = colorTokens(value);
  for (let index = colors.length - 1; index >= 0; index -= 1) {
    const parsed = parseColor(colors[index]);
    if (parsed && parsed.a > 0) return parsed;
  }
  return null;
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

const resolveCustomProperty = (window, name, seen = new Set()) => {
  if (seen.has(name)) return "";
  seen.add(name);
  const value = window.getComputedStyle(window.document.documentElement)
    .getPropertyValue(name)
    .trim();
  const reference = value.match(/^var\(\s*(--[\w-]+)/)?.[1];
  return reference ? resolveCustomProperty(window, reference, seen) : value;
};

for (const { path: page, hero } of pages) {
  const path = resolve("dist", page);
  let html = await readFile(path, "utf8");
  const cssLinks = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"[^>]*>/g)];
  const css = [];
  for (const [, href] of cssLinks) {
    css.push(await readFile(resolve("dist", href.replace(/^\//, "")), "utf8"));
  }
  html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="[^"]+\.css"[^>]*>/g, "");
  html = html.replace("</head>", `<style>${css.join("\n")}</style></head>`);

  const window = new Window({ url: `https://ihelfrich.github.io/${dirname(page)}/` });
  window.document.write(html);
  const heading = window.document.querySelector("h1");
  if (!heading) {
    failures.push(`${page} has no h1`);
    window.close();
    continue;
  }

  const headingStyle = window.getComputedStyle(heading);
  const foreground = parseColor(headingStyle.color);
  let background = heroBackground(css.join("\n"), hero);
  let ancestor = heading;
  while (ancestor && (!background || background.a === 0)) {
    background = parseColor(window.getComputedStyle(ancestor).backgroundColor)
      ?? declaredBackground(window, ancestor);
    ancestor = ancestor.parentElement;
  }

  if (!foreground || !background) {
    failures.push(`${page} does not resolve h1 foreground and background colors`);
  } else {
    const ratio = contrast(foreground, background);
    if (ratio < 4.5) failures.push(`${page} h1 contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
  }

  const displayFont = resolveCustomProperty(window, "--font-display");
  if (!displayFont || /^(serif|sans-serif)$/i.test(displayFont)) {
    failures.push(`${page} has no resolved --font-display token`);
  }
  window.close();
}

if (failures.length) {
  console.error(`Rendered style check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Rendered style check passed for ${pages.length} dark hero headings.`);
