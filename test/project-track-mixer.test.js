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

test("added tracks reuse the main mixer audio context and do not close it", async () => {
  const connections = [];
  const makeNode = () => ({
    gain: { setTargetAtTime() {} },
    pan: { setTargetAtTime() {} },
    connect(destination) { connections.push(destination); },
    disconnect() {}
  });
  let closed = false;
  let appliedBaseMute = false;
  const sharedBus = makeNode();
  const sharedContext = {
    currentTime: 0,
    destination: makeNode(),
    createGain: makeNode,
    createStereoPanner: makeNode,
    createMediaElementSource() { return makeNode(); },
    async close() { closed = true; }
  };
  global.window.ITZIK_MIXER = {
    getAudioContext: () => sharedContext,
    getProjectMixDestination: () => sharedBus,
    getSettings: () => ({ mute: false }),
    apply(settings) { appliedBaseMute = settings.mute; }
  };
  const makeAudio = () => ({
    currentTime: 0, duration: 20, ended: false, paused: true, seeking: false,
    addEventListener() {}, removeEventListener() {},
    pause() {}, async play() {}
  });
  const leader = makeAudio();
  const added = makeAudio();

  await mixer.init([{ id: "track-1", audio: added }], leader);
  assert.ok(connections.includes(sharedBus));
  mixer.setTrack("track-1", { solo: true });
  assert.equal(appliedBaseMute, true);
  mixer.setBaseMute(false);
  assert.equal(appliedBaseMute, true);
  mixer.setTrack("track-1", { solo: false });
  assert.equal(appliedBaseMute, false);
  await mixer.destroy();
  assert.equal(closed, false);
  delete global.window.ITZIK_MIXER;
});

test("base mute preference remains separate from temporary Solo muting", () => {
  assert.equal(mixer.setBaseMute(true), true);
  assert.equal(mixer.getBaseMute(), true);
  assert.equal(mixer.setBaseMute(false), false);
  assert.equal(mixer.getBaseMute(), false);
});

test("base Solo plays the main track and mutes every added track", () => {
  assert.equal(mixer.shouldPlayBase(false, false), true);
  assert.equal(mixer.shouldMuteAdded({ mute: false, solo: false }, false, true), true);
  assert.equal(mixer.shouldMuteAdded({ mute: false, solo: true }, false, true), true);
});

test("added-track Solo plays only soloed added tracks and silences the base", () => {
  assert.equal(mixer.shouldPlayBase(true, false), false);
  assert.equal(mixer.shouldMuteAdded({ mute: false, solo: true }, true, false), false);
  assert.equal(mixer.shouldMuteAdded({ mute: false, solo: false }, true, false), true);
});

test("manual base mute remains effective without changing added-track Solo", () => {
  assert.equal(mixer.shouldPlayBase(false, true), false);
  assert.equal(mixer.shouldMuteAdded({ mute: false, solo: false }, false, false), false);
  assert.equal(mixer.shouldMuteAdded({ mute: true, solo: false }, false, false), true);
});

test("main-track Solo state can be enabled and disabled", () => {
  assert.equal(mixer.setBaseSolo(true), true);
  assert.equal(mixer.getBaseSolo(), true);
  assert.equal(mixer.setBaseSolo(false), false);
  assert.equal(mixer.getBaseSolo(), false);
});

test("natural end of the base track does not pause added tracks", () => {
  assert.equal(mixer.shouldPauseTracksOnLeaderPause({ ended: true }), false);
  assert.equal(mixer.shouldPauseTracksOnLeaderPause({ ended: false }), true);
  assert.equal(mixer.shouldPauseTracksOnLeaderPause(null), true);
});

test("resume seeks an ended base track to the active added-track position", () => {
  assert.equal(mixer.getPlaybackStartTime(
    { currentTime: 12, ended: true },
    [{ currentTime: 18.5, ended: false }]
  ), 18.5);
  assert.equal(mixer.getSynchronizedSeekTime(18.5, 12), 11.98);
  assert.equal(mixer.getSynchronizedSeekTime(18.5, 40), 18.5);
});

test("when all tracks ended, playback restarts from the beginning", () => {
  const start = mixer.getPlaybackStartTime(
    { currentTime: 12, ended: true },
    [{ currentTime: 20, ended: true }]
  );
  assert.equal(start, 0);
  assert.equal(mixer.getSynchronizedSeekTime(start, 12), 0);
});
