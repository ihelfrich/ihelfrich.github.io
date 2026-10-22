import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { computeLayouts } from "../../src/lib/gravity-layout.mjs";
import { mountHomeGraph, PAINT_ORDER, LABEL_HALO_PX } from "../../src/scripts/home-graph.mjs";

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

function setup({ reduce = false } = {}) {
  const w = new Window({ url: "https://example.test/" }), d = w.document;
  d.body.innerHTML = MARKUP;
  const frames = new Map(), texts = [];
  let next = 0, clock = 0;
  w.requestAnimationFrame = (fn) => { frames.set(++next, fn); return next; };
  w.cancelAnimationFrame = (id) => frames.delete(id);
  const media = {};
  w.matchMedia = (q) => (media[q] ??= Object.assign(new w.EventTarget(), { matches: q.includes("reduce") ? reduce : false }));
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.IntersectionObserver = class { constructor(fn) { this.fn = fn; } observe() { this.fn([{ isIntersecting: true }]); } disconnect() {} };
  const ctx = new Proxy({ fillStyle: "#000", measureText: (t) => ({ width: t.length * 6.5 }), fillText: (t) => texts.push(t), getImageData: () => ({ data: [0, 0, 0, 255] }) }, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  const root = d.querySelector("[data-home-graph]"), stage = d.querySelector("[data-hg-stage]");
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H });
  const navigated = [];
  const dispose = mountHomeGraph(root, { load: async () => structuredClone(FIELD), navigate: (u) => navigated.push(u) });
  const run = (limit = 2000) => { // advance animation frames until the loop goes idle
    let k = 0;
    while (frames.size && k++ < limit) { const [id, fn] = frames.entries().next().value; frames.delete(id); clock += 16.7; fn(clock); }
    return k;
  };
  const key = (k) => stage.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const pointer = (type, x, y, pointerType = "touch") => stage.dispatchEvent(new w.PointerEvent(type, { clientX: x, clientY: y, pointerType, pointerId: 1, button: 0, bubbles: true, cancelable: true }));
  const ready = async () => { for (let k = 0; k < 400 && stage.getAttribute("aria-busy") !== "false"; k++) await new Promise((r) => w.setTimeout(r, 5));
    assert.equal(stage.getAttribute("aria-busy"), "false", "the map mounted"); };
  return { w, d, root, stage, frames, texts, navigated, dispose, run, key, pointer, ready, media };
}
const restXY = (id) => { const i = NODES.findIndex((n) => n.id === id); return [FIELD.layout.wide.xy[2 * i] * W, FIELD.layout.wide.xy[2 * i + 1] * H]; };

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

test("Enter centres the page under the cursor and a second Enter opens it; arrows move the cursor", async () => {
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
  assert.equal(t.frames.size, 1, "one redraw");
  assert.equal(t.run(), 1, "and no physics frames after it");
  assert.match(t.d.querySelector("[data-hg-card] h3").textContent, /Contact/);
  t.dispose(); await t.w.happyDOM.abort();
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
