// Display grading only. Photographic textures retain their captured lighting.
export const DEFAULT_TONE = Object.freeze({ preset: "natural", exposure: 0 });
export const TONE_PRESETS = Object.freeze({
  natural: Object.freeze({ gain: Object.freeze([1, 1, 1]), saturation: 1 }),
  warm: Object.freeze({ gain: Object.freeze([1.08, 1.01, 0.9]), saturation: 0.96 }),
  cool: Object.freeze({ gain: Object.freeze([0.9, 1.01, 1.09]), saturation: 0.96 }),
  mono: Object.freeze({ gain: Object.freeze([1, 1, 1]), saturation: 0 }),
});

export function normalizeTone(value = {}, previous = DEFAULT_TONE) {
  const fallback = {
    preset: Object.hasOwn(TONE_PRESETS, previous?.preset) ? previous.preset : "natural",
    exposure: Number.isFinite(previous?.exposure) ? Math.max(-1, Math.min(1, previous.exposure)) : 0,
  };
  return {
    preset: Object.hasOwn(TONE_PRESETS, value?.preset) ? value.preset : fallback.preset,
    exposure: Number.isFinite(value?.exposure) ? Math.max(-1, Math.min(1, value.exposure)) : fallback.exposure,
  };
}

export function toneParameters(value) {
  const tone = normalizeTone(value);
  const preset = TONE_PRESETS[tone.preset];
  return { ...tone, gain: [...preset.gain], saturation: preset.saturation, multiplier: 2 ** tone.exposure };
}

// Both renderers grade linear channels with the same white balance and luminance.
// Three applies exposure in OutputPass; Cesium applies it after decoding its output.
export const TONE_GRADE_GLSL = `
uniform vec3 toneGain;
uniform float toneSaturation;
vec3 cityGradeLinear(vec3 color) {
  color = max(color, vec3(0.0));
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luminance), color, toneSaturation) * toneGain;
}
`;
