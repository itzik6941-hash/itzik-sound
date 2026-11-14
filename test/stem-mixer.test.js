const { test } = require("node:test");
const assert = require("node:assert/strict");
global.window = {};
require("../public/stem-mixer.js");
const mixer = global.window.ITZIK_STEM_MIXER;

test("stem track settings are normalized and bounded", () => {
  assert.deepEqual(mixer.normalizeTrack({}), { gainDb: 0, pan: 0, mute: false, solo: false, eqLow: 0, eqMid: 0, eqHigh: 0, compThreshold: 0, compRatio: 1, reverbMix: 0, delayMix: 0, delayTime: 0.24, delayFeedback: 0.18 });
  assert.deepEqual(mixer.normalizeTrack({ gainDb: 100, pan: -5, mute: true, solo: 1 }), { gainDb: 12, pan: -1, mute: true, solo: false, eqLow: 0, eqMid: 0, eqHigh: 0, compThreshold: 0, compRatio: 1, reverbMix: 0, delayMix: 0, delayTime: 0.24, delayFeedback: 0.18 });
});

test("solo and mute rules calculate the expected track gain", () => {
  const normal = { gainDb: 0, pan: 0, mute: false, solo: false };
  const solo = { ...normal, solo: true };
  const muted = { ...normal, mute: true };
  assert.equal(mixer.effectiveGain(normal, false), 1);
  assert.equal(mixer.effectiveGain(normal, true), 0);
  assert.equal(mixer.effectiveGain(solo, true), 1);
  assert.equal(mixer.effectiveGain(muted, false), 0);
  assert.equal(mixer.effectiveGain({ ...normal, gainDb: -6 }, false), 10 ** (-6 / 20));
});


test("stem track effect settings are normalized and bounded", () => {
  const state = mixer.normalizeTrack({ eqLow: 30, eqMid: -30, eqHigh: 4, compThreshold: -100, compRatio: 20, reverbMix: 2, delayMix: -1, delayTime: 2, delayFeedback: 1 });
  assert.equal(state.eqLow, 12);
  assert.equal(state.eqMid, -12);
  assert.equal(state.eqHigh, 4);
  assert.equal(state.compThreshold, -36);
  assert.equal(state.compRatio, 12);
  assert.equal(state.reverbMix, 0.5);
  assert.equal(state.delayMix, 0);
  assert.equal(state.delayTime, 0.75);
  assert.equal(state.delayFeedback, 0.65);
});

test("stem pan formatter reports left center and right positions", () => {
  assert.equal(mixer.formatPan(-1), "L");
  assert.equal(mixer.formatPan(0), "C");
  assert.equal(mixer.formatPan(1), "R");
  assert.equal(mixer.formatPan(0.5), "R 50%");
});


test("stem export keeps enough tail for reverb and delay feedback", () => {
  assert.equal(mixer.effectTailSeconds({ reverbMix: 0, delayMix: 0, delayTime: 0.24, delayFeedback: 0 }), 0);
  assert.equal(mixer.effectTailSeconds({ reverbMix: 0.2, delayMix: 0, delayTime: 0.24, delayFeedback: 0 }), 1.6);
  assert.ok(mixer.effectTailSeconds({ reverbMix: 0, delayMix: 0.2, delayTime: 0.75, delayFeedback: 0.65 }) >= 10);
});
