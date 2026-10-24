import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { computeLayouts } from "../../src/lib/gravity-layout.mjs";
import { HOVER_MS, mountHomeGraph, PAINT_ORDER, LABEL_HALO_PX } from "../../src/scripts/home-graph.mjs";

const NODES = [
  ["/", "Home", "Home", 200, "page", ["profile"]],
  ["/job-market/", "Job market", "Job market", 60, "page", ["profile"]],
  ["/research/helfrich-2026-nmtc-rural-gap/", "The NMTC paper", "NMTC rural gap (2026)", 80, "paper", ["place"]],
  ["/contact/", "Contact", "Contact", 20, "page", ["profile"]],
  ["/projects/x/", "A tool", "Tool X", 40, "tool", ["trade"]],
  ["/teaching/", "Teaching", "Teaching", 70, "page", ["teaching"]],
  ["/datasets/y/", "Some data", "Data Y", 30, "data", ["measurement"]],
].map(([id, title, label, kb, type, topics]) => ({ id, title, label, desc: `${title}. A second sentence.`, kb, type, topics }));
const LINKS = [[0, 1], [0, 2], [0, 3], [1, 2], [2, 4], [4, 5], [0, 5], [5, 6]];
const FIELD = { nodes: NODES, links: LINKS, layout: computeLayouts(NODES, LINKS) };
const W = 900, H = 640;

const MARKUP = `<section data-home-graph>
  <nav><ul class="hg-links"><li><a href="/job-market/" data-id="/job-market/">Job market</a></li><li><a href="/contact/" data-id="/contact/">Contact</a></li></ul></nav>
  <div data-hg-wrap><div data-hg-stage aria-busy="true"><canvas data-hg-terrain></canvas><canvas data-hg-scene></canvas></div>
  <button type="button" data-hg-back hidden>Back to topics</button><ul data-hg-rings hidden></ul></div>
  <div data-hg-card hidden></div><p data-hg-live></p></section>`;

function setup({ reduce = false, width = W, height = H } = {}) {
  const w = new Window({ url: "https://example.test/" }), d = w.document;
  d.body.innerHTML = MARKUP;
  const frames = new Map(), texts = [], at = new Map(), dashes = [];
  let next = 0, clock = 0;
  w.requestAnimationFrame = (fn) => { frames.set(++next, fn); return next; };
  w.cancelAnimationFrame = (id) => frames.delete(id);
  const media = {};
  w.matchMedia = (q) => (media[q] ??= Object.assign(new w.EventTarget(), { matches: q.includes("reduce") ? reduce : false }));
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.IntersectionObserver = class { constructor(fn) { this.fn = fn; } observe() { this.fn([{ isIntersecting: true }]); } disconnect() {} };
  const ctx = new Proxy({
    fillStyle: "#000", measureText: (t) => ({ width: t.length * 6.5 }), getImageData: () => ({ data: [0, 0, 0, 255] }),
    fillText: (t, x, y) => { texts.push(t); at.set(t, [x, y]); }, setLineDash: (d) => dashes.push(d.join(",")),
  }, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  const root = d.querySelector("[data-home-graph]"), stage = d.querySelector("[data-hg-stage]");
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height });
  const navigated = [];
  const dispose = mountHomeGraph(root, { load: async () => structuredClone(FIELD), navigate: (u) => navigated.push(u) });
  const run = (limit = 2000) => { // advance animation frames until the loop goes idle
    let k = 0;
    while (frames.size && k++ < limit) { const [id, fn] = frames.entries().next().value; frames.delete(id); clock += 16.7; fn(clock); }
    return k;
  };
  const key = (k) => stage.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const pointer = (type, x, y, pointerType = "touch") => stage.dispatchEvent(new w.PointerEvent(type, { clientX: x, clientY: y, pointerType, pointerId: 1, button: 0, bubbles: true, cancelable: true }));
  const click = (x, y) => { pointer("pointerdown", x, y, "mouse"); pointer("pointerup", x, y, "mouse"); };
  const ready = async () => { for (let k = 0; k < 400 && stage.getAttribute("aria-busy") !== "false"; k++) await new Promise((r) => w.setTimeout(r, 5));
    assert.equal(stage.getAttribute("aria-busy"), "false", "the map mounted"); };
  return { w, d, root, stage, frames, texts, at, dashes, navigated, dispose, run, key, pointer, click, ready, media };
}
const restXY = (id, width = W, height = H) => {
  const i = NODES.findIndex((n) => n.id === id), xy = FIELD.layout[width < 600 ? "narrow" : "wide"].xy;
  return [xy[2 * i] * width, xy[2 * i + 1] * height];
};

