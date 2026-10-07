import { createRealityPreferenceStore } from '../../lib/city-reality-preferences.mjs';
import { COAST_PRESETS } from './places.mjs';
export { COAST_PRESETS } from './places.mjs';

// Injected by the deployment environment. Browser asset access is necessarily
// public; the credential is never stored in source control or exported data.
const siteToken = import.meta.env.PUBLIC_CESIUM_ION_TOKEN?.trim();
const COAST_CONNECTION_KEY = 'hidden-rivers-ion-connection-v1';

function coastStore() {
  // Use the site's validated credential format without changing its St Louis
  // asset selection. Only an explicit checkbox writes a coastal connection.
  return createRealityPreferenceStore({ getStorage: () => ({
    getItem: () => globalThis.localStorage.getItem(COAST_CONNECTION_KEY),
    setItem: (_key, value) => globalThis.localStorage.setItem(COAST_CONNECTION_KEY, value),
    removeItem: () => globalThis.localStorage.removeItem(COAST_CONNECTION_KEY),
  }) });
}
function savedConnection() {
  if (siteToken) return {status:'saved', credentials:{token:siteToken}};
  const coast = coastStore().load();
  return coast.status === 'saved' ? coast : createRealityPreferenceStore().load();
}
export function cesiumCoastConnectionStatus() {
  // No credential object leaves this module.
  const result = savedConnection();
  return { available: result.status === 'saved', status: result.status };
}

