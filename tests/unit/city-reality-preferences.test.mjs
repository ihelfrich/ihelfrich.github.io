import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createRealityPreferenceStore, REALITY_PREFERENCES_KEY } from "../../src/lib/city-reality-preferences.mjs";
import { createRealityPreferences } from "../../src/scripts/city/city-reality-preferences.mjs";

const credentials = { token: "synthetic-saved-token", assetId: 12345, autoConnect: true };
function memoryStorage() {
  const values = new Map();
  return {
    values, writes: 0, removals: 0,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { this.writes++; values.set(key, value); },
    removeItem(key) { this.removals++; values.delete(key); },
  };
}
function storeFor(storage) {
  return createRealityPreferenceStore({ getStorage: () => storage });
}
function setup(t, initial = null) {
  const window = new Window(), document = window.document, storage = memoryStorage();
  const store = storeFor(storage), connections = [];
  if (initial) store.save(initial);
  document.body.innerHTML = `<input id="ion-token" type="password"><input id="ion-remember" type="checkbox"><input id="ion-auto-connect" type="checkbox" checked><p id="ion-save-status" role="status"></p><button id="ion-reconnect-saved" hidden>Reconnect</button><button id="ion-forget-saved" hidden>Forget saved connection</button><select id="ion-source"><option value="2275207">Photographic</option><option value="custom">Custom</option></select><label id="custom-asset-label" hidden><input id="ion-asset"></label>`;
  const ui = createRealityPreferences(document, { store, onReconnect: (value) => connections.push(value) });
  t.after(() => { ui.dispose(); window.happyDOM.abort(); });
  const $ = (id) => document.getElementById(id);
  const change = (id, checked) => { $(id).checked = checked; $(id).dispatchEvent(new window.Event("change")); };
  return { window, document, storage, store, ui, $, change, connections };
}

test("storage writes only the versioned credential configuration, trims token, and returns a fresh safe payload", () => {
  const storage = memoryStorage(), store = storeFor(storage);
  assert.equal(store.save({ ...credentials, token: ` ${credentials.token} `, other: "discard" }).status, "saved");
  assert.deepEqual(JSON.parse(storage.getItem(REALITY_PREFERENCES_KEY)), { version: 1, ...credentials });
  const loaded = store.load();
  assert.equal(loaded.status, "saved");
  assert.deepEqual(loaded.credentials, credentials);
  loaded.credentials.token = "changed";
  assert.equal(store.load().credentials.token, credentials.token);
  assert.equal(store.forget().status, "forgotten");
  assert.equal(store.load().status, "empty");
});

test("storage rejects malformed, oversized, wrong-version, and extra-field records without exposing their payload", () => {
  const storage = memoryStorage(), store = storeFor(storage);
  for (const raw of ["{", "x".repeat(10001), "null", "[]", JSON.stringify({ version: 2, ...credentials }), JSON.stringify({ version: 1, ...credentials, extra: "synthetic-sensitive" })]) {
    storage.values.set(REALITY_PREFERENCES_KEY, raw);
    assert.deepEqual(store.load(), { status: "invalid" });
  }
});

test("invalid input cannot be saved, including unsafe assets, missing booleans, and oversized encoding", () => {
  const storage = memoryStorage(), store = storeFor(storage);
  for (const value of [null, {}, { ...credentials, token: "  " }, { ...credentials, token: "x".repeat(8193) }, { ...credentials, token: "a\n".repeat(4000) }, { ...credentials, assetId: 0 }, { ...credentials, assetId: 1.5 }, { ...credentials, assetId: Number.MAX_SAFE_INTEGER + 1 }, { ...credentials, assetId: "12345" }, { ...credentials, autoConnect: "true" }]) {
    assert.deepEqual(store.save(value), { status: "invalid" });
  }
  assert.equal(storage.writes, 0);
});

test("unavailable access, privacy failures, and quota errors return safe statuses", () => {
  const inaccessible = createRealityPreferenceStore({ getStorage() { throw new Error("synthetic-private-detail"); } });
  for (const store of [inaccessible, storeFor(undefined), storeFor({ getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } })]) {
    assert.deepEqual(store.load(), { status: "unavailable" });
    assert.deepEqual(store.save(credentials), { status: "unavailable" });
    assert.deepEqual(store.forget(), { status: "unavailable" });
  }
});

