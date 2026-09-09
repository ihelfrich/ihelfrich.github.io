import { parcelOutlineRings } from "../../lib/city-parcel-overlay.mjs";
import { DEFAULT_TONE, normalizeTone, toneParameters, TONE_GRADE_GLSL } from "../../lib/city-tone.mjs";
import { developmentVolume } from "../../lib/city-development-volume.mjs";
const ORIGIN = [-90.193, 38.628];
const METRES_PER_DEGREE = 111195;
const LONGITUDE_SCALE =
  METRES_PER_DEGREE * Math.cos((ORIGIN[1] * Math.PI) / 180);
const CONNECTION_ERROR =
  "The photographic layer could not connect. Check the Cesium ion token, access to the selected asset, and network availability, then retry.";

// Only fixed stage names and numeric HTTP status cross the provider boundary.
// Never copy response bodies, raw error messages or request URLs into diagnostics.
export function connectionDiagnostic(stage, error) {
  const phase = [
    "module",
    "renderer",
    "authorization",
    "tileset",
    "tiles",
    "surface",
    "render",
  ].includes(stage)
    ? stage
    : "unknown";
  const candidate = error?.statusCode ?? error?.status;
  const status =
    Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
      ? candidate
      : null;
  let message = CONNECTION_ERROR;
  if (phase === "module")
    message =
      "Cesium could not load. Reload this page and retry; a blocked script or interrupted development reload may be responsible.";
  else if (phase === "renderer" || phase === "render")
    message =
      "Cesium could not start or continue its WebGL renderer. Close other 3D tabs, reload, or try another browser.";
  else if (status === 401 || status === 403)
    message =
      phase === "authorization"
        ? `Cesium ion denied authorization (HTTP ${status}). Check that the token is active, has assets:read, includes the selected asset, and allows this page's exact site URL.`
        : `Ion authorized the asset, but the tile service denied access (HTTP ${status}). Check photographic asset access and your provider account settings.`;
  else if (status === 404)
    message =
      "The selected asset was not found for this connection (HTTP 404). Add Google Photorealistic 3D Tiles to your ion assets, or check your custom asset ID.";
  else if (status === 429)
    message =
      "The provider returned a usage or rate limit (HTTP 429). Check your ion account usage before retrying.";
  else if (phase === "authorization")
    message =
      "The browser could not complete the ion authorization request. Check the connection, allowed site URL, and any network or privacy filter.";
  else if (phase === "tileset")
    message =
      "Ion authorized the asset, but its 3D Tiles metadata could not load. Check that the asset is a ready 3D Tiles asset and the tile provider is reachable.";
  else if (phase === "tiles")
    message =
      "The asset opened, but photographic tiles failed to load. Check asset access, account usage, and whether the tile provider is blocked by the browser or network.";
  else if (phase === "surface")
    message =
      "The asset opened, but no visible surface arrived. Check the asset's coverage, processing state and network, then retry.";
  return { phase, status, message };
}

export const REALITY_CAPABILITIES = Object.freeze({
  photographic: true,
  capturedLighting: true,
  visualTone: true,
  parcelVisibility: true,
  developmentVolume: true,
  routes: true,
  listings: true,
  mapSelection: true,
  sourceBuildingSelection: true,
  network: false,
  syntheticTraffic: false,
  separateBuildingLayer: false,
  separateGreenLayer: false,
  lightStudy: false,
  liveWeatherImagery: false,
  meshExport: false,
});

