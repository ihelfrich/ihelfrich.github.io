/* Shared by every chapter of the web edition.
   Fits display mathematics to the column: a display wider than the text switches to its
   stacked form when it has one, and shrinks slightly rather than scroll when it is close.
   Scales an inline formula that is wider than its paragraph, marks figures and tables that
   scroll inside their frames, keeps keyboard focus when a pressed button disables itself, and
   keeps a slider where it was when the finger that touched it was scrolling the page. */
(function () {
  "use strict";
  function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }
  function fit() {
    each(".mdisp.has-narrow", function (wide) {
      var narrow = wide.nextElementSibling;
      wide.style.fontSize = "";
      wide.style.display = "block";
      if (narrow) narrow.style.display = "none";
      var tooWide = wide.scrollWidth > wide.clientWidth + 1;
      if (narrow) {
        wide.style.display = tooWide ? "none" : "block";
        narrow.style.display = tooWide ? "block" : "none";
      }
    });
    each(".mdisp", function (el) {
      if (el.style.display === "none") return;
      el.style.fontSize = "";
      if (!el.clientWidth) return;
      var ratio = el.clientWidth / el.scrollWidth;
      if (ratio < 1 && ratio > 0.75) el.style.fontSize = Math.floor(ratio * 100) + "%";
    });
  }
  // An inline formula cannot break inside itself. One wider than its paragraph is scaled to fit.
  function inline() {
    each(".prose .mi svg", function (svg) {
      if (svg.style.maxWidth) { svg.style.maxWidth = ""; svg.style.height = ""; }
    });
    var wide = [];
    each(".prose .mi svg", function (svg) {
      var box = svg.closest("p, li, td, th, figcaption, dd, dt, h2, h3");
      if (!box || box.closest(".table-wrap, .tikz-wrap, .mdisp")) return;
      var room = box.clientWidth;
      if (room > 40 && svg.getBoundingClientRect().width > room) wide.push([svg, room]);
    });
    wide.forEach(function (w) { w[0].style.maxWidth = w[1] + "px"; w[0].style.height = "auto"; });
  }
  // A figure or table wider than its frame scrolls inside it. Mark the frame so the page can
  // show that there is more, give it a name, and let the keyboard reach and scroll it.
  function frames() {
    each(".tikz-wrap, .table-wrap", function (el) {
      var scrolls = el.scrollWidth > el.clientWidth + 1;
      el.classList.toggle("scrolls", scrolls);
      if (scrolls) {
        var owner = el.closest("figure") || el;
        var num = owner.querySelector(".fignum, .tabnum");
        var name = num ? num.textContent.replace(/:\s*$/, "") : "";
        if (!/^(Figure|Table)\s+\d/.test(name)) {
          var table = el.querySelector("table");
          var own = table && (table.getAttribute("aria-label") || (table.caption && table.caption.textContent.trim()));
          name = own ? "The table \u201c" + own + "\u201d" : (table ? "This table" : "This figure");
        }
        el.tabIndex = 0;
        el.setAttribute("role", "group");
        el.setAttribute("aria-label", name + " is wider than the screen and scrolls sideways");
      } else {
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
      }
    });
  }
  function all() { fit(); inline(); frames(); }
  all();
  var last = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth !== last) { last = window.innerWidth; all(); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
  // A live table can grow or shrink with the reader's input; its frame is measured again then.
  if (window.ResizeObserver) {
    var pending = 0;
    var watch = new ResizeObserver(function () {
      if (pending) return;
      pending = requestAnimationFrame(function () { pending = 0; frames(); });
    });
    each(".tikz-wrap > *, .table-wrap > *", function (el) { watch.observe(el); });
  }
  // A button that disables or redraws itself when pressed drops keyboard focus to the top of the
  // page. Hand focus to the nearest control that can still take it. Chrome goes on reporting a
  // button that has just disabled itself as the focused element until it next draws the page, so
  // the check runs again after that, and a disabled element counts as focus lost.
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest(".prose figure button, .prose .calc button") : null;
    if (!b) return;
    var scopes = [b.closest(".buttons"), b.closest(".controls"), b.closest("figure, .calc")];
    function settle() {
      var a = document.activeElement;
      if (a && a !== document.body && a.isConnected && !a.disabled) return;
      if (a && a !== document.body && a !== b) return;
      if (b.isConnected && !b.disabled) { b.focus({ preventScroll: true }); return; }
      for (var i = 0; i < scopes.length; i++) {
        var next = scopes[i] && Array.prototype.filter.call(scopes[i].querySelectorAll("button, input, select, [tabindex='0']"), function (el) { return !el.disabled && el.offsetParent; })[0];
        if (next) { next.focus({ preventScroll: true }); return; }
      }
    }
    setTimeout(settle, 0);
    requestAnimationFrame(function () { requestAnimationFrame(settle); });
    setTimeout(settle, 150);
  });
  // On a touch screen a slider jumps to the point a finger lands on, before the browser knows
  // whether the finger is moving the slider or scrolling the page. The figure is not told of that
  // first jump. If the browser takes the touch for scrolling, it cancels the touch and the slider
  // goes back, with the figure none the wiser. If the finger slides or lifts, the figure hears.
  // Each finger has its own record, so a second finger elsewhere on the page changes nothing.
  var landed = {};
  function heldOn(el) {
    for (var id in landed) if (landed[id].el === el) return landed[id];
    return null;
  }
  document.addEventListener("pointerdown", function (e) {
    var t = e.target;
    if (e.pointerType === "touch" && t && t.matches && t.matches('.prose input[type="range"]')) {
      landed[e.pointerId] = { el: t, value: t.value, held: false, heard: false };
    }
  }, true);
  document.addEventListener("input", function (e) {
    var t = e.isTrusted ? heldOn(e.target) : null;
    if (!t) return;
    if (!t.held && !t.heard) { t.held = true; e.stopImmediatePropagation(); return; }
    t.held = false;
    t.heard = true;
  }, true);
  document.addEventListener("pointerup", function (e) {
    var t = landed[e.pointerId];
    if (!t) return;
    delete landed[e.pointerId];
    if (t.held && t.el.isConnected) t.el.dispatchEvent(new Event("input", { bubbles: true }));
  }, true);
  document.addEventListener("pointercancel", function (e) {
    var t = landed[e.pointerId];
    if (!t) return;
    delete landed[e.pointerId];
    if (t.held && t.el.isConnected && t.el.value !== t.value) t.el.value = t.value;
  }, true);
})();