test("the map paints labels last with a halo, and the export contract is stable", () => {
  assert.deepEqual(PAINT_ORDER, ["terrain", "links", "marks", "labels"]);
  assert.ok(LABEL_HALO_PX >= 4);
});

test("mounting builds a listbox of every page, labels the NMTC paper for the home page, and goes idle", async () => {
  const t = setup();
  await t.ready();
  assert.equal(t.stage.getAttribute("role"), "listbox");
  assert.equal(t.stage.tabIndex, 0);
  const options = t.stage.querySelectorAll("[role=option]");
  assert.equal(options.length, NODES.length);
  assert.match(options[4].textContent, /\bTool\b/);
  assert.doesNotMatch(t.root.textContent, /Instrument/);
  assert.ok(t.run() < 2000, "the intro animation comes to rest");
  assert.equal(t.frames.size, 0, "no animation frames are requested once the pages have settled");
  assert.ok(t.texts.includes("Working paper: NMTC rural gap"), "the home landmark label is drawn");
  assert.ok(!t.texts.some((s) => /NMTC rural gap \(2026\)|Job market paper|JMP/.test(s)));
  assert.ok(t.texts.includes("Contact"), "Contact is labelled at rest");
  t.dispose(); await t.w.happyDOM.abort();
});

test("Enter centers the page under the cursor and a second Enter opens it; arrows move the cursor", async () => {
  const t = setup();
  await t.ready(); t.run();
  t.stage.focus();
  t.stage.dispatchEvent(new t.w.FocusEvent("focus"));
  t.key("Enter");
  assert.equal(t.stage.querySelector('[aria-selected="true"]').textContent.split(".")[0], "Home");
  assert.equal(t.d.querySelector("[data-hg-card]").hidden, false);
  assert.match(t.d.querySelector("[data-hg-live]").textContent, /^Home, page\. 4 linked pages/);
  assert.equal(t.d.querySelector("[data-hg-back]").hidden, false);
  t.key("Enter");
  assert.deepEqual(t.navigated, ["/"]);
  t.key("ArrowRight");
  const cursor = t.stage.getAttribute("aria-activedescendant");
  const target = NODES[Number(cursor.split("-").pop())].id;
  assert.notEqual(target, "/");
  t.key("Enter"); t.key("Enter");
  assert.deepEqual(t.navigated, ["/", target], "the second Enter opens the page the cursor chose");
  t.key("Escape");
  assert.equal(t.d.querySelector("[data-hg-back]").hidden, true);
  t.run(); t.dispose(); await t.w.happyDOM.abort();
});

test("a tap chooses a page, a second tap opens it, and a swipe never selects or blocks scrolling", async () => {
  const t = setup();
  await t.ready(); t.run();
  const [x, y] = restXY("/job-market/");
  const start = new t.w.Event("touchstart", { bubbles: true, cancelable: true });
  t.stage.dispatchEvent(start);
  assert.equal(start.defaultPrevented, false, "touchstart is never cancelled");
  // A swipe that starts on a mark: the browser cancels the pointer and scrolls; nothing is chosen.
  t.pointer("pointerdown", x, y); t.pointer("pointermove", x, y - 30);
  const move = new t.w.Event("touchmove", { bubbles: true, cancelable: true });
  t.stage.dispatchEvent(move);
  assert.equal(move.defaultPrevented, false, "touchmove is not cancelled without a long press");
  t.pointer("pointercancel", x, y - 30);
  assert.equal(t.stage.querySelector('[aria-selected="true"]'), null);
  // Tap, then tap the same page again once it has moved to the centre.
  t.pointer("pointerdown", x, y); t.pointer("pointerup", x, y);
  assert.match(t.stage.querySelector('[aria-selected="true"]').textContent, /^Job market/);
  t.run();
  t.pointer("pointerdown", W / 2, H / 2); t.pointer("pointerup", W / 2, H / 2);
  assert.deepEqual(t.navigated, ["/job-market/"]);
  t.dispose(); await t.w.happyDOM.abort();
});