export function createRealityDevelopmentVolume(C, viewer) {
  const entities = new Set();
  let disposed = false;
  function clear() {
    for (const entity of entities) viewer.entities.remove(entity);
    entities.clear();
  }
  return {
    setDevelopmentVolume(value) {
      if (disposed || viewer.isDestroyed()) return { status: "unavailable", reason: "disposed", message: "The map renderer is no longer active." };
      clear();
      const study = developmentVolume(value);
      const result = value => { viewer.scene.requestRender(); return value; };
      if (study.status !== "ready") return result(study);
      let baseHeight, referencePoint;
      // Sample only already-rendered photographic surfaces. Never infer ground
      // elevation, download additional terrain, or sample our overlay entities.
      if (viewer.scene.sampleHeightSupported) {
        const ring = study.polygons[0][0];
        for (let i = 0; i < Math.min(4, ring.length - 1); i++) {
          const point = ring[Math.floor(i * (ring.length - 1) / Math.min(4, ring.length - 1))];
          try {
            const height = viewer.scene.sampleHeight(C.Cartographic.fromDegrees(...point), [...viewer.entities.values]);
            if (Number.isFinite(height)) { baseHeight = height; referencePoint = point; break; }
          } catch { /* A missing loaded surface is an explicit unavailable result. */ }
        }
      }
      if (!Number.isFinite(baseHeight)) return result({ status: "unavailable", reason: "surface-unavailable",
        message: "Zoom in until the parcel's photographic surface has loaded, then show the height study again." });
      try {
        for (const rings of study.polygons) {
          const hierarchies = rings.map(ring => new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(ring.slice(0, -1).flat())));
          hierarchies[0].holes = hierarchies.slice(1);
          const entity = viewer.entities.add({
            name: "Parcel height study — full source boundary",
            polygon: {
              hierarchy: hierarchies[0], height: baseHeight + study.heightMetres, extrudedHeight: baseHeight,
              material: C.Color.fromCssColorString("#f1c576").withAlpha(0.16),
              outline: true, outlineColor: C.Color.fromCssColorString("#7bd8e6").withAlpha(0.8),
              closeTop: true, closeBottom: false,
            },
          });
          entities.add(entity);
        }
      } catch {
        clear();
        return result({ status: "unavailable", reason: "render-geometry", message: "This parcel geometry could not be drawn as a height study." });
      }
      return result({ status: "shown", heightMetres: study.heightMetres, recordKey: study.recordKey,
        baseHeightMetres: baseHeight, referencePoint: [...referencePoint],
        reference: "Captured surface at one parcel boundary point; may be a roof, not surveyed ground. The full parcel is a height-study graphic, not a proposed footprint or entitlement." });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!viewer.isDestroyed()) clear();
      else entities.clear();
    },
  };
}

// A postprocess stage grades scene pixels only. The provider's DOM credits keep
// their original colors. No sun, weather, texture or captured shadow is replaced.
export function createRealityTone(C, scene) {
  let tone = { ...DEFAULT_TONE }, disposed = false;
  const stage = scene.postProcessStages.add(new C.PostProcessStage({
    name: "city-visual-tone",
    uniforms: {
      toneGain: new C.Cartesian3(1, 1, 1),
      toneSaturation: 1,
      toneExposure: 1,
    },
    fragmentShader: `uniform sampler2D colorTexture;
      uniform float toneExposure;
      in vec2 v_textureCoordinates;
      ${TONE_GRADE_GLSL}
      void main() {
        vec4 color = texture(colorTexture, v_textureCoordinates);
        // Cesium custom stages follow its output tone mapper. Decode its gamma
        // before exposure/white balance, then encode for display again.
        vec3 linearColor = pow(max(color.rgb, vec3(0.0)), vec3(czm_gamma));
        linearColor = cityGradeLinear(linearColor) * toneExposure;
        out_FragColor = vec4(pow(max(linearColor, vec3(0.0)), vec3(1.0 / czm_gamma)), color.a);
      }`,
  }));
  stage.enabled = false;
  return {
    setTone(value) {
      if (disposed || stage.isDestroyed()) return { ...tone };
      tone = normalizeTone(value, tone);
      const parameters = toneParameters(tone);
      const [x, y, z] = parameters.gain;
      stage.uniforms.toneGain = new C.Cartesian3(x, y, z);
      stage.uniforms.toneSaturation = parameters.saturation;
      stage.uniforms.toneExposure = parameters.multiplier;
      stage.enabled = tone.preset !== "natural" || tone.exposure !== 0;
      scene.requestRender();
      return { ...tone };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!stage.isDestroyed()) scene.postProcessStages.remove(stage);
    },
  };
}

export function localToGeographic(x, z) {
  return {
    longitude: ORIGIN[0] + x / LONGITUDE_SCALE,
    latitude: ORIGIN[1] - z / METRES_PER_DEGREE,
  };
}