test("Remember is initially opt-in and no connection is written before a successful commit", (t) => {
  const h = setup(t);
  assert.equal(h.$("ion-remember").checked, false);
  assert.equal(h.ui.prepareAttempt(credentials)().status, "skipped");
  assert.equal(h.storage.writes, 0);
  h.change("ion-remember", true);
  const commit = h.ui.prepareAttempt(credentials);
  assert.equal(h.storage.writes, 0);
  assert.equal(commit().status, "saved");
  assert.equal(commit().status, "skipped");
  assert.equal(h.storage.writes, 1);
});

test("a successful commit preserves the actual request and does not read later token or asset inputs", (t) => {
  const h = setup(t);
  h.change("ion-remember", true);
  const request = { ...credentials }, commit = h.ui.prepareAttempt(request);
  request.token = "changed-request";
  h.$("ion-token").value = "different-form-token";
  h.$("ion-asset").value = "999";
  commit();
  assert.deepEqual(h.store.load().credentials, credentials);
});

test("saved assets and checkboxes hydrate without placing a token into DOM or status", (t) => {
  const h = setup(t, credentials);
  assert.equal(h.$("ion-token").value, "");
  assert.equal(h.$("ion-source").value, "custom");
  assert.equal(h.$("ion-asset").value, "12345");
  assert.equal(h.$("custom-asset-label").hidden, false);
  assert.equal(h.$("ion-asset").required, true);
  assert.equal(h.$("ion-remember").checked, true);
  assert.equal(h.$("ion-auto-connect").checked, true);
  assert.equal(h.document.body.outerHTML.includes(credentials.token), false);
  assert.match(h.$("ion-save-status").textContent, /12345/);
});

test("default photographic asset keeps custom fields hidden", (t) => {
  const h = setup(t, { ...credentials, assetId: 2275207 });
  assert.equal(h.$("ion-source").value, "2275207");
  assert.equal(h.$("custom-asset-label").hidden, true);
  assert.equal(h.$("ion-asset").required, false);
});

test("automatic restoration is consumed before use and runs at most once", (t) => {
  const h = setup(t, credentials);
  assert.deepEqual(h.ui.takeRestore(), credentials);
  assert.equal(h.ui.takeRestore(), null);
  assert.deepEqual(h.ui.reconnect(), credentials);
});

test("disabled automatic connection and explicit consumption suppress restoration", (t) => {
  const h = setup(t, { ...credentials, autoConnect: false });
  assert.equal(h.ui.takeRestore(), null);
  h.change("ion-auto-connect", true);
  assert.equal(h.ui.takeRestore(), null);
  assert.equal(h.store.load().credentials.autoConnect, true);
  const manual = setup(t, credentials);
  manual.ui.consumeRestore();
  assert.equal(manual.ui.takeRestore(), null);
});

test("Forget during a pending remembered attempt prevents late persistence", (t) => {
  const h = setup(t, credentials), commit = h.ui.prepareAttempt({ ...credentials, token: "synthetic-replacement" });
  h.$("ion-forget-saved").click();
  assert.equal(commit().status, "skipped");
  assert.equal(h.store.load().status, "empty");
  assert.equal(h.$("ion-remember").checked, false);
  assert.equal(h.ui.takeRestore(), null);
  assert.equal(h.ui.reconnect(), null);
  assert.equal(h.$("ion-forget-saved").hidden, true);
});

test("unchecking Remember clears storage and toggling it back cannot authorize an older attempt", (t) => {
  const h = setup(t, credentials), commit = h.ui.prepareAttempt(credentials);
  h.change("ion-remember", false);
  h.change("ion-remember", true);
  assert.equal(commit().status, "skipped");
  assert.equal(h.store.load().status, "empty");
});

test("automatic-reconnect preference edits invalidate pending commits and only update already saved credentials", (t) => {
  const h = setup(t, credentials), commit = h.ui.prepareAttempt({ ...credentials, token: "synthetic-new" });
  h.change("ion-auto-connect", false);
  assert.equal(commit().status, "skipped");
  assert.deepEqual(h.store.load().credentials, { ...credentials, autoConnect: false });
  const unsaved = setup(t);
  unsaved.change("ion-auto-connect", false);
  assert.equal(unsaved.storage.writes, 0);
});

