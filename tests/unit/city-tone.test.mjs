import test from "node:test";
import assert from "node:assert/strict";
import { Cartesian3, PostProcessStage } from "cesium";
import { DEFAULT_TONE, normalizeTone, toneParameters, TONE_PRESETS } from "../../src/lib/city-tone.mjs";
import { createSceneTone } from "../../src/scripts/city/city-scene.mjs";
import { createRealityTone } from "../../src/scripts/city/city-reality.mjs";

test("tone changes preserve partial state, bound exposure and reject nonnumeric controls", () => {
  const input = Object.freeze({ preset: "warm", exposure: 0.5 });
  assert.deepEqual(normalizeTone({ exposure: -5 }, input), { preset: "warm", exposure: -1 });
  assert.deepEqual(normalizeTone({ preset: "mono", exposure: 5 }, input), { preset: "mono", exposure: 1 });
  for (const exposure of [NaN, Infinity, -Infinity, null, "0.4", {}, undefined]) {
    assert.deepEqual(normalizeTone({ preset: "constructor", exposure }, input), input);
  }
  assert.deepEqual(normalizeTone(null, null), DEFAULT_TONE);
  assert.deepEqual(normalizeTone(DEFAULT_TONE, input), DEFAULT_TONE);
  assert.deepEqual(input, { preset: "warm", exposure: 0.5 });
});

test("one exposure stop doubles linear output and reset is neutral for every preset", () => {
  for (const preset of Object.keys(TONE_PRESETS)) {
    const low = toneParameters({ preset, exposure: -1 });
    const mid = toneParameters({ preset, exposure: 0 });
    const high = toneParameters({ preset, exposure: 1 });
    assert.equal(mid.multiplier / low.multiplier, 2);
    assert.equal(high.multiplier / mid.multiplier, 2);
    assert.ok(mid.gain.every(value => value > 0 && Number.isFinite(value)));
  }
  assert.equal(toneParameters({ preset: "mono" }).saturation, 0);
  const natural = toneParameters(DEFAULT_TONE);
  assert.deepEqual(natural.gain, [1, 1, 1]);
  assert.equal(natural.saturation, 1);
  assert.equal(natural.multiplier, 1);
  natural.gain[0] = 9;
  assert.equal(toneParameters(DEFAULT_TONE).gain[0], 1);
});

test("Three grading uses native exposure, returns to original output, and releases its pass once", () => {
  const renderer = { toneMappingExposure: 1.08 };
  const passes = [];
  const composer = { addPass: pass => passes.push(pass), removePass: pass => passes.splice(passes.indexOf(pass), 1) };
  const tone = createSceneTone(renderer, composer);
  const pass = passes[0];
  assert.equal(pass.enabled, false);
  let releases = 0;
  pass.material.addEventListener("dispose", () => releases++);
  tone.setTone({ preset: "warm", exposure: 1 });
  assert.equal(renderer.toneMappingExposure, 2.16);
  assert.equal(pass.enabled, true);
  assert.ok(pass.uniforms.toneGain.value.x > pass.uniforms.toneGain.value.z);
  tone.setTone({ preset: "mono" });
  assert.equal(renderer.toneMappingExposure, 2.16);
  assert.equal(pass.uniforms.toneSaturation.value, 0);
  // A later time/weather refresh must preserve the user's exposure stops.
  tone.setBaseExposure(0.95);
  assert.equal(renderer.toneMappingExposure, 1.9);
  tone.setTone(DEFAULT_TONE);
  assert.equal(renderer.toneMappingExposure, 0.95);
  assert.equal(pass.enabled, false);
  tone.dispose(); tone.dispose();
  assert.equal(releases, 1);
  assert.equal(passes.length, 0);
  assert.deepEqual(tone.setTone({ exposure: 1 }), DEFAULT_TONE);
  tone.setBaseExposure(1.08);
  assert.equal(renderer.toneMappingExposure, 0.95);
});

test("Cesium grading requests a frame, resets without residual grading, and ignores updates after disposal", () => {
  let stage, removals = 0, renders = 0;
  const C = { Cartesian3, PostProcessStage };
  const scene = {
    postProcessStages: {
      add(value) { stage = value; return value; },
      remove(value) { assert.equal(value, stage); removals++; value.destroy(); },
    },
    requestRender() { renders++; },
  };
  const tone = createRealityTone(C, scene);
  assert.equal(stage.enabled, false);
  const state = tone.setTone({ preset: "cool", exposure: -1 });
  assert.equal(stage.uniforms.toneExposure, 0.5);
  assert.ok(stage.uniforms.toneGain.z > stage.uniforms.toneGain.x);
  assert.equal(stage.enabled, true);
  state.preset = "natural";
  assert.deepEqual(tone.setTone({ exposure: 0 }), { preset: "cool", exposure: 0 });
  tone.setTone(DEFAULT_TONE);
  assert.equal(stage.enabled, false);
  assert.equal(stage.uniforms.toneExposure, 1);
  assert.equal(renders, 3);
  tone.dispose(); tone.dispose();
  assert.equal(removals, 1);
  assert.deepEqual(tone.setTone({ preset: "warm", exposure: 1 }), DEFAULT_TONE);
  assert.equal(renders, 3);
});
