import { createRealityPreferenceStore, normalizeRealityCredentials } from "../../lib/city-reality-preferences.mjs";

export function createRealityPreferences(doc, { store = createRealityPreferenceStore(), onReconnect = () => {} } = {}) {
  const $ = (id) => doc.getElementById(id);
  const remember = $("ion-remember"), automatic = $("ion-auto-connect"), status = $("ion-save-status");
  const reconnectButton = $("ion-reconnect-saved"), forgetButton = $("ion-forget-saved");
  let saved = null, hasRecord = false, revision = 0, restoreConsumed = false, disposed = false;
  const listeners = [];
  const callStore = (method, ...args) => {
    try { return store[method](...args); } catch { return { status: "unavailable" }; }
  };
  const buttons = () => {
    automatic.disabled = !remember.checked;
    reconnectButton.hidden = !saved;
    forgetButton.hidden = !hasRecord;
  };
  const describeSaved = () => {
    status.textContent = `Saved in this browser for asset ${saved.assetId}. Automatic reconnect is ${saved.autoConnect ? "on" : "off"}. Your map data stays in Cesium ion.`;
  };
  const on = (element, type, handler) => {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  };
  const forget = () => {
    ++revision;
    restoreConsumed = true;
    remember.checked = false;
    const result = callStore("forget");
    if (result.status === "forgotten") {
      saved = null;
      hasRecord = false;
      status.textContent = "Saved connection removed from this browser. An active map can stay connected until you leave it.";
    } else {
      status.textContent = "This browser could not remove the saved connection. Use your browser’s site-data controls to clear it. Automatic reconnect is stopped for this page.";
    }
    buttons();
    return result;
  };

  // Programmatic hydration exposes asset metadata only; the password input is
  // deliberately never read or populated by this controller.
  remember.checked = false;
  automatic.checked = true;
  const initial = callStore("load");
  if (initial.status === "saved") {
    saved = normalizeRealityCredentials(initial.credentials);
    hasRecord = true;
  } else hasRecord = initial.status === "invalid";
  if (saved) {
    remember.checked = true;
    automatic.checked = saved.autoConnect;
    const custom = saved.assetId !== 2275207;
    $("ion-source").value = custom ? "custom" : "2275207";
    $("ion-asset").value = custom ? String(saved.assetId) : "";
    $("ion-asset").required = custom;
    $("custom-asset-label").hidden = !custom;
    describeSaved();
  } else {
    status.textContent = initial.status === "unavailable"
      ? "Browser storage is unavailable. You can connect without saving."
      : hasRecord
        ? "The saved connection could not be read. Connect again to replace it, or forget the saved connection."
        : "Optional: save this connection in this browser. Your map data stays in Cesium ion.";
  }
  buttons();

  const reconnect = () => {
    restoreConsumed = true;
    return !disposed && saved ? { ...saved } : null;
  };
  on(reconnectButton, "click", () => {
    const credentials = reconnect();
    if (credentials) onReconnect(credentials);
  });
  on(forgetButton, "click", forget);
  on(remember, "change", () => {
    ++revision;
    if (!remember.checked) forget();
    else {status.textContent = "The connection will be saved in this browser after it connects successfully.";buttons();}
  });
  on(automatic, "change", () => {
    ++revision;
    if (!saved || !remember.checked) return;
    const next = { ...saved, autoConnect: automatic.checked }, result = callStore("save", next);
    if (result.status === "saved") {
      saved = next;
      describeSaved();
    } else {
      automatic.checked = saved.autoConnect;
      status.textContent = "This browser could not update the saved preference. The previous automatic-reconnect setting remains in use.";
    }
  });

  return {
    prepareAttempt({ token, assetId }) {
      const attemptRevision = revision, optedIn = remember.checked;
      const credentials = normalizeRealityCredentials({ token, assetId, autoConnect: automatic.checked });
      let committed = false;
      return () => {
        if (committed) return { status: "skipped" };
        committed = true;
        if (disposed || !optedIn || !remember.checked || attemptRevision !== revision) return { status: "skipped" };
        const result = credentials ? callStore("save", credentials) : { status: "invalid" };
        if (result.status === "saved") {
          saved = { ...credentials };
          hasRecord = true;
          describeSaved();
        } else {
          status.textContent = saved
            ? "Connected, but this browser could not save the new connection. The previous saved connection remains available."
            : "Connected, but this browser could not save the connection. It will need to be entered again.";
        }
        buttons();
        return result;
      };
    },
    takeRestore() {
      if (disposed || restoreConsumed) return null;
      restoreConsumed = true;
      return saved?.autoConnect ? { ...saved } : null;
    },
    reconnect,
    consumeRestore() { restoreConsumed = true; },
    dispose() {
      disposed = true;
      restoreConsumed = true;
      ++revision;
      for (const remove of listeners) remove();
      saved = null;
    },
  };
}
