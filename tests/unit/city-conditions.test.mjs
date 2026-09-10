import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseObservation,
  weatherToPresentation,
  solarPosition,
  createConditionsClient,
  CACHE_TTL_MS,
} from "../../src/lib/city-conditions.mjs";
const now = Date.parse("2026-09-08T18:00:00Z");
const q = (value, unitCode) => ({ value, unitCode });
const feature = (extra = {}) => ({
  type: "Feature",
  properties: {
    station: "https://api.weather.gov/stations/KCPS",
    timestamp: "2026-09-08T17:45:00Z",
    temperature: q(0, "wmoUnit:degC"),
    windSpeed: q(36, "wmoUnit:km_h-1"),
    windDirection: q(270, "wmoUnit:degree_(angle)"),
    precipitationLastHour: q(0, "wmoUnit:m"),
    cloudLayers: [],
    textDescription: null,
    ...extra,
  },
});
test("zero values survive while missing and unsupported units remain unknown", () => {
  const o = parseObservation(
    feature({
      windGust: q(null, "wmoUnit:km_h-1"),
      visibility: q(5, "unknown"),
    }),
    { now },
  );
  assert.equal(o.temperatureC, 0);
  assert.equal(o.windSpeedMps, 10);
  assert.equal(o.windGustMps, null);
  assert.equal(o.visibilityMeters, null);
  assert.equal(o.precipitationLastHourMm, 0);
  assert.equal(
    parseObservation(feature({ temperature: q(null, "wmoUnit:degC") }), { now })
      .temperatureC,
    null,
  );
});
test("stale is strictly beyond two hours and future observations are invalid", () => {
  assert.equal(
    parseObservation(feature({ timestamp: "2026-09-08T16:00:00Z" }), { now })
      .status,
    "fresh",
  );
  assert.equal(
    parseObservation(feature({ timestamp: "2026-09-08T15:59:59Z" }), { now })
      .status,
    "stale",
  );
  assert.equal(
    parseObservation(feature({ timestamp: "2026-09-08T18:00:01Z" }), { now })
      .status,
    "invalid",
  );
  assert.equal(
    parseObservation(feature({ timestamp: null }), { now }).status,
    "invalid",
  );
});
test("unknown clouds or precipitation never become clear or dry", () => {
  const p = weatherToPresentation(
    parseObservation(feature({ precipitationLastHour: q(null, "wmoUnit:m") }), {
      now,
    }),
  );
  assert.equal(p.cloudCoverFraction, null);
  assert.equal(p.precipitationLastHourMm, null);
  assert.equal(p.precipitationKind, "unknown");
  assert.equal(p.fogReported, null);
});
test("only an explicit clear report maps to a clear sky and stale weather is not applied", () => {
  const p = weatherToPresentation(
    parseObservation(feature({ textDescription: "Clear" }), { now }),
  );
  assert.equal(p.cloudCoverFraction, 0);
  assert.equal(p.usable, true);
  const stale = weatherToPresentation(
    parseObservation(
      feature({ timestamp: "2026-09-08T12:00:00Z", textDescription: "Clear" }),
      { now },
    ),
  );
  assert.equal(stale.usable, false);
  assert.equal(stale.cloudCoverFraction, null);
  assert.equal(stale.temperatureC, null);
});
test("reported categorical overcast and rain remain distinct from unknown quantities", () => {
  const p = weatherToPresentation(
    parseObservation(
      feature({
        textDescription: "Light Rain",
        presentWeather: [{ weather: "rain", intensity: "light" }],
        cloudLayers: [{ amount: "OVC", base: q(600, "wmoUnit:m") }],
        precipitationLastHour: q(0.002, "wmoUnit:m"),
      }),
      { now },
    ),
  );
  assert.equal(p.cloudCoverFraction, 1);
  assert.equal(p.cloudCoverBasis, "categorical-estimate");
  assert.equal(p.precipitationKind, "rain");
  assert.equal(p.precipitationLastHourMm, 2);
});
test("wind from west blows east; knots convert without creating direction for variable wind", () => {
  const p = weatherToPresentation(parseObservation(feature(), { now }));
  assert.ok(Math.abs(p.windVector.x - 10) < 1e-9);
  assert.ok(Math.abs(p.windVector.z) < 1e-9);
  const variable = parseObservation(
    feature({
      windDirection: q(null, "wmoUnit:degree_(angle)"),
      windSpeed: q(10, "wmoUnit:kn"),
    }),
    { now },
  );
  assert.ok(Math.abs(variable.windSpeedMps - 5.1444444444) < 1e-8);
  assert.equal(weatherToPresentation(variable).windVector, null);
});
test("solar noon near St Louis points south and up; local midnight is below horizon", () => {
  const noon = solarPosition(new Date("2026-03-20T18:08:00Z"));
  assert.ok(noon.altitudeDegrees > 50 && noon.altitudeDegrees < 53);
  assert.ok(Math.abs(noon.direction.x) < 0.04);
  assert.ok(noon.direction.y > 0);
  assert.ok(noon.direction.z > 0);
  const midnight = solarPosition(new Date("2026-03-20T06:08:00Z"));
  assert.ok(midnight.altitudeDegrees < 0);
  assert.ok(midnight.direction.y < 0);
  assert.equal(midnight.aboveHorizon, false);
  assert.ok(Math.abs(Math.hypot(...Object.values(noon.direction)) - 1) < 1e-12);
});
test("summer sun rises east and sets west; invalid dates are rejected", () => {
  assert.ok(solarPosition(new Date("2026-06-21T12:00:00Z")).direction.x > 0);
  assert.ok(solarPosition(new Date("2026-06-22T00:00:00Z")).direction.x < 0);
  assert.throws(() => solarPosition(new Date("invalid")), RangeError);
});
test("ten-minute cache deduplicates concurrent requests and rechecks age without another fetch", async () => {
  let time = now,
    calls = 0;
  const client = createConditionsClient({
    now: () => time,
    fetchImpl: async () => {
      calls++;
      return { ok: true, json: async () => feature() };
    },
  });
  const [a, b] = await Promise.all([
    client.getConditions(),
    client.getConditions(),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.observation.observedAt, b.observation.observedAt);
  time += CACHE_TTL_MS - 1;
  assert.equal((await client.getConditions()).cacheHit, true);
  assert.equal(calls, 1);
  time += 1;
  await client.getConditions();
  assert.equal(calls, 2);
});
test("network failure returns unavailable; cached observations become explicitly stale", async () => {
  let time = now,
    calls = 0;
  const client = createConditionsClient({
    now: () => time,
    fetchImpl: async () => {
      calls++;
      if (calls > 1) throw new Error("offline");
      return { ok: true, json: async () => feature() };
    },
  });
  await client.getConditions();
  time += 3 * 3600000;
  const result = await client.getConditions();
  assert.equal(result.status, "stale");
  assert.equal(result.presentation.usable, false);
  assert.equal(result.fetchError, "network");
  const empty = createConditionsClient({
    now: () => time,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.equal((await empty.getConditions()).status, "unavailable");
});
test("timeout settles even when an injected transport ignores AbortSignal", async () => {
  const client = createConditionsClient({
    now: () => now,
    timeoutMs: 10,
    fetchImpl: () => new Promise(() => {}),
  });
  const result = await client.getConditions();
  assert.equal(result.status, "unavailable");
  assert.equal(result.fetchError, "timeout");
});
test("fair or no-significant-cloud reports do not establish zero cloud cover", () => {
  const fair = weatherToPresentation(
    parseObservation(feature({ textDescription: "Fair" }), { now }),
  );
  const nsc = weatherToPresentation(
    parseObservation(
      feature({ cloudLayers: [{ amount: "NSC", base: q(null, "wmoUnit:m") }] }),
      { now },
    ),
  );
  assert.equal(fair.cloudCoverFraction, null);
  assert.equal(nsc.cloudCoverFraction, null);
});
test("cached data crosses the freshness threshold without refreshing the network", async () => {
  let time = now,
    calls = 0;
  const client = createConditionsClient({
    now: () => time,
    fetchImpl: async () => {
      calls++;
      return {
        ok: true,
        json: async () => feature({ timestamp: "2026-09-08T16:05:00Z" }),
      };
    },
  });
  assert.equal((await client.getConditions()).status, "fresh");
  time += 6 * 60000;
  const result = await client.getConditions();
  assert.equal(calls, 1);
  assert.equal(result.status, "stale");
  assert.equal(result.presentation.usable, false);
});
