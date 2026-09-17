import { createStreetLabelLoader, thinStreetLabels } from "../../lib/city-street-labels.mjs";

const ORIGIN = [-90.193, 38.628], METRES_PER_DEGREE = 111195;
const LONGITUDE_SCALE = METRES_PER_DEGREE * Math.cos(ORIGIN[1] * Math.PI / 180);

/** Street text stays outside the WebGL pick/depth buffers and the color grade. */
export function createStreetLabelLayer(C, viewer, container, {
  getCenter = () => ({ x: 0, z: 0 }), onStatus = () => {},
  loader = createStreetLabelLoader(),
} = {}) {
  const doc = container.ownerDocument || document;
  const overlay = doc.createElement("div");
  overlay.className = "city-photographic-street-labels";
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, { position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none", zIndex: "2" });
  container.append(overlay);
  // Empty hidden Cesium labels provide the public surface-clamping and screen
  // projection APIs. They draw no glyph, background, pick target, or depth.
  const anchors = viewer.scene.primitives.add(new C.LabelCollection({ scene: viewer.scene }));
  const credit = new C.Credit('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>', true);
  viewer.creditDisplay.addStaticCredit(credit);
  let enabled = true, disposed = false, sequence = 0, timer, controller;
  let rows = [], loadState = "loading", loadReason = null;
  let status = { status: "loading", visibleCount: 0, reason: null };
  const removers = [];

  function publish(visibleCount = 0) {
    const next = { status: enabled ? loadState : "disabled", visibleCount: enabled ? visibleCount : 0, reason: enabled ? loadReason : null };
    if (status.status === next.status && status.visibleCount === next.visibleCount && status.reason === next.reason) return;
    status = next;
    onStatus({ ...status });
  }

  function bounds() {
    const center = getCenter(), canvas = viewer.canvas;
    const height = Math.max(100, Math.abs(viewer.camera.positionCartographic?.height || 0));
    const pitch = viewer.camera.pitch || -Math.PI / 4;
    const fovy = viewer.camera.frustum?.fovy || Math.PI / 3;
    const span = Math.max(450, Math.min(200000, height * 2 * Math.tan(fovy / 2) / Math.max(.25, Math.abs(Math.sin(pitch))) * 1.4));
    const width = span * Math.max(1, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    return [center.x - width / 2, center.z - span / 2, center.x + width / 2, center.z + span / 2];
  }

  function clear() {
    anchors.removeAll();
    overlay.replaceChildren();
    rows = [];
  }

  function replace(labels) {
    clear();
    for (const label of labels) {
      const anchor = anchors.add({ position: C.Cartesian3.fromDegrees(
        ORIGIN[0] + label.x / LONGITUDE_SCALE, ORIGIN[1] - label.z / METRES_PER_DEGREE),
      text: "", show: false, heightReference: C.HeightReference.CLAMP_TO_3D_TILE });
      const element = doc.createElement("span");
      element.textContent = label.name;
      Object.assign(element.style, {
        position: "absolute", left: "0", top: "0", display: "none", pointerEvents: "none",
        color: label.priority <= 2 ? "#fff4db" : "#f6f8fa", background: "rgba(16,24,29,.72)",
        border: "1px solid rgba(234,239,241,.20)", borderRadius: "5px", padding: "3px 7px",
        font: `${label.priority <= 2 ? 650 : 550} 12px/16px system-ui,sans-serif`,
        whiteSpace: "nowrap", textShadow: "0 1px 2px #000,0 0 3px #000",
        boxShadow: "0 1px 6px rgba(0,0,0,.22)", userSelect: "none",
      });
      overlay.append(element);
      rows.push({ ...label, anchor, element });
    }
    viewer.scene.requestRender();
  }

  function paint() {
    if (!enabled || disposed) return;
    const candidates = [];
    for (const row of rows) {
      row.element.style.display = "none";
      const cameraPosition = viewer.camera.positionWC, direction = viewer.camera.directionWC, position = row.anchor.position;
      if (cameraPosition && direction && position) {
        const facing = (position.x - cameraPosition.x) * direction.x +
          (position.y - cameraPosition.y) * direction.y + (position.z - cameraPosition.z) * direction.z;
        if (Number.isFinite(facing) && facing <= 0) continue;
      }
      let point;
      try { point = row.anchor.computeScreenSpacePosition(viewer.scene); } catch { point = null; }
      if (point) candidates.push({ ...row, screenX: point.x, screenY: point.y });
    }
    const visible = thinStreetLabels(candidates, { width: viewer.canvas.clientWidth,
      height: viewer.canvas.clientHeight, limit: viewer.canvas.clientWidth < 640 ? 28 : 56 });
    for (const row of visible) {
      row.element.style.display = "block";
      row.element.style.transform = `translate(${Math.round(row.screenX)}px,${Math.round(row.screenY)}px) translate(-50%,-50%)`;
    }
    publish(visible.length);
  }

  async function refresh() {
    if (disposed || !enabled) return;
    const serial = ++sequence;
    controller?.abort();
    controller = new AbortController();
    loadState = "loading"; loadReason = null; publish();
    try {
      const result = await loader.load(bounds(), { signal: controller.signal });
      if (disposed || !enabled || serial !== sequence) return;
      loadState = result.status; loadReason = result.reason;
      replace(result.labels);
      paint();
    } catch {
      if (disposed || !enabled || serial !== sequence) return;
      clear(); loadState = "unavailable";
      loadReason = "Street names could not load. The photographic map is still available.";
      publish();
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (enabled && !disposed) timer = setTimeout(refresh, 160);
  }
  removers.push(viewer.camera.moveEnd.addEventListener(schedule));
  removers.push(viewer.scene.postRender.addEventListener(paint));
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    removers.push(() => observer.disconnect());
  }
  onStatus({ ...status });
  void refresh();
  return {
    setStreetLabels(value) {
      if (disposed) return;
      enabled = Boolean(value);
      overlay.style.display = enabled ? "block" : "none";
      if (enabled) { viewer.creditDisplay.addStaticCredit(credit); void refresh(); }
      else { viewer.creditDisplay.removeStaticCredit(credit); ++sequence; controller?.abort(); clearTimeout(timer); clear(); publish(); }
      viewer.scene.requestRender();
    },
    getStreetLabelStatus: () => ({ ...status }),
    dispose() {
      if (disposed) return;
      disposed = true; ++sequence; clearTimeout(timer); controller?.abort();
      for (const remove of removers) remove();
      loader.dispose(); overlay.remove(); rows = [];
      if (!viewer.isDestroyed()) { viewer.creditDisplay.removeStaticCredit(credit); viewer.scene.primitives.remove(anchors); }
    },
  };
}
