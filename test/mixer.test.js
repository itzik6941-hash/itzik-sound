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
