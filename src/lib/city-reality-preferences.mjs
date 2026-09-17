export const REALITY_PREFERENCES_KEY = "stl-reality-connection-v1";
const VERSION = 1;
const MAX_TOKEN_LENGTH = 8192;
const MAX_RECORD_LENGTH = 10000;

// Credentials stay inside this store and the renderer connection. Callers must
// never include the returned payload in UI messages, URLs, or scenario exports.
export function normalizeRealityCredentials(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.token !== "string" || value.token.length > MAX_TOKEN_LENGTH) return null;
  const token = value.token.trim();
  if (!token || !Number.isSafeInteger(value.assetId) || value.assetId <= 0 || typeof value.autoConnect !== "boolean") return null;
  return { token, assetId: value.assetId, autoConnect: value.autoConnect };
}

export function createRealityPreferenceStore({ getStorage = () => globalThis.localStorage } = {}) {
  return {
    load() {
      try {
        const raw = getStorage().getItem(REALITY_PREFERENCES_KEY);
        if (raw === null) return { status: "empty" };
        if (typeof raw !== "string" || raw.length > MAX_RECORD_LENGTH) return { status: "invalid" };
        let record;
        try { record = JSON.parse(raw); } catch { return { status: "invalid" }; }
        const credentials = normalizeRealityCredentials(record);
        if (!credentials || record.version !== VERSION || Object.keys(record).length !== 4 || !Object.keys(record).every((key) => ["version", "token", "assetId", "autoConnect"].includes(key))) return { status: "invalid" };
        return { status: "saved", credentials };
      } catch {
        return { status: "unavailable" };
      }
    },
    save(value) {
      try {
        const credentials = normalizeRealityCredentials(value);
        if (!credentials) return { status: "invalid" };
        const encoded = JSON.stringify({ version: VERSION, ...credentials });
        if (encoded.length > MAX_RECORD_LENGTH) return { status: "invalid" };
        getStorage().setItem(REALITY_PREFERENCES_KEY, encoded);
        return { status: "saved" };
      } catch {
        return { status: "unavailable" };
      }
    },
    forget() {
      try {
        getStorage().removeItem(REALITY_PREFERENCES_KEY);
        return { status: "forgotten" };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}