export function geographicToLocal(longitude, latitude) {
  return {
    x: (longitude - ORIGIN[0]) * LONGITUDE_SCALE,
    z: -(latitude - ORIGIN[1]) * METRES_PER_DEGREE,
  };
}

function validLocal(x, z) {
  return Number.isFinite(x) && Number.isFinite(z);
}

function installWidgetStyles() {
  if (document.querySelector("link[data-city-cesium-styles]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/vendor/cesium/Widgets/widgets.css";
  link.dataset.cityCesiumStyles = "true";
  document.head.append(link);
}

/**
 * Real photographic geometry is streamed by the provider. The credential remains
 * inside Cesium's per-connection resource. This adapter never persists, returns,
 * logs or includes it in UI/error/callback payloads. The separate preferences
 * controller may remember it locally only after the user's explicit opt-in.
 */
export async function createRealityScene(
  container,
  data,
  {
    token,
    assetId = 2275207,
    signal,
    onReady = () => {},
    onError = () => {},
    onSelect = () => {},
    onMapSelect = () => {},
    onRegionReady = () => {},
    onRegionStatus = () => {},
  } = {},
) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error(
      "Enter a Cesium ion token to connect the photographic layer.",
    );
  }
  if (!Number.isSafeInteger(Number(assetId)) || Number(assetId) <= 0) {
    throw new Error("Choose a valid Cesium ion asset number.");
  }
  if (signal?.aborted) throw new Error(CONNECTION_ERROR);
  globalThis.CESIUM_BASE_URL = "/vendor/cesium/";
  installWidgetStyles();

  let C;
  let viewer;
  let tone;
  let developmentLayer;
  let tileset;
  let tilesetAttached = false;
  let input;
  let observer;
  let disposed = false;
  let ready = false;
  let firstTileSeen = false;
  let firstTileTimer;
  let paused = false;
  let failedTiles = 0;
  let pendingRequests = 0;
  let processingTiles = 0;
  let statusState = "connecting";
  let phase = "module";
  let listingCallback = () => {};
  let listingSerial = 0;
  let parcelVisible = true;
  const removers = [];
  const abort = new AbortController();
  const controls = { target: { x: 0, z: 0 } };
  const routeEntities = new Set();
  const selectionEntities = new Set();
  const parcelEntities = new Set();
  const listingEntities = new Map();
  const durations = () =>
    paused ||
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 1.2;

  function status(state, extra = {}) {
    if (disposed) return;
    statusState = state;
    onRegionStatus({
      engine: "cesium",
      photographic: true,
      state,
      failed: failedTiles,
      ...extra,
    });
  }

  function requestRender() {
    if (!disposed && viewer && !viewer.isDestroyed())
      viewer.scene.requestRender();
  }

  function removeEntities(collection) {
    if (!viewer || viewer.isDestroyed()) return;
    for (const entity of collection) viewer.entities.remove(entity);
    collection.clear();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    clearTimeout(firstTileTimer);
    observer?.disconnect();
    for (const remove of removers.splice(0)) remove();
    if (input && !input.isDestroyed()) input.destroy();
    routeEntities.clear();
    selectionEntities.clear();
    parcelEntities.clear();
    listingEntities.clear();
    tone?.dispose();
    developmentLayer?.dispose();
    if (
      tileset &&
      !tileset.isDestroyed() &&
      (!tilesetAttached || !viewer || viewer.isDestroyed())
    )
      tileset.destroy();
    if (viewer && !viewer.isDestroyed()) viewer.destroy();
  }

  // No original Error, cause, stack or provider URL crosses this boundary.
  function fail(stage = "render") {
    if (disposed) return;
    const diagnostic = connectionDiagnostic(stage);
    const message = diagnostic.message;
    status("error", { error: message, message });
    dispose();
    onError({ diagnostic });
  }

  // An owning connection may time out while the provider metadata is pending.
  // Release its WebGL context immediately, without waiting for that request.
  signal?.addEventListener("abort", dispose, { once: true });
  removers.push(() => signal?.removeEventListener("abort", dispose));

  try {
    C = await import("cesium");
    if (disposed || signal?.aborted) throw new Error(CONNECTION_ERROR);
    phase = "renderer";
    viewer = new C.Viewer(container, {
      baseLayer: false,
      globe: false,
      geocoder: false,
      animation: false,
      timeline: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: false,
      automaticallyTrackDataSourceClocks: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      showRenderLoopErrors: false,
      scene3DOnly: true,
      shadows: false,
      contextOptions: { webgl: { alpha: false, antialias: true } },
    });
    viewer.resolutionScale = Math.min(globalThis.devicePixelRatio || 1, 1.5);
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 20;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 200000;
    viewer.scene.fog.enabled = false;
    tone = createRealityTone(C, viewer.scene);
    developmentLayer = createRealityDevelopmentVolume(C, viewer);
    viewer.canvas.setAttribute(
      "aria-label",
      "Photographic St. Louis map. Drag to explore, scroll to zoom.",
    );
    viewer.canvas.tabIndex = 0;
    // Prevent the default selection/zoom interaction from competing with the app.
    viewer.screenSpaceEventHandler.removeInputAction(
      C.ScreenSpaceEventType.LEFT_CLICK,
    );
    viewer.screenSpaceEventHandler.removeInputAction(
      C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    removers.push(
      viewer.scene.renderError.addEventListener(() =>
        queueMicrotask(() => fail()),
      ),
    );
    phase = "authorization";
    status("authorizing", {
      message: "Checking this token and asset with Cesium ion…",
    });

    // The Google convenience helper caches a rejected promise by asset ID. A
    // fresh explicit resource here allows an invalid-token → valid-token retry.
    const resource = await C.IonResource.fromAssetId(Number(assetId), {
      accessToken: token.trim(),
    });
    if (disposed) throw new Error(CONNECTION_ERROR);
    phase = "tileset";
    status("authorized", {
      message: "Ion authorized the asset. Loading 3D Tiles metadata…",
    });
    tileset = await C.Cesium3DTileset.fromUrl(resource, {
      showCreditsOnScreen: true,
      cacheBytes: 192 * 1024 * 1024,
      maximumCacheOverflowBytes: 64 * 1024 * 1024,
      maximumScreenSpaceError: 12,
      enableCollision: true,
      skipLevelOfDetail: false,
    });
    if (disposed) {
      if (!tileset.isDestroyed()) tileset.destroy();
      throw new Error(CONNECTION_ERROR);
    }
    // A listener suppresses Cesium's default raw URL/error console logging.
    removers.push(
      tileset.tileFailed.addEventListener(() => {
        failedTiles += 1;
        // A transient failure of one tile must not cancel all remaining tiles.
        // The first-surface deadline still bounds a connection with no usable view.
        status("partial", {
          message: firstTileSeen
            ? "Some photographic tiles could not load. Move the view or reconnect to retry."
            : "An initial tile could not load; waiting for the remaining photographic surfaces…",
        });
      }),
    );
    removers.push(
      tileset.tileVisible.addEventListener(() => {
        firstTileSeen = true;
      }),
    );
    removers.push(
      tileset.loadProgress.addEventListener((pending, processing) => {
        pendingRequests = pending;
        processingTiles = processing;
        status(
          pending || processing ? "streaming" : ready ? "ready" : "loading",
          {
            pending,
            processing,
            message:
              pending || processing
                ? "Loading photographic detail…"
                : "Photographic view connected",
          },
        );
      }),
    );
    removers.push(
      viewer.scene.postRender.addEventListener(() => {
        if (disposed || ready || !firstTileSeen) return;
        ready = true;
        clearTimeout(firstTileTimer);
        updateCenter();
        // Run consumer mutations outside Cesium's frame traversal.
        queueMicrotask(() => {
          if (disposed) return;
          status(pendingRequests || processingTiles ? "streaming" : "ready", {
            pending: pendingRequests,
            processing: processingTiles,
            firstViewReady: true,
            message:
              "First photographic surface rendered; detail loads as you explore",
          });
          onReady();
        });
      }),
    );
    viewer.scene.primitives.add(tileset);
    tilesetAttached = true;
    reset();
    status("loading", { message: "Loading the first photographic view…" });
    firstTileTimer = setTimeout(() => {
      if (!ready) fail(failedTiles ? "tiles" : "surface");
    }, 60000);

    input = new C.ScreenSpaceEventHandler(viewer.canvas);
    input.setInputAction((event) => {
      if (disposed) return;
      const picked = viewer.scene.pick(event.position);
      const listing = picked?.id && listingEntities.get(picked.id);
      if (listing) {
        listingCallback(listing);
        return;
      }
      const point = pickPhotographicPosition(event.position);
      if (!point) return;
      const position = C.Cartographic.fromCartesian(point);
      onMapSelect({
        longitude: C.Math.toDegrees(position.longitude),
        latitude: C.Math.toDegrees(position.latitude),
        height: position.height,
      });
    }, C.ScreenSpaceEventType.LEFT_CLICK);
    removers.push(viewer.camera.moveEnd.addEventListener(updateCenter));
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        if (!disposed) {
          viewer.resize();
          requestRender();
        }
      });
      observer.observe(container);
    }
    // The local manifest supplies place names/anchors, never photographic counts
    // or county coverage claims. No regional OSM geometry tiles are requested.
    fetch("/st-louis/region/manifest.json", { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error("manifest unavailable");
        return response.json();
      })
      .then((manifest) => {
        if (!disposed) onRegionReady(manifest);
      })
      .catch(() => {
        if (!disposed)
          status(statusState, {
            anchorsUnavailable: true,
            message:
              "Photographic view connected; district shortcuts are unavailable.",
          });
      });
  } catch (error) {
    dispose();
    const wrapped = new Error(CONNECTION_ERROR);
    wrapped.diagnostic = connectionDiagnostic(phase, error);
    throw wrapped;
  }

  function color(value, fallback = "#e3bc76") {
    try {
      return (
        C.Color.fromCssColorString(value || fallback) ||
        C.Color.fromCssColorString(fallback)
      );
    } catch {
      return C.Color.fromCssColorString(fallback);
    }
  }

  function cartesian(x, z, height = 0) {
    const position = localToGeographic(x, z);
    return C.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      height,
    );
  }

  function pickPhotographicPosition(screen) {
    if (!viewer.scene.pickPositionSupported) return undefined;
    try {
      const picked = viewer.scene.pick(screen);
      // Entity overlays can have depth too; only report the actual provider mesh.
      if (picked?.primitive !== tileset && picked?.content?.tileset !== tileset)
        return undefined;
      const point = viewer.scene.pickPosition(screen);
      return C.defined(point) ? point : undefined;
    } catch {
      return undefined;
    }
  }

  function updateCenter() {
    if (disposed) return;
    const screen = new C.Cartesian2(
      viewer.canvas.clientWidth / 2,
      viewer.canvas.clientHeight / 2,
    );
    let point = pickPhotographicPosition(screen);
    // A center ray to the ellipsoid is a navigation fallback only. It is never
    // passed to onMapSelect as if it were measured photographic geometry.
    if (!point) point = viewer.camera.pickEllipsoid(screen, C.Ellipsoid.WGS84);
    if (!point) return;
    const position = C.Cartographic.fromCartesian(point);
    Object.assign(
      controls.target,
      geographicToLocal(
        C.Math.toDegrees(position.longitude),
        C.Math.toDegrees(position.latitude),
      ),
    );
  }

  function flyTo(x, z, zoom = 1.8) {
    if (disposed || !validLocal(x, z)) return;
    Object.assign(controls.target, { x, z });
    const scale = Math.max(0.014, Math.min(12, Number(zoom) || 1.8));
    const range = Math.max(160, Math.min(90000, 1800 / scale));
    const location = localToGeographic(x, z);
    let height;
    try {
      if (viewer.scene.sampleHeightSupported)
        height = viewer.scene.sampleHeight(
          C.Cartographic.fromDegrees(location.longitude, location.latitude),
        );
    } catch {
      // Navigation may start before the destination has photographic detail.
    }
    const target = cartesian(x, z, Number.isFinite(height) ? height : 150);
    viewer.camera.flyToBoundingSphere(new C.BoundingSphere(target, 1), {
      duration: durations(),
      offset: new C.HeadingPitchRange(
        viewer.camera.heading,
        C.Math.toRadians(scale < 0.05 ? -72 : -38),
        range,
      ),
      complete: updateCenter,
    });
    requestRender();
  }

  function reset() {
    if (disposed) return;
    if (Number(assetId) !== 2275207 && tileset?.boundingSphere) {
      viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
        duration: 0,
        offset: new C.HeadingPitchRange(
          C.Math.toRadians(318),
          C.Math.toRadians(-38),
          Math.max(100, tileset.boundingSphere.radius * 2.2),
        ),
      });
      updateCenter();
      requestRender();
      return;
    }
    viewer.camera.setView({
      destination: C.Cartesian3.fromDegrees(-90.174, 38.615, 900),
      orientation: {
        heading: C.Math.toRadians(318),
        pitch: C.Math.toRadians(-33),
        roll: 0,
      },
    });
    updateCenter();
    requestRender();
  }

  function clearRoutes() {
    removeEntities(routeEntities);
    requestRender();
  }

  function route(points, cssColor = "#e3bc76", width = 4) {
    if (disposed || !Array.isArray(points)) return;
    const positions = points
      .filter((point) => Array.isArray(point) && validLocal(point[0], point[1]))
      .map(([x, z]) => cartesian(x, z));
    if (positions.length < 2) return;
    const entity = viewer.entities.add({
      polyline: {
        positions,
        width: Math.max(1, Math.min(12, Number(width) || 4)),
        material: color(cssColor),
        clampToGround: true,
        classificationType: C.ClassificationType.CESIUM_3D_TILE,
      },
    });
    routeEntities.add(entity);
    requestRender();
    return entity.id;
  }

  function pin(x, z, cssColor = "#e3bc76") {
    if (disposed || !validLocal(x, z)) return;
    const entity = viewer.entities.add({
      position: cartesian(x, z),
      point: {
        pixelSize: 11,
        color: color(cssColor),
        outlineColor: C.Color.WHITE,
        outlineWidth: 2,
        heightReference: C.HeightReference.CLAMP_TO_3D_TILE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    routeEntities.add(entity);
    requestRender();
    return entity.id;
  }

  function selectBuilding(building) {
    if (disposed) return;
    removeEntities(selectionEntities);
    if (!building?.polygon?.length) return;
    const positions = building.polygon
      .filter((point) => validLocal(point[0], point[1]))
      .map(([x, z]) => cartesian(x, z));
    if (positions.length < 3) return;
    positions.push(positions[0]);
    const entity = viewer.entities.add({
      polyline: {
        positions,
        width: 3,
        material: C.Color.fromCssColorString("#f4cf82"),
        clampToGround: true,
        classificationType: C.ClassificationType.CESIUM_3D_TILE,
      },
    });
    selectionEntities.add(entity);
    requestRender();
    // Selection refers to the supplied OSM record, never a fabricated mesh ID.
  }

  function setParcel(feature) {
    if(disposed)return;
    removeEntities(parcelEntities);
    for(const ring of parcelOutlineRings(feature)) {
      const entity=viewer.entities.add({show:parcelVisible,polyline:{
        positions:C.Cartesian3.fromDegreesArray(ring.flatMap(p=>[p[0],p[1]])),
        width:3,material:C.Color.fromCssColorString("#f4cf82"),clampToGround:true,
        classificationType:C.ClassificationType.CESIUM_3D_TILE,
      }});
      parcelEntities.add(entity);
    }
    requestRender();
  }

  function setListings(listings, select = () => {}) {
    if (disposed) return;
    for (const entity of listingEntities.keys()) viewer.entities.remove(entity);
    listingEntities.clear();
    listingCallback = typeof select === "function" ? select : () => {};
    const seen = new Set();
    for (const listing of Array.isArray(listings) ? listings : []) {
      const stableId = listing?.id;
      const longitudeValue = listing?.longitude ?? listing?.lon ?? listing?.lng;
      const latitudeValue = listing?.latitude ?? listing?.lat;
      if (
        longitudeValue == null ||
        latitudeValue == null ||
        String(longitudeValue).trim() === "" ||
        String(latitudeValue).trim() === ""
      )
        continue;
      const longitude = Number(longitudeValue);
      const latitude = Number(latitudeValue);
      if (
        stableId == null ||
        seen.has(String(stableId)) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        Math.abs(longitude) > 180 ||
        Math.abs(latitude) > 90
      )
        continue;
      seen.add(String(stableId));
      const hasPrice =
        listing.askingPrice != null &&
        String(listing.askingPrice).trim() !== "";
      const price = Number(listing.askingPrice);
      const label =
        hasPrice && Number.isFinite(price) && price >= 0
          ? new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(price)
          : "Listing";
      const entity = viewer.entities.add({
        id: `city-listing-${++listingSerial}-${String(stableId)}`,
        position: C.Cartesian3.fromDegrees(longitude, latitude),
        point: {
          pixelSize: 10,
          color: C.Color.fromCssColorString(({available:"#61d5a5",active:"#e98648",pending:"#eac476",sold:"#91a9ae",withdrawn:"#969693"})[listing.status] || "#e98648"),
          outlineColor: C.Color.WHITE,
          outlineWidth: 2,
          heightReference: C.HeightReference.CLAMP_TO_3D_TILE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          show: hasPrice && Number.isFinite(price) && price > 0,
          text: label,
          font: "600 13px system-ui",
          fillColor: C.Color.WHITE,
          showBackground: true,
          backgroundColor: C.Color.fromCssColorString("#15352ddd"),
          pixelOffset: new C.Cartesian2(0, -20),
          heightReference: C.HeightReference.CLAMP_TO_3D_TILE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, 5000),
        },
      });
      listingEntities.set(entity, listing);
    }
    requestRender();
  }

  function setEnvironment(solar) {
    if (disposed) return;
    const value = solar?.date ?? solar?.timestamp;
    if (value != null) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isFinite(date.getTime()))
        viewer.clock.currentTime = C.JulianDate.fromDate(date);
    }
    // Captured texture illumination is baked. No synthetic sky/lighting change
    // is represented as current photographic weather or a valid shadow study.
    viewer.clock.shouldAnimate = false;
    requestRender();
  }

  return {
    engine: "cesium",
    capabilities: REALITY_CAPABILITIES,
    controls,
    getCenter: () => ({ ...controls.target }),
    flyTo,
    reset,
    clearRoutes,
    route,
    pin,
    selectBuilding,
    setListings,
    setParcel,
    setParcelVisible(value) {
      if (disposed) return;
      parcelVisible = Boolean(value);
      for (const entity of parcelEntities) entity.show = parcelVisible;
      requestRender();
    },
    setTone: tone.setTone,
    setDevelopmentVolume: developmentLayer.setDevelopmentVolume,
    setEnvironment,
    setLight() {},
    setNetwork() {},
    toggle() {},
    setQuality(quality) {
      if (disposed) return;
      tileset.maximumScreenSpaceError =
        quality === "high" ? 8 : quality === "low" ? 16 : 12;
      viewer.resolutionScale =
        quality === "low"
          ? 1
          : Math.min(
              globalThis.devicePixelRatio || 1,
              quality === "high" ? 2 : 1.5,
            );
      requestRender();
    },
    setPaused(value) {
      paused = Boolean(value);
      if (disposed) return;
      viewer.clock.shouldAnimate = false;
      if (paused) viewer.camera.cancelFlight();
      requestRender();
    },
    zoom(factor) {
      if (disposed || !Number.isFinite(Number(factor)) || Number(factor) <= 0)
        return;
      updateCenter();
      const range = Math.max(
        25,
        Math.abs(viewer.camera.positionCartographic.height),
      );
      const amount = range * (1 - 1 / Number(factor));
      if (amount >= 0) viewer.camera.zoomIn(amount);
      else viewer.camera.zoomOut(-amount);
      updateCenter();
      requestRender();
    },
    north() {
      if (disposed) return;
      updateCenter();
      const screen = new C.Cartesian2(
        viewer.canvas.clientWidth / 2,
        viewer.canvas.clientHeight / 2,
      );
      const target =
        pickPhotographicPosition(screen) ||
        viewer.camera.pickEllipsoid(screen, C.Ellipsoid.WGS84);
      if (!target) return;
      const range = C.Cartesian3.distance(viewer.camera.positionWC, target);
      viewer.camera.lookAt(
        target,
        new C.HeadingPitchRange(0, viewer.camera.pitch, range),
      );
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      updateCenter();
      requestRender();
    },
    dispose,
  };
}
