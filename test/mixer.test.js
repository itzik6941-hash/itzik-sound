const { test } = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../public/mixer.js");

test("mixer settings are bounded and preserve safe defaults", () => {
  const mixer = global.window.ITZIK_MIXER;
  assert.deepEqual(mixer.normalize({}), mixer.defaults);
  const settings = mixer.normalize({ gainDb: 999, pan: -8, low: -30, ratio: 40, width: 5, mute: 1 });
  assert.equal(settings.gainDb, 12);
  assert.equal(settings.pan, -1);
  assert.equal(settings.low, -12);
  assert.equal(settings.ratio, 20);
  assert.equal(settings.width, 2);
  assert.equal(settings.mute, false);
});

test("mixer recognizes signal changes for offline rendering", () => {
  const mixer = global.window.ITZIK_MIXER;
  assert.equal(mixer.hasProcessing(mixer.defaults), false);
  assert.equal(mixer.hasProcessing({ ...mixer.defaults, low: 2 }), true);
  assert.equal(mixer.hasProcessing({ ...mixer.defaults, pan: 0.5 }), true);
});


test("stem mixer clamps pan and formats stereo positions consistently", () => {
  const fs = require("node:fs");
  const vm = require("node:vm");
  const sandbox = { window: {}, console, setInterval, clearInterval };
  vm.runInNewContext(fs.readFileSync(require.resolve("../public/stem-mixer.js"), "utf8"), sandbox);
  const mixer = sandbox.window.ITZIK_STEM_MIXER;
  assert.equal(mixer.formatPan(-1), "L");
  assert.equal(mixer.formatPan(0), "C");
  assert.equal(mixer.formatPan(1), "R");
  assert.equal(mixer.formatPan(-0.5), "L 50%");
  assert.equal(mixer.formatPan(2), "R");
  assert.equal(mixer.effectiveGain(mixer.normalizeTrack({ mute: true }), false), 0);
  assert.equal(mixer.effectiveGain(mixer.normalizeTrack({ solo: false }), true), 0);
});

test("project output ceiling clamps and updates the shared output limiter", () => {
  const mixer = global.window.ITZIK_MIXER;
  assert.equal(mixer.setProjectOutputCeiling(-99), -6);
  assert.equal(mixer.setProjectOutputCeiling(0), -0.1);
  assert.equal(mixer.setProjectOutputCeiling(-2.5), -2.5);
});
