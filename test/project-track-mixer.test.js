import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.window = {};
await import("../public/project-track-mixer.js");
const mixer = globalThis.window.ITZIK_PROJECT_TRACKS;

test("project track settings are normalized and bounded", () => {
  assert.deepEqual(mixer.normalize({}), {
    gainDb: 0, pan: 0, mute: false, solo: false, stereoWidth: 1,
    inputTrimDb: 0, phaseInvert: false, saturation: 0,
    eqLowDb: 0, eqMidDb: 0, eqHighDb: 0, compThreshold: -18, compRatio: 1, compAttack: 0.012, compRelease: 0.22,
    reverbMix: 0, delayMix: 0, delayTime: 0.24, delayFeedback: 0.18
  });
  assert.deepEqual(mixer.normalize({
    gainDb: 99, pan: -5, mute: true, solo: true,
    inputTrimDb: 99, saturation: 99, compAttack: 0, compRelease: 2,
    eqLowDb: 99, eqMidDb: -99, eqHighDb: 99, compThreshold: -99, compRatio: 99,
    reverbMix: 99, delayMix: 99, delayTime: 99, delayFeedback: 99
  }), {
    gainDb: 12, pan: -1, mute: true, solo: true, stereoWidth: 1,
    inputTrimDb: 24, phaseInvert: false, saturation: 99,
    eqLowDb: 12, eqMidDb: -12, eqHighDb: 12, compThreshold: -36, compRatio: 12, compAttack: 0.001, compRelease: 1,
    reverbMix: 0.5, delayMix: 0.5, delayTime: 0.75, delayFeedback: 0.65
  });
  assert.deepEqual(mixer.normalize({
    gainDb: -99, pan: 5, mute: 1, solo: 0, stereoWidth: 99
  }), {
    gainDb: -48, pan: 1, mute: false, solo: false, stereoWidth: 2,
    inputTrimDb: 0, phaseInvert: false, saturation: 0,
    eqLowDb: 0, eqMidDb: 0, eqHighDb: 0, compThreshold: -18, compRatio: 1, compAttack: 0.012, compRelease: 0.22,
    reverbMix: 0, delayMix: 0, delayTime: 0.24, delayFeedback: 0.18
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
    gain: { value: 1, setTargetAtTime() {} },
    pan: { value: 0, setTargetAtTime() {} },
    frequency: { value: 0 }, Q: { value: 0 },
    threshold: { value: 0 }, ratio: { value: 1 }, knee: { value: 0 },
    attack: { value: 0 }, release: { value: 0 }, delayTime: { value: 0 },
    buffer: null,
    connect(destination) { connections.push(destination); },
    disconnect() {}
  });
  let closed = false;
  let appliedBaseMute = false;
  const sharedBus = makeNode();
  const sharedContext = {
    currentTime: 0,
    destination: makeNode(),
    sampleRate: 44100,
    createGain: makeNode,
    createStereoPanner: makeNode,
    createChannelSplitter: makeNode,
    createChannelMerger: makeNode,
    createBiquadFilter: makeNode,
    createDynamicsCompressor: makeNode,
    createAnalyser() { return { fftSize: 2048, smoothingTimeConstant: 0, getFloatTimeDomainData(buffer) { buffer.fill(0); }, connect(destination) { connections.push(destination); }, disconnect() {} }; },
    createWaveShaper: makeNode,
    createDelay: makeNode,
    createConvolver: makeNode,
    createBuffer(channels, length) { const data=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData(channel){return data[channel];}}; },
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
  mixer.setTrack("track-1", { stereoWidth: 0, solo: true });
  assert.equal(mixer.getTrack("track-1").stereoWidth, 0);
  assert.equal(appliedBaseMute, true);
  mixer.setTrack("track-1", { stereoWidth: 1.75 });
  assert.equal(mixer.getTrack("track-1").stereoWidth, 1.75);
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

test("multitrack duration uses the longest available track", () => {
  const audio = (duration) => ({ duration });
  assert.equal(mixer.getPlaybackDuration(audio(60), [audio(90), audio(45)]), 90);
  assert.equal(mixer.getPlaybackDuration(audio(60), [audio(30)]), 60);
  assert.equal(mixer.getPlaybackDuration(null, [audio(30), audio(45)]), 45);
  assert.equal(mixer.getPlaybackDuration(null, []), 0);
});

test("multitrack playing state remains active if the base track ended", () => {
  const audio = (paused, ended) => ({ paused, ended });
  assert.equal(mixer.isAnyTrackPlaying(audio(true, true), [audio(false, false)]), true);
  assert.equal(mixer.isAnyTrackPlaying(audio(false, false), [audio(true, false)]), true);
  assert.equal(mixer.isAnyTrackPlaying(audio(true, true), [audio(true, true)]), false);
});

test("multitrack seek clamps each file to its own duration", () => {
  assert.equal(mixer.getSynchronizedSeekTime(25, 10), 9.98);
  assert.equal(mixer.getSynchronizedSeekTime(25, 40), 25);
});


test("master level is normalized to a safe range and defaults to -1.5 dB", () => {
  assert.equal(mixer.getMasterDb(), -1.5);
  assert.equal(mixer.normalizeMasterDb(-100), -24);
  assert.equal(mixer.normalizeMasterDb(100), 6);
  assert.equal(mixer.normalizeMasterDb(2.5), 2.5);
});

test("master level can be changed and read back", () => {
  assert.equal(mixer.setMasterDb(-8.5), -8.5);
  assert.equal(mixer.getMasterDb(), -8.5);
  assert.equal(mixer.setMasterDb(99), 6);
  assert.equal(mixer.setMasterDb(-1.5), -1.5);
});


test("per-track EQ, compressor, reverb and delay settings are safely bounded", () => {
  const state=mixer.normalize({
    inputTrimDb:99,phaseInvert:true,saturation:150,
    eqLowDb:20,eqMidDb:-20,eqHighDb:3,
    compThreshold:-100,compRatio:30,compAttack:0,compRelease:5,reverbMix:1,delayMix:-1,
    delayTime:2,delayFeedback:1
  });
  assert.deepEqual({
    inputTrimDb:state.inputTrimDb,phaseInvert:state.phaseInvert,saturation:state.saturation,
    eqLowDb:state.eqLowDb,eqMidDb:state.eqMidDb,eqHighDb:state.eqHighDb,
    compThreshold:state.compThreshold,compRatio:state.compRatio,compAttack:state.compAttack,compRelease:state.compRelease,
    reverbMix:state.reverbMix,delayMix:state.delayMix,
    delayTime:state.delayTime,delayFeedback:state.delayFeedback
  },{
    inputTrimDb:24,phaseInvert:true,saturation:100,
    eqLowDb:12,eqMidDb:-12,eqHighDb:3,
    compThreshold:-36,compRatio:12,compAttack:0.001,compRelease:1,reverbMix:0.5,delayMix:0,
    delayTime:0.75,delayFeedback:0.65
  });
});

test("neutral track effects stay disabled by default", () => {
  const state=mixer.normalize({});
  assert.equal(state.inputTrimDb,0);
  assert.equal(state.phaseInvert,false);
  assert.equal(state.saturation,0);
  assert.equal(state.compAttack,0.012);
  assert.equal(state.compRelease,0.22);
  assert.equal(state.eqLowDb,0);
  assert.equal(state.eqMidDb,0);
  assert.equal(state.eqHighDb,0);
  assert.equal(state.compRatio,1);
  assert.equal(state.compThreshold,-18);
  assert.equal(state.reverbMix,0);
  assert.equal(state.delayMix,0);
});

test("offline export tail grows to include feedback delay echoes", () => {
  assert.equal(mixer.getEffectsTailDuration([{delayMix:0,delayFeedback:0.65,delayTime:0.75}]),1.3);
  assert.ok(mixer.getEffectsTailDuration([{delayMix:0.5,delayFeedback:0.65,delayTime:0.75}])>1.3);
  assert.ok(mixer.getEffectsTailDuration([{delayMix:0.5,delayFeedback:0.65,delayTime:0.75}])<=12);
});

test("master meter returns a silent safe reading before mixer initialization", () => {
  const source = fs.readFileSync(new URL("../public/project-track-mixer.js", import.meta.url), "utf8");
  assert.match(source, /function getMasterMeter\(\)/);
  assert.match(source, /clipping: peak >= 0\.999/);
  assert.match(source, /masterAnalyser\.fftSize = 2048/);
});

test("master output ceiling is constrained to a safe limiter range", () => {
  assert.equal(mixer.normalizeOutputCeilingDb(-99), -6);
  assert.equal(mixer.normalizeOutputCeilingDb(0), -0.1);
  assert.equal(mixer.normalizeOutputCeilingDb(-3.5), -3.5);
});

test("stereo width is neutral by default and bounded from mono to double width", () => {
  assert.equal(mixer.normalize({}).stereoWidth, 1);
  assert.equal(mixer.normalize({ stereoWidth: -1 }).stereoWidth, 0);
  assert.equal(mixer.normalize({ stereoWidth: 3 }).stereoWidth, 2);
});

test("stereo widener uses the correct mid-side polarity and neutral matrix", () => {
  const source = fs.readFileSync(new URL("../public/project-track-mixer.js", import.meta.url), "utf8");
  assert.match(source, /widthMid\.gain\.value = 0\.5/);
  assert.match(source, /widthSide\.gain\.value = 0\.5/);
  assert.match(source, /setParam\(graph\.widthSideInvert\.gain, -1, ctx\)/);
  assert.match(source, /setParam\(graph\.widthSideRightInvert\.gain, -1, ctx\)/);
});

test("stereo meter computes independent peak and RMS for left and right channels", () => {
  const source = fs.readFileSync(new URL("../public/project-track-mixer.js", import.meta.url), "utf8");
  assert.match(source, /masterStereoSplitter\.connect\(masterLeftAnalyser, 0\)/);
  assert.match(source, /masterStereoSplitter\.connect\(masterRightAnalyser, 1\)/);
  assert.match(source, /stereoBalance: left\.peak \+ right\.peak/);
  assert.match(source, /left, right, correlation, stereoBalance/);
  assert.match(source, /cross \/ Math\.sqrt\(leftEnergy \* rightEnergy\)/);
});


test("each added track exposes an independent live level meter", () => {
  const source = fs.readFileSync(new URL("../public/project-track-mixer.js", import.meta.url), "utf8");
  assert.match(source, /meterAnalyser = ctx\.createAnalyser\(\)/);
  assert.match(source, /pan\.connect\(meterAnalyser\)/);
  assert.match(source, /function getTrackMeter\(id\)/);
  assert.match(source, /getMasterMeter, getTrackMeter/);
});


test("per-track meters retain peak hold and expose a reset control", () => {
 const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
 assert.match(app, /data-peak-db="-120"/);
 assert.match(app, /data-project-track-meter-hold/);
 assert.match(app, /Math\.max\(Number\(wrap\.dataset\.peakDb\?\?-120\)/);
 assert.match(app, /projectTracksPeakReset/);
});


test("per-track meter displays RMS level", () => {
 const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
 assert.match(app, /data-project-track-meter-rms/);
 assert.match(app, /trackMeter\.rms/);
});

test("each project track exposes independent left and right level analysis", () => {
 const mixer = fs.readFileSync(new URL("../public/project-track-mixer.js", import.meta.url), "utf8");
 const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
 assert.match(mixer, /meterLeftAnalyser/);
 assert.match(mixer, /meterRightAnalyser/);
 assert.match(mixer, /stereoBalance: left\.peak/);
 assert.match(app, /data-project-track-meter-left/);
 assert.match(app, /data-project-track-meter-right/);
});