// Reuse the existing browser/deployment connection without exposing credentials.
export async function connectWaterWorldTerrain(C, viewer, onStatus = () => {}) {
  const saved = savedConnection();
  const credential = saved.status === 'saved' ? saved.credentials.token : siteToken;
  if (!credential) { onStatus('Ellipsoid globe · terrain connection unavailable'); return false; }
  try {
    const resource = await C.IonResource.fromAssetId(1, { accessToken: credential });
    const terrain = await C.CesiumTerrainProvider.fromUrl(resource, { requestVertexNormals: true });
    if (viewer.isDestroyed()) return false;
    viewer.terrainProvider = terrain;
    viewer.scene.requestRender(); onStatus('Cesium World Terrain · 1× vertical scale'); return true;
  } catch { onStatus('Ellipsoid globe · World Terrain unavailable'); return false; }
}
function installStyles() {
  if (document.querySelector('link[data-city-cesium-styles],link[data-coast-cesium-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/vendor/cesium/Widgets/widgets.css';
  link.dataset.coastCesiumStyles = 'true';
  document.head.append(link);
}
function providerDeadline(promise, onLate = () => {}) {
  // A denied or blocked provider must not leave a blank, permanent spinner.
  return new Promise((resolve, reject) => {
    let expired = false;
    const timeout = setTimeout(() => { expired = true; reject(new Error('Provider timeout')); }, 25000);
    promise.then(value => {
      clearTimeout(timeout);
      if (expired) onLate(value); else resolve(value);
    }, error => { clearTimeout(timeout); if (!expired) reject(error); });
  });
}
function safeFailure(layer, error) {
  const code = Number(error?.statusCode ?? error?.status);
  if (code === 401 || code === 403) return `${layer}: this saved token does not authorize the asset or this site URL.`;
  if (code === 429) return `${layer}: the provider has reached a usage limit.`;
  return `${layer}: the provider could not connect. Check access and the network.`;
}

/**
 * Mounted on demand. Use the deployed asset token, falling back to an optional
 * browser connection. Credentials stay out of URLs, logs, and exported data.
 *
 * onLocation receives { longitude, latitude, height, source: 'cesium-terrain' }
 * for a click on the loaded terrain. It does not manufacture ocean observations.
 */
export async function mountCesiumCoast(container, {
  onLocation = () => {}, statusElement, onStatus = () => {},
  initialPreset = 'cape', signal,
} = {}) {
  if (!container) throw new Error('A coastal map container is required.');
  let disposed = false, epoch = 0, viewer, C, tileset, input, observer, frameTimer;
  let stage, form, formMessage, tokenInput, submitButton, remember;
  let pendingTarget = { ...(COAST_PRESETS[initialPreset] || COAST_PRESETS.cape) };
  let state = { state: 'awaiting-connection', terrain: 'unavailable', buildings: 'unavailable', imagery: 'unavailable', buildingTiles: 0 };
  let connected = false, activeToken;
  const removers = [];
  const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const publish = (message, patch = {}) => {
    if (disposed) return;
    state = { ...state, ...patch };
    container.dataset.coastState = state.state;
    container.dataset.coastTerrain = state.terrain;
    container.dataset.coastBuildings = state.buildings;
    if (statusElement) statusElement.textContent = message;
    onStatus({ ...state, message });
  };
  function destroyScene() {
    clearTimeout(frameTimer);
    observer?.disconnect(); observer = null;
    for (const remove of removers.splice(0)) remove();
    if (input && !input.isDestroyed()) input.destroy();
    input = null;
    if (viewer && !viewer.isDestroyed()) viewer.destroy();
    viewer = null; tileset = null; connected = false;
    stage?.remove(); stage = null;
  }
  function describe() {
    const terrain = state.terrain === 'ready' ? 'World Terrain connected' : 'World Terrain unavailable';
    const buildings = state.buildings === 'ready'
      ? `${state.buildingTiles} building tile${state.buildingTiles === 1 ? '' : 's'} received`
      : state.buildings === 'connected' ? 'OSM buildings connected; zoom toward a settlement for geometry' : 'OSM buildings unavailable';
    const imagery = state.imagery === 'ready' ? 'aerial imagery connected' : 'coarse Natural Earth imagery';
    return `${terrain} · ${buildings} · ${imagery}.`;
  }
  function flyTo(longitude, latitude, options = {}) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return false;
    pendingTarget = { longitude, latitude, range: 15000, heading: 335, ...options };
    container.dataset.longitude = String(longitude);
    container.dataset.latitude = String(latitude);
    if (!viewer || !C || disposed) return true;
    const centre = C.Cartesian3.fromDegrees(longitude, latitude, Number.isFinite(options.height) ? options.height : 0);
    const range = Math.max(700, Math.min(1500000, Number(pendingTarget.range) || 15000));
    viewer.camera.flyToBoundingSphere(new C.BoundingSphere(centre, 100), {
      duration: reduced() || options.immediate ? 0 : 2.6,
      offset: new C.HeadingPitchRange(C.Math.toRadians(Number(pendingTarget.heading) || 0), C.Math.toRadians(-42), range),
    });
    viewer.scene.requestRender();
    return true;
  }
  function showForm(message) {
    if (!form) {
      form = document.createElement('form'); form.className = 'coast-connect-form';
      const label = document.createElement('label'); label.className = 'coast-connect-label';
      label.textContent = 'Cesium ion connection';
      const row = document.createElement('div'); row.className = 'coast-connect-row';
      tokenInput = document.createElement('input'); tokenInput.type = 'password'; tokenInput.autocomplete = 'off';
      tokenInput.spellcheck = false; tokenInput.required = true; tokenInput.maxLength = 8192;
      tokenInput.placeholder = 'ion access token'; tokenInput.setAttribute('aria-label', 'Cesium ion access token');
      submitButton = document.createElement('button'); submitButton.type = 'submit'; submitButton.textContent = 'Connect';
      row.append(tokenInput, submitButton); label.append(row);
      const rememberLabel = document.createElement('label'); rememberLabel.className = 'coast-connect-remember';
      remember = document.createElement('input'); remember.type = 'checkbox';
      rememberLabel.append(remember, document.createTextNode(' Remember in this browser'));
      formMessage = document.createElement('p'); formMessage.className = 'coast-connect-message'; formMessage.setAttribute('role', 'status');
      form.append(label, rememberLabel, formMessage);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const token = tokenInput.value.trim();
        if (!token || disposed) return;
        const shouldRemember = remember.checked;
        tokenInput.value = ''; submitButton.disabled = true;
        await connect(token, shouldRemember);
        if (!disposed && submitButton) submitButton.disabled = false;
      });
      container.append(form);
    }
    form.hidden = false; formMessage.textContent = message;
  }
  function removeForm() { if (form) form.hidden = true; }

  async function connect(token, shouldRemember = false) {
    activeToken = token;
    const attempt = ++epoch;
    destroyScene();
    publish('Connecting World Terrain, aerial imagery, and OSM buildings through Cesium ion…', {
      state: 'connecting', terrain: 'loading', buildings: 'loading', imagery: 'loading', buildingTiles: 0,
    });
    try {
      globalThis.CESIUM_BASE_URL = '/vendor/cesium/'; installStyles();
      C = await import('cesium');
      if (disposed || attempt !== epoch) return;
      stage = document.createElement('div'); stage.className = 'coast-stage';
      stage.style.width = '100%'; stage.style.height = '100%';
      stage.setAttribute('aria-label', 'Rotatable 3D coastal terrain and buildings');
      container.prepend(stage);
      viewer = new C.Viewer(stage, {
        baseLayer: false, terrainProvider: new C.EllipsoidTerrainProvider(),
        animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
        homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        fullscreenButton: false, infoBox: false, selectionIndicator: false,
        requestRenderMode: true, maximumRenderTimeChange: Infinity, shouldAnimate: false,
        scene3DOnly: true, shadows: false,
      });
      viewer.resolutionScale = Math.min(1.4, globalThis.devicePixelRatio || 1);
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100;
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 6000000;
      viewer.scene.postProcessStages.fxaa.enabled = true;
      flyTo(pendingTarget.longitude, pendingTarget.latitude, { ...pendingTarget, immediate: true });
      removeForm();
      removers.push(viewer.scene.renderError.addEventListener(() => {
        publish('The coastal 3D renderer stopped. Reload this map or try another WebGL-capable browser.', { state: 'error' });
        showForm('The connection is saved only in this browser. Reconnect to restart the coastal map.');
      }));
      input = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
      input.setInputAction(event => {
        const ray = viewer.camera.getPickRay(event.position);
        const point = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (!point) return;
        const location = C.Cartographic.fromCartesian(point);
        onLocation({ longitude: C.Math.toDegrees(location.longitude), latitude: C.Math.toDegrees(location.latitude), height: location.height, source: state.terrain === 'ready' ? 'cesium-terrain' : 'cesium-ellipsoid' });
      }, C.ScreenSpaceEventType.LEFT_CLICK);
      const activeViewer = viewer;
      observer = new ResizeObserver(() => { if (!disposed && !activeViewer.isDestroyed()) activeViewer.resize(); });
      observer.observe(container);
      const visibility = () => { if (!activeViewer.isDestroyed()) { activeViewer.useDefaultRenderLoop = !document.hidden; if (!document.hidden) activeViewer.scene.requestRender(); } };
      document.addEventListener('visibilitychange', visibility);
      removers.push(() => document.removeEventListener('visibilitychange', visibility));

      // Credential is scoped to each connection, never assigned to Ion defaults.
      const terrainTask = C.IonResource.fromAssetId(1, { accessToken: token })
        .then(resource => C.CesiumTerrainProvider.fromUrl(resource, { requestVertexNormals: true, requestWaterMask: true }));
      const buildingTask = C.IonResource.fromAssetId(96188, { accessToken: token })
        .then(resource => C.Cesium3DTileset.fromUrl(resource, { maximumScreenSpaceError: 4, showCreditsOnScreen: true }));
      const imageryTask = C.IonImageryProvider.fromAssetId(2, { accessToken: token });
      const tasks = [providerDeadline(terrainTask), providerDeadline(buildingTask, late => { if (!late.isDestroyed()) late.destroy(); }), providerDeadline(imageryTask)];
      // Dispose late tilesets if a user changes connection during metadata load.
      buildingTask.then(result => { if ((disposed || attempt !== epoch) && !result.isDestroyed()) result.destroy(); }, () => {});
      const results = await Promise.allSettled(tasks);
      if (disposed || attempt !== epoch || activeViewer.isDestroyed()) return;
      const errors = [];
      if (results[0].status === 'fulfilled') {
        activeViewer.terrainProvider = results[0].value;
        state.terrain = 'ready';
        removers.push(results[0].value.errorEvent.addEventListener(() => {
          publish('Some World Terrain tiles could not load. The displayed terrain may be incomplete.', { state: 'partial', terrain: 'partial' });
        }));
      } else { state.terrain = 'unavailable'; errors.push(safeFailure('World Terrain', results[0].reason)); }
      if (results[1].status === 'fulfilled') {
        tileset = results[1].value; activeViewer.scene.primitives.add(tileset);
        state.buildings = 'connected';
        // Preserve source colors where provided. OSM shapes and heights carry
        // their original uncertainty; no procedural buildings are invented.
        tileset.style = new C.Cesium3DTileStyle({ color: "Boolean(${feature['cesium#color']}) ? color(${feature['cesium#color']}) : color('white')" });
        const received = new WeakSet();
        removers.push(tileset.tileLoad.addEventListener(tile => {
          if (!received.has(tile)) { received.add(tile); state.buildingTiles++; }
          state.buildings = 'ready'; clearTimeout(frameTimer);
          frameTimer = setTimeout(() => publish(describe()), 180);
        }));
        removers.push(tileset.tileFailed.addEventListener(() => {
          publish('Some OSM building tiles could not load. Coverage and source height detail vary by location.', { state: 'partial', buildings: 'partial' });
        }));
      } else { state.buildings = 'unavailable'; errors.push(safeFailure('OSM buildings', results[1].reason)); }
      if (results[2].status === 'fulfilled') {
        activeViewer.imageryLayers.addImageryProvider(results[2].value); state.imagery = 'ready';
        removers.push(results[2].value.errorEvent.addEventListener(() => {
          publish('Some aerial imagery tiles could not load.', { state: 'partial', imagery: 'partial' });
        }));
      } else {
        state.imagery = 'fallback'; errors.push(safeFailure('Aerial imagery', results[2].reason));
        try {
          const natural = await C.TileMapServiceImageryProvider.fromUrl('/vendor/cesium/Assets/Textures/NaturalEarthII', { credit: 'Natural Earth' });
          if (!disposed && attempt === epoch && !activeViewer.isDestroyed()) activeViewer.imageryLayers.addImageryProvider(natural);
        } catch { state.imagery = 'unavailable'; }
      }
      if (disposed || attempt !== epoch || activeViewer.isDestroyed()) return;
      connected = state.terrain === 'ready' || state.buildings === 'connected' || state.buildings === 'ready';
      if (connected && shouldRemember) {
        const saved = coastStore().save({ token, assetId: 1, autoConnect: true });
        if (saved.status !== 'saved') errors.push('Connected, but this browser could not remember the connection.');
      }
      const complete = state.terrain === 'ready' && state.buildings !== 'unavailable' && state.imagery === 'ready';
      publish(`${describe()}${errors.length ? ` ${errors.join(' ')}` : ''}`, { state: complete ? 'ready' : connected ? 'partial' : 'unavailable' });
      if (!connected) showForm('This token could not load World Terrain or OSM buildings. The token needs assets:read and access to assets 1 and 96188. Aerial imagery uses asset 2. Tokens saved on another device are not available in this browser.');
      activeViewer.scene.requestRender();
    } catch {
      if (disposed || attempt !== epoch) return;
      destroyScene();
      publish('The coastal 3D view could not start. Check the connection and WebGL availability.', { state: 'error', terrain: 'unavailable', buildings: 'unavailable' });
      showForm('Your token stays in this browser. Reconnect to try again.');
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; ++epoch;
    destroyScene(); form?.remove(); form = null;
    signal?.removeEventListener('abort', dispose);
  }
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) dispose();
  else {
    const saved = savedConnection();
    if (saved.status === 'saved') await connect(saved.credentials.token);
    else {
      const message = 'No Cesium ion connection is saved in this browser. A connection saved on your St Louis page is reused automatically on the same device and browser.';
      publish(message);
      showForm(message);
    }
  }
  return {
    flyTo,
    flyToPreset(name) { const preset = COAST_PRESETS[name]; return preset ? flyTo(preset.longitude, preset.latitude, preset) : false; },
    resize() { if (viewer && !viewer.isDestroyed()) viewer.resize(); },
    getStatus() { return { ...state }; },
    reconnect() { return activeToken ? connect(activeToken) : Promise.resolve(); },
    dispose,
  };
}
