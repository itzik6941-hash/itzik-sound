const { test } = require("node:test");
const assert = require("node:assert/strict");
global.window = {};
require("../public/stem-mixer.js");
const mixer = global.window.ITZIK_STEM_MIXER;

test("stem track settings are normalized and bounded", () => {
  assert.deepEqual(mixer.normalizeTrack({}), { gainDb: 0, pan: 0, mute: false, solo: false });
  assert.deepEqual(mixer.normalizeTrack({ gainDb: 100, pan: -5, mute: true, solo: 1 }), { gainDb: 12, pan: -1, mute: true, solo: false });
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