test("failed saving does not throw and does not claim persistence", (t) => {
  const h = setup(t);
  h.change("ion-remember", true);
  h.storage.setItem = () => { throw new Error("synthetic-detail"); };
  assert.equal(h.ui.prepareAttempt(credentials)().status, "unavailable");
  assert.match(h.$("ion-save-status").textContent, /could not save/i);
  assert.equal(h.$("ion-save-status").textContent.includes(credentials.token), false);
  assert.equal(h.ui.reconnect(), null);
});

test("failed forgetting reports that the saved connection remains and suppresses restoration", (t) => {
  const h = setup(t, credentials), commit = h.ui.prepareAttempt(credentials);
  h.storage.removeItem = () => { throw new Error("synthetic-detail"); };
  h.$("ion-forget-saved").click();
  assert.match(h.$("ion-save-status").textContent, /could not remove/i);
  assert.equal(h.store.load().status, "saved");
  assert.equal(h.$("ion-forget-saved").hidden, false);
  assert.equal(h.ui.takeRestore(), null);
  assert.equal(commit().status, "skipped");
});

test("failed preference update preserves both the stored setting and its checkbox", (t) => {
  const h = setup(t, credentials);
  h.storage.setItem = () => { throw new Error("synthetic-detail"); };
  h.change("ion-auto-connect", false);
  assert.equal(h.store.load().credentials.autoConnect, true);
  assert.equal(h.$("ion-auto-connect").checked, true);
  assert.match(h.$("ion-save-status").textContent, /could not update/i);
});

test("failed replacement saving preserves the previously working saved connection", (t) => {
  const h = setup(t, credentials);
  h.storage.setItem = () => { throw new Error("synthetic-detail"); };
  const commit = h.ui.prepareAttempt({ token: "synthetic-replacement", assetId: 67890 });
  assert.equal(commit().status, "unavailable");
  assert.deepEqual(h.ui.reconnect(), credentials);
  assert.match(h.$("ion-save-status").textContent, /previous saved connection remains/i);
});

test("corrupt or inaccessible storage does not prevent controller startup or fill a password", (t) => {
  const h = setup(t);
  h.ui.dispose();
  h.storage.values.set(REALITY_PREFERENCES_KEY, "{synthetic-bad-record");
  const corrupt = createRealityPreferences(h.document, { store: h.store });
  assert.equal(corrupt.takeRestore(), null);
  assert.equal(h.$("ion-forget-saved").hidden, false);
  assert.match(h.$("ion-save-status").textContent, /could not be read/i);
  h.$("ion-forget-saved").click();
  assert.equal(h.store.load().status, "empty");
  corrupt.dispose();
  const unavailable = createRealityPreferences(h.document, { store: { load() { throw new Error(); } } });
  assert.equal(unavailable.takeRestore(), null);
  assert.equal(h.$("ion-remember").checked, false);
  assert.equal(h.$("ion-token").value, "");
  assert.match(h.$("ion-save-status").textContent, /storage is unavailable/i);
  unavailable.dispose();
});

test("explicit reconnect passes only stored credentials and consumes auto-restore", (t) => {
  const h = setup(t, credentials);
  h.$("ion-token").value = "unverified-form-token";
  h.$("ion-reconnect-saved").click();
  assert.deepEqual(h.connections, [credentials]);
  assert.equal(h.ui.takeRestore(), null);
  assert.equal(h.$("ion-token").value, "unverified-form-token");
});

test("disposal removes listeners and prevents pending commits and reconnects", (t) => {
  const h = setup(t, credentials), commit = h.ui.prepareAttempt(credentials), writes = h.storage.writes;
  h.ui.dispose();
  h.$("ion-reconnect-saved").click();
  h.$("ion-forget-saved").click();
  assert.equal(commit().status, "skipped");
  assert.equal(h.storage.writes, writes);
  assert.equal(h.storage.removals, 0);
  assert.equal(h.ui.takeRestore(), null);
  assert.equal(h.ui.reconnect(), null);
  assert.deepEqual(h.connections, []);
});
