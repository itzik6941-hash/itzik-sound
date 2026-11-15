const { test } = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../public/project-track-mixer.js");
const mixer = global.window.ITZIK_PROJECT_TRACKS;

test("project track settings are normalized and bounded", () => {
  assert.deepEqual(mixer.normalize({}), {
    gainDb: 0, pan: 0, mute: false, solo: false
  });
  assert.deepEqual(mixer.normalize({
    gainDb: 99, pan: -5, mute: true, solo: true
  }), {
    gainDb: 12, pan: -1, mute: true, solo: true
  });
  assert.deepEqual(mixer.normalize({
    gainDb: -99, pan: 5, mute: 1, solo: 0
  }), {
    gainDb: -48, pan: 1, mute: false, solo: false
  });
});

test("solo on an added track mutes the original project track", () => {
  assert.equal(mixer.hasSoloState([]), false);
  assert.equal(mixer.shouldMuteBase([]), false);
  assert.equal(mixer.hasSoloState([{ solo: false }, { solo: false }]), false);
  assert.equal(mixer.shouldMuteBase([{ solo: false }, { solo: true }]), true);
  assert.equal(mixer.shouldMuteBase([{ solo: true }]), true);
});

test("a muted track is not treated as solo", () => {
  assert.equal(mixer.hasSoloState([{ mute: true, solo: false }]), false);
  assert.equal(mixer.shouldMuteBase([{ mute: true, solo: false }]), false);
});

test("resume position follows a playing added track after the base ends", () => {
  const endedBase = { currentTime: 12, ended: true };
  const endedShort = { currentTime: 5, ended: true };
  const activeLong = { currentTime: 8.25, ended: false };
  assert.equal(mixer.getPlaybackStartTime(endedBase, [endedShort, activeLong]), 8.25);
});

test("resume position follows the base while it is still active", () => {
  const activeBase = { currentTime: 3.5, ended: false };
  const addedTrack = { currentTime: 3.4, ended: false };
  assert.equal(mixer.getPlaybackStartTime(activeBase, [addedTrack]), 3.5);
});

test("resume starts at zero when every track has ended", () => {
  const endedBase = { currentTime: 10, ended: true };
  const endedTrack = { currentTime: 10, ended: true };
  assert.equal(mixer.getPlaybackStartTime(endedBase, [endedTrack]), 0);
});