test("a still long press starts a drag, and only then is touchmove cancelled", async () => {
  const t = setup();
  await t.ready(); t.run();
  const [x, y] = restXY("/teaching/");
  t.pointer("pointerdown", x, y);
  await new Promise((r) => t.w.setTimeout(r, 340));
  assert.ok(t.stage.classList.contains("is-dragging"));
  const move = new t.w.Event("touchmove", { bubbles: true, cancelable: true });
  t.stage.dispatchEvent(move);
  assert.equal(move.defaultPrevented, true);
  t.pointer("pointermove", x + 40, y + 20);
  t.pointer("pointerup", x + 40, y + 20);
  assert.ok(!t.stage.classList.contains("is-dragging"));
  assert.equal(t.stage.querySelector('[aria-selected="true"]'), null, "a drag does not choose the page");
  assert.ok(t.run() < 2000); assert.equal(t.frames.size, 0);
  t.dispose(); await t.w.happyDOM.abort();
});

test("on a phone, first-ring labels come in landmark order and a long one wraps onto two lines", async () => {
  const t = setup({ reduce: true, width: 360, height: 476 });
  await t.ready();
  t.stage.dispatchEvent(new t.w.FocusEvent("focus"));
  const from = t.texts.length;
  t.key("Enter"); // the cursor starts on Home
  t.run();
  const drawn = t.texts.slice(from), at = (s) => drawn.indexOf(s);
  assert.ok(drawn.includes("Home\u00a0↗"), "the chosen page is labelled");
  for (const s of ["Job market", "Working paper:", "NMTC rural gap", "Contact", "Teaching"]) assert.ok(at(s) >= 0, `${s} is drawn`);
  assert.ok(!drawn.includes("Working paper: NMTC rural gap"), "the long label is wrapped on a narrow stage");
  assert.equal(at("NMTC rural gap"), at("Working paper:") + 1, "its two lines are drawn together");
  assert.ok(at("Job market") < at("Working paper:") && at("Working paper:") < at("Contact") && at("Contact") < at("Teaching"),
    "landmark order, not mass order, decides which labels are placed first");
  t.dispose(); await t.w.happyDOM.abort();
});

test("a phone tap scrolls Open page into view but keeps the chosen page clear of the bars stuck at the top", async () => {
  const t = setup({ reduce: true, width: 360, height: 476 });
  await t.ready();
  const bar = (cls, top, bottom) => {
    const el = t.d.createElement("div");
    el.className = cls; el.style.position = "sticky";
    el.getBoundingClientRect = () => ({ top, bottom, height: bottom - top, left: 0, right: 390, width: 390 });
    t.d.body.prepend(el);
  };
  bar("site-header", 0, 73); bar("st-experience-nav", 73, 134);
  Object.defineProperty(t.w, "innerHeight", { value: 844, configurable: true });
  const top = 200;
  t.stage.getBoundingClientRect = () => ({ left: 0, top, width: 360, height: 476, right: 360, bottom: top + 476 });
  const proto = t.w.HTMLElement.prototype, rect = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function () { return this.classList.contains("hg-open") ? { top: 1100, bottom: 1140, height: 40, left: 0, right: 120, width: 120 } : rect.call(this); };
  const scrolls = [];
  t.w.scrollBy = (o) => scrolls.push(o.top);
  const [x, y] = restXY("/contact/", 360, 476);
  t.pointer("pointerdown", x, y + top); t.pointer("pointerup", x, y + top);
  assert.match(t.stage.querySelector('[aria-selected="true"]').textContent, /^Contact/);
  assert.equal(scrolls.length, 1);
  // The chosen page sits at the centre of its rings, 238 px into the stage; it must stay 48 px below the bars.
  assert.ok(top + 238 - scrolls[0] >= 134 + 48 - 1e-9, `the chosen page stays below the section chips (scrolled ${scrolls[0]})`);
  assert.ok(scrolls[0] > 0);
  proto.getBoundingClientRect = rect;
  t.dispose(); await t.w.happyDOM.abort();
});

