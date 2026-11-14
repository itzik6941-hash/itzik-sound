const { test } = require("node:test");
const assert = require("node:assert/strict");
const presets = require("../public/mixer-presets");

test("mixer preset catalog exposes the expected named starting points", () => {
  assert.deepEqual(presets.list().map(item => item.id), ["clean", "vocal", "warm", "punch", "wide"]);
  assert.equal(presets.list().length, 5);
});

test("every mixer preset is complete, bounded and isolated from later mutation", () => {
  const keys = ["gainDb", "pan", "low", "mid", "high", "threshold", "ratio", "reverb", "delay", "width", "masterDb", "mute", "bypass"];
  for (const item of presets.list()) {
    const values = presets.get(item.id);
    assert.deepEqual(Object.keys(values).sort(), [...keys].sort());
    assert.ok(values.gainDb >= -24 && values.gainDb <= 12);
    assert.ok(values.pan >= -1 && values.pan <= 1);
    assert.ok(values.low >= -12 && values.low <= 12);
    assert.ok(values.mid >= -12 && values.mid <= 12);
    assert.ok(values.high >= -12 && values.high <= 12);
    assert.ok(values.threshold >= -60 && values.threshold <= 0);
    assert.ok(values.ratio >= 1 && values.ratio <= 20);
    assert.ok(values.reverb >= 0 && values.reverb <= 0.6);
    assert.ok(values.delay >= 0 && values.delay <= 0.6);
    assert.ok(values.width >= 0 && values.width <= 2);
    assert.ok(values.masterDb >= -18 && values.masterDb <= 6);
    values.low = 12;
    assert.notEqual(presets.get(item.id).low, 12);
  }
});

test("unknown mixer presets return null", () => {
  assert.equal(presets.get("unknown"), null);
});