test("under reduced motion a choice jumps to its final state without animation frames", async () => {
  const t = setup({ reduce: true });
  await t.ready();
  assert.equal(t.frames.size, 0, "no intro animation");
  t.stage.dispatchEvent(new t.w.FocusEvent("focus"));
  t.key("ArrowRight"); t.key("Enter");
  assert.ok(t.stage.querySelector('[aria-selected="true"]'));
  assert.equal(t.frames.size <= 1, true, "at most one redraw is queued");
  t.run(); assert.equal(t.frames.size, 0);
  t.dispose(); await t.w.happyDOM.abort();
});

test("hovering a section link highlights its page without waking the physics", async () => {
  const t = setup();
  await t.ready(); t.run();
  const link = t.d.querySelector('.hg-links a[data-id="/contact/"]');
  link.dispatchEvent(new t.w.MouseEvent("mouseenter"));
  assert.equal(t.frames.size, 0, "nothing changes until the pointer rests");
  await new Promise((r) => t.w.setTimeout(r, HOVER_MS + 30));
  assert.equal(t.frames.size, 1, "one redraw");
  assert.equal(t.run(), 1, "and no physics frames after it");
  assert.match(t.d.querySelector("[data-hg-card] h3").textContent, /Contact/);
  t.dispose(); await t.w.happyDOM.abort();
});

test("a quick sweep across the section links changes the card at most once", async () => {
  const t = setup();
  await t.ready(); t.run();
  const card = t.d.querySelector("[data-hg-card]");
  const seen = [];
  new t.w.MutationObserver(() => seen.push(card.querySelector("h3")?.textContent ?? null)).observe(card, { childList: true, subtree: true });
  const links = [...t.d.querySelectorAll(".hg-links a[data-id]")];
  for (const a of links) { a.dispatchEvent(new t.w.MouseEvent("mouseenter")); await new Promise((r) => t.w.setTimeout(r, 20)); a.dispatchEvent(new t.w.MouseEvent("mouseleave")); }
  await new Promise((r) => t.w.setTimeout(r, 3 * HOVER_MS));
  assert.equal(seen.length, 0, "the card did not flicker");
  assert.equal(card.hidden, true);
  t.dispose(); await t.w.happyDOM.abort();
});

test("a label is a target: clicking the text of a page's label chooses that page", async () => {
  const t = setup();
  await t.ready(); t.run();
  const [x, y] = t.at.get("Contact");
  t.click(x + ("Contact".length * 6.5) / 2, y + 7);
  assert.match(t.stage.querySelector('[aria-selected="true"]').textContent, /^Contact/);
  t.dispose(); await t.w.happyDOM.abort();
});

test("the dashed keyboard cursor appears for the keyboard, not after mouse clicks", async () => {
  const t = setup();
  await t.ready(); t.run();
  const [x, y] = restXY("/job-market/");
  t.pointer("pointerdown", x, y, "mouse"); t.stage.focus(); t.pointer("pointerup", x, y, "mouse");
  t.run();
  const back = t.d.querySelector("[data-hg-back]");
  back.dispatchEvent(new t.w.PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }));
  back.dispatchEvent(new t.w.MouseEvent("click", { detail: 1, bubbles: true }));
  t.run();
  assert.equal(t.d.activeElement, t.stage);
  assert.ok(!t.dashes.includes("3,3"), "no keyboard cursor after a mouse choice and Back");
  t.key("ArrowRight"); t.run();
  assert.ok(t.dashes.includes("3,3"), "the keyboard cursor shows once a key is pressed");
  t.dispose(); await t.w.happyDOM.abort();
});

test("the listbox is named plainly and describes its keys once", async () => {
  const t = setup();
  await t.ready();
  assert.equal(t.stage.getAttribute("aria-label"), "Site pages");
  const help = t.d.getElementById(t.stage.getAttribute("aria-describedby"));
  assert.match(help.textContent, /^Enter centers the chosen page/);
  t.dispose();
  assert.equal(t.d.getElementById(help.id), null);
  await t.w.happyDOM.abort();
});

test("dispose stops the loop, removes the listbox and its listeners", async () => {
  const t = setup();
  await t.ready();
  assert.ok(t.frames.size > 0);
  t.dispose();
  assert.equal(t.frames.size, 0);
  assert.equal(t.stage.getAttribute("role"), null);
  assert.equal(t.stage.querySelectorAll("[role=option]").length, 0);
  t.key("Enter");
  assert.deepEqual(t.navigated, []);
  t.dispose();
  await t.w.happyDOM.abort();
});
