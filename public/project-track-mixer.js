(() => {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const normalizeMasterDb = value => clamp(value ?? -1.5, -24, 6);
  const normalizeOutputCeilingDb = value => clamp(value ?? -1, -6, -0.1);
  let outputCeilingDb = -1;
  const hasSoloState = states => states.some(state => state?.solo === true);
  const shouldMuteBase = states => hasSoloState(states);
  const shouldMuteAdded = (state, hasSolo, baseSolo) => state?.mute === true || baseSolo === true || (hasSolo && state?.solo !== true);
  const shouldPlayBase = (hasSolo, baseMute) => !hasSolo && baseMute !== true;
  const shouldPauseTracksOnLeaderPause = leader => !leader?.ended;
  const getSynchronizedSeekTime = (start, duration) => Number.isFinite(duration) ? Math.max(0, Math.min(start, Math.max(0, duration - 0.02))) : Math.max(0, start);
  const getPlaybackDuration = (leader, trackAudios) => Math.max(0, ...[leader, ...trackAudios].filter(Boolean).map(audio => Number.isFinite(audio.duration) ? audio.duration : 0));
  const isAnyTrackPlaying = (leader, trackAudios) => [leader, ...trackAudios].some(audio => audio && !audio.paused && !audio.ended);
  const effectDefaults = Object.freeze({
    inputTrimDb: 0, phaseInvert: false, saturation: 0,
    eqLowDb: 0, eqMidDb: 0, eqHighDb: 0,
    compThreshold: -18, compRatio: 1, compAttack: 0.012, compRelease: 0.22,
    reverbMix: 0, delayMix: 0, delayTime: 0.24, delayFeedback: 0.18,
    stereoWidth: 1
  });
  const normalize = input => ({
    gainDb: clamp(input?.gainDb ?? 0, -48, 12),
    pan: clamp(input?.pan ?? 0, -1, 1),
    mute: input?.mute === true,
    solo: input?.solo === true,
    inputTrimDb: clamp(input?.inputTrimDb ?? 0, -24, 24),
    phaseInvert: input?.phaseInvert === true,
    saturation: clamp(input?.saturation ?? 0, 0, 100),
    eqLowDb: clamp(input?.eqLowDb ?? 0, -12, 12),
    eqMidDb: clamp(input?.eqMidDb ?? 0, -12, 12),
    eqHighDb: clamp(input?.eqHighDb ?? 0, -12, 12),
    compThreshold: clamp(input?.compThreshold ?? -18, -36, 0),
    compRatio: clamp(input?.compRatio ?? 1, 1, 12),
    compAttack: clamp(input?.compAttack ?? 0.012, 0.001, 0.1),
    compRelease: clamp(input?.compRelease ?? 0.22, 0.05, 1),
    reverbMix: clamp(input?.reverbMix ?? 0, 0, 0.5),
    delayMix: clamp(input?.delayMix ?? 0, 0, 0.5),
    delayTime: clamp(input?.delayTime ?? 0.24, 0.05, 0.75),
    delayFeedback: clamp(input?.delayFeedback ?? 0.18, 0, 0.65),
    stereoWidth: clamp(input?.stereoWidth ?? 1, 0, 2)
  });

  const saturationCurveCache = new Map();
  function makeSaturationCurve(amount) {
    const level = clamp(amount, 0, 100);
    if (level === 0) return null;
    if (saturationCurveCache.has(level)) return saturationCurveCache.get(level);
    const drive = 1 + (level / 100) * 18;
    const samples = 2048;
    const curve = new Float32Array(samples);
    const normalizer = Math.tanh(drive);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / (samples - 1) - 1;
      curve[i] = Math.tanh(x * drive) / normalizer;
    }
    if (saturationCurveCache.size >= 100) saturationCurveCache.clear();
    saturationCurveCache.set(level, curve);
    return curve;
  }

  function makeImpulse(ctx) {
    const length = Math.floor(ctx.sampleRate * 1.25);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = (1 - i / length) ** 2.6;
        const seed = Math.sin((i + 1) * (channel ? 12.9898 : 78.233)) * 43758.5453;
        data[i] = (2 * (seed - Math.floor(seed)) - 1) * decay;
      }
    }
    return impulse;
  }

  function setParam(param, value, ctx) {
    if (!param) return;
    if (typeof param.setTargetAtTime === "function" && ctx) param.setTargetAtTime(value, ctx.currentTime, 0.015);
    else param.value = value;
  }

  function buildTrackGraph(ctx, source, destination, state) {
    const input = ctx.createGain();
    const gain = ctx.createGain();
    const polarity = ctx.createGain();
    const low = ctx.createBiquadFilter();
    const mid = ctx.createBiquadFilter();
    const high = ctx.createBiquadFilter();
    const compressor = ctx.createDynamicsCompressor();
    const saturator = ctx.createWaveShaper();
    const dry = ctx.createGain();
    const delay = ctx.createDelay(1.5);
    const feedback = ctx.createGain();
    const delayWet = ctx.createGain();
    const effectBus = ctx.createGain();
    const reverbDry = ctx.createGain();
    const convolver = ctx.createConvolver();
    const reverbWet = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const widthSplitter = ctx.createChannelSplitter(2);
    const widthMerger = ctx.createChannelMerger(2);
    const widthMid = ctx.createGain();
    const widthSide = ctx.createGain();
    const widthSideInvert = ctx.createGain();
    const widthSideRightInvert = ctx.createGain();
    const widthLeft = ctx.createGain();
    const widthRight = ctx.createGain();

    low.type = "lowshelf"; low.frequency.value = 100;
    mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 0.8;
    high.type = "highshelf"; high.frequency.value = 8000;
    convolver.buffer = makeImpulse(ctx);
    dry.gain.value = 1;
    delayWet.gain.value = 0;
    feedback.gain.value = 0.18;
    reverbDry.gain.value = 1;
    reverbWet.gain.value = 0;
    compressor.knee.value = 0;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.22;

    source.connect(input);
    input.connect(gain);
    gain.connect(polarity);
    polarity.connect(low); low.connect(mid); mid.connect(high); high.connect(compressor);
    compressor.connect(saturator);
    saturator.connect(dry); dry.connect(effectBus);
    saturator.connect(delay); delay.connect(feedback); feedback.connect(delay);
    delay.connect(delayWet); delayWet.connect(effectBus);
    effectBus.connect(widthSplitter);
    widthSplitter.connect(widthMid, 0); widthSplitter.connect(widthMid, 1);
    widthSplitter.connect(widthSide, 0); widthSplitter.connect(widthSideInvert, 1);
    widthSideInvert.connect(widthSide);
    widthMid.gain.value = 0.5;
    widthSide.gain.value = 0.5;
    widthSide.connect(widthSideRightInvert);
    widthMid.connect(widthLeft); widthSide.connect(widthLeft);
    widthMid.connect(widthRight); widthSideRightInvert.connect(widthRight);
    widthLeft.connect(widthMerger, 0, 0); widthRight.connect(widthMerger, 0, 1);
    widthMerger.connect(reverbDry); reverbDry.connect(pan);
    widthMerger.connect(convolver); convolver.connect(reverbWet); reverbWet.connect(pan);
    pan.connect(destination);

    const graph = { input, gain, polarity, low, mid, high, compressor, saturator, dry, delay, feedback, delayWet, effectBus, widthSplitter, widthMerger, widthMid, widthSide, widthSideInvert, widthSideRightInvert, widthLeft, widthRight, reverbDry, convolver, reverbWet, pan };
    applyTrackGraph(graph, state, ctx);
    return graph;
  }

  function applyTrackGraph(graph, state, ctx) {
    const v = normalize(state);
    setParam(graph.input.gain, 10 ** (v.inputTrimDb / 20), ctx);
    setParam(graph.gain.gain, v.mute ? 0 : 10 ** (v.gainDb / 20), ctx);
    setParam(graph.polarity.gain, v.phaseInvert ? -1 : 1, ctx);
    graph.saturator.curve = makeSaturationCurve(v.saturation);
    graph.saturator.oversample = "4x";
    setParam(graph.low.gain, v.eqLowDb, ctx);
    setParam(graph.mid.gain, v.eqMidDb, ctx);
    setParam(graph.high.gain, v.eqHighDb, ctx);
    setParam(graph.compressor.threshold, v.compThreshold, ctx);
    setParam(graph.compressor.ratio, v.compRatio, ctx);
    setParam(graph.compressor.knee, v.compRatio <= 1 ? 0 : 12, ctx);
    setParam(graph.compressor.attack, v.compAttack, ctx);
    setParam(graph.compressor.release, v.compRelease, ctx);
    setParam(graph.delay.delayTime, v.delayTime, ctx);
    setParam(graph.feedback.gain, v.delayMix > 0 ? v.delayFeedback : 0, ctx);
    setParam(graph.delayWet.gain, v.delayMix, ctx);
    setParam(graph.reverbWet.gain, v.reverbMix, ctx);
    setParam(graph.widthSide.gain, 0.5 * v.stereoWidth, ctx);
    setParam(graph.widthSideInvert.gain, -1, ctx);
    setParam(graph.widthSideRightInvert.gain, -1, ctx);
    setParam(graph.pan.pan, v.pan, ctx);
  }

  function getEffectsTailDuration(states) {
    let tail = 1.3;
    for (const state of states || []) {
      if ((state?.delayMix || 0) <= 0 || (state?.delayFeedback || 0) <= 0) continue;
      const feedback = clamp(state.delayFeedback, 0, 0.65);
      const repeats = Math.ceil(Math.log(0.001) / Math.log(Math.max(0.01, feedback)));
      tail = Math.max(tail, Math.min(12, clamp(state.delayTime ?? 0.24, 0.05, 0.75) * repeats + 1.3));
    }
    return tail;
  }

  let context = null;
  let master = null;
  let masterDb = -1.5;
  let limiter = null;
  let masterAnalyser = null;
  let masterMeterBuffer = null;
  let ownsContext = false;
  let leaderAudio = null;
  let leaderOriginalMute = false;
  let baseSolo = false;
  let leaderPauseHandler = null;
  let leaderSeekingHandler = null;
  let tracks = new Map();
  let syncTimer = null;
  let rendering = false;

  function notifyPlaybackState() {
    if (typeof window.dispatchEvent === "function" && typeof Event === "function") window.dispatchEvent(new Event("itzik-project-tracks-statechange"));
  }

  function stopSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
  }

  function applyAll() {
    if (!context) return;
    const states = [...tracks.values()].map(track => track.state);
    const hasSolo = !baseSolo && hasSoloState(states);
    if (leaderAudio && window.ITZIK_MIXER) window.ITZIK_MIXER.apply({ mute: baseSolo ? leaderOriginalMute : hasSolo || leaderOriginalMute });
    const now = context.currentTime;
    for (const track of tracks.values()) {
      const state = track.state;
      const muted = shouldMuteAdded(state, hasSolo, baseSolo);
      applyTrackGraph(track.graph, { ...state, mute: muted }, context);
    }
  }

  async function destroy() {
    pause();
    if (leaderAudio && leaderPauseHandler) leaderAudio.removeEventListener("pause", leaderPauseHandler);
    if (leaderAudio && leaderSeekingHandler) leaderAudio.removeEventListener("seeking", leaderSeekingHandler);
    leaderPauseHandler = null;
    leaderSeekingHandler = null;
    if (leaderAudio && window.ITZIK_MIXER) window.ITZIK_MIXER.apply({ mute: leaderOriginalMute });
    leaderOriginalMute = false;
    baseSolo = false;
    for (const track of tracks.values()) {
      try { track.source.disconnect(); } catch {}
      for (const node of Object.values(track.graph || {})) { try { node.disconnect(); } catch {} }
    }
    tracks.clear();
    leaderAudio = null;
    try { master?.disconnect(); } catch {}
    try { masterAnalyser?.disconnect(); } catch {}
    try { limiter?.disconnect(); } catch {}
    if (context && ownsContext) await context.close().catch(() => {});
    context = null;
    master = null;
    masterAnalyser = null;
    masterMeterBuffer = null;
    limiter = null;
    ownsContext = false;
  }

  async function init(items, leader) {
    await destroy();
    leaderAudio = leader || null;
    leaderOriginalMute = window.ITZIK_MIXER?.getSettings?.().mute === true;
    if (!items?.length) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const sharedContext = window.ITZIK_MIXER?.getAudioContext?.();
    const sharedDestination = window.ITZIK_MIXER?.getProjectMixDestination?.();
    if (!sharedContext && !AudioContextClass) throw new Error("הדפדפן אינו תומך במיקסר רב־ערוצי.");
    context = sharedContext || new AudioContextClass();
    ownsContext = !sharedContext;
    master = context.createGain();
    master.gain.value = 10 ** (masterDb / 20);
    masterAnalyser = context.createAnalyser();
    masterAnalyser.fftSize = 2048;
    masterAnalyser.smoothingTimeConstant = 0.72;
    masterMeterBuffer = new Float32Array(masterAnalyser.fftSize);
    masterStereoSplitter = context.createChannelSplitter(2);
    masterLeftAnalyser = context.createAnalyser();
    masterRightAnalyser = context.createAnalyser();
    for (const analyser of [masterLeftAnalyser, masterRightAnalyser]) {
      analyser.fftSize = masterAnalyser.fftSize;
      analyser.smoothingTimeConstant = masterAnalyser.smoothingTimeConstant;
    }
    masterLeftBuffer = new Float32Array(masterLeftAnalyser.fftSize);
    masterRightBuffer = new Float32Array(masterRightAnalyser.fftSize);
    master.connect(masterAnalyser);
    master.connect(masterStereoSplitter);
    masterStereoSplitter.connect(masterLeftAnalyser, 0);
    masterStereoSplitter.connect(masterRightAnalyser, 1);
    if (sharedContext && sharedDestination) {
      masterAnalyser.connect(sharedDestination);
    } else {
      limiter = context.createDynamicsCompressor();
      limiter.threshold.value = outputCeilingDb;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      masterAnalyser.connect(limiter);
      limiter.connect(context.destination);
    }

    if (leaderAudio) {
      leaderPauseHandler = () => { if (shouldPauseTracksOnLeaderPause(leaderAudio)) pause(); };
      leaderSeekingHandler = () => {
        if (leaderAudio && Number.isFinite(leaderAudio.currentTime)) {
          for (const track of tracks.values()) {
            if (!track.audio.paused && !track.audio.seeking) {
              try { track.audio.currentTime = Math.min(leaderAudio.currentTime, Math.max(0, (track.audio.duration || leaderAudio.currentTime) - 0.02)); } catch {}
            }
          }
        }
      };
      leaderAudio.addEventListener("pause", leaderPauseHandler);
      leaderAudio.addEventListener("seeking", leaderSeekingHandler);
    }

    for (const item of items) {
      const audio = item.audio;
      const source = context.createMediaElementSource(audio);
      const state = normalize(item.settings);
      const graph = buildTrackGraph(context, source, master, state);
      tracks.set(item.id, { id: item.id, audio, source, graph, state });
    }
    applyAll();
  }

  function getPlaybackStartTime(leader, trackAudios) {
    if (leader && !leader.ended) return Math.max(0, leader.currentTime || 0);
    const active = trackAudios.find(track => !track.ended);
    return Math.max(0, active?.currentTime || 0);
  }

  function getPlaybackPosition() {
    return getPlaybackStartTime(leaderAudio, [...tracks.values()].map(track => track.audio));
  }

  function getDuration() {
    return getPlaybackDuration(leaderAudio, [...tracks.values()].map(track => track.audio));
  }

  function isPlaying() {
    return isAnyTrackPlaying(leaderAudio, [...tracks.values()].map(track => track.audio));
  }

  function seek(time) {
    const target = Math.max(0, Number(time) || 0);
    const players = [...(leaderAudio ? [leaderAudio] : []), ...[...tracks.values()].map(track => track.audio)];
    for (const audio of players) {
      try { audio.currentTime = getSynchronizedSeekTime(target, audio.duration); } catch {}
    }
    notifyPlaybackState();
    return getPlaybackPosition();
  }

  function sync() {
    const active = [];
    if (leaderAudio && !leaderAudio.paused && !leaderAudio.ended) active.push(leaderAudio);
    for (const track of tracks.values()) {
      if (!track.audio.paused && !track.audio.ended) active.push(track.audio);
    }
    if (active.length < 2) return active.length === 1;
    const reference = active[0];
    for (const audio of active.slice(1)) {
      if (Math.abs(audio.currentTime - reference.currentTime) > 0.08 && !audio.seeking) {
        try {
          audio.currentTime = Math.min(reference.currentTime, Math.max(0, (audio.duration || reference.currentTime) - 0.02));
        } catch {}
      }
    }
    return true;
  }

  async function play() {
    if (context) await context.resume();
    const list = [...tracks.values()];
    const start = getPlaybackPosition();
    const players = [...(leaderAudio ? [leaderAudio] : []), ...list.map(track => track.audio)];
    for (const audio of players) {
      if (!Number.isFinite(audio.duration)) {
        await new Promise((resolve, reject) => {
          audio.addEventListener("loadedmetadata", resolve, { once: true });
          audio.addEventListener("error", () => reject(new Error("אחד מקובצי האודיו לא נטען.")), { once: true });
        });
      }
    }
    for (const audio of players) {
      const target = getSynchronizedSeekTime(start, audio.duration);
      if (Math.abs(audio.currentTime - target) > 0.12) {
        try { audio.currentTime = target; } catch {}
      }
    }
    try {
      await Promise.all(players.map(audio => audio.play()));
    } catch (error) {
      players.forEach(audio => audio.pause());
      stopSync();
      throw error;
    }
    stopSync();
    notifyPlaybackState();
    syncTimer = setInterval(() => {
      const active = players.filter(audio => !audio.paused && !audio.ended);
      if (!active.length) {
        stopSync();
        notifyPlaybackState();
        return;
      }
      if (active.length > 1) sync();
      notifyPlaybackState();
    }, 250);
  }

  function pause() {
    stopSync();
    if (leaderAudio) leaderAudio.pause();
    for (const track of tracks.values()) track.audio.pause();
    notifyPlaybackState();
  }

  function stop() {
    pause();
    if (leaderAudio) {
      try { leaderAudio.currentTime = 0; } catch {}
    }
    for (const track of tracks.values()) {
      try { track.audio.currentTime = 0; } catch {}
    }
    notifyPlaybackState();
  }

  function setTrack(id, patch) {
    const track = tracks.get(id);
    if (!track) return null;
    track.state = normalize({ ...track.state, ...patch });
    if (patch?.solo === true) baseSolo = false;
    applyAll();
    return { ...track.state };
  }

  function getTrack(id) {
    const track = tracks.get(id);
    return track ? { ...track.state } : null;
  }

  function getSettings() {
    return Object.fromEntries([...tracks].map(([id, track]) => [id, { ...track.state }]));
  }

  function setBaseMute(value) {
    leaderOriginalMute = value === true;
    applyAll();
    return leaderOriginalMute;
  }

  function getBaseMute() {
    return leaderOriginalMute;
  }

  function setMasterDb(value) {
    masterDb = normalizeMasterDb(value);
    if (master && context) master.gain.setTargetAtTime(10 ** (masterDb / 20), context.currentTime, 0.015);
    return masterDb;
  }

  function getMasterDb() {
    return masterDb;
  }

  function setOutputCeilingDb(value) {
    outputCeilingDb = normalizeOutputCeilingDb(value);
    if (limiter) limiter.threshold.setTargetAtTime(outputCeilingDb, context.currentTime, 0.015);
    window.ITZIK_MIXER?.setProjectOutputCeiling?.(outputCeilingDb);
    return outputCeilingDb;
  }

  function getOutputCeilingDb() {
    return outputCeilingDb;
  }

  function measureBuffer(analyser, buffer) {
    if (!analyser || !buffer) return { peak: 0, rms: 0, db: -Infinity, clipping: false };
    analyser.getFloatTimeDomainData(buffer);
    let peak = 0, sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const sample = buffer[i], absolute = Math.abs(sample);
      if (absolute > peak) peak = absolute;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / buffer.length);
    return { peak, rms, db: 20 * Math.log10(Math.max(peak, 1e-6)), clipping: peak >= 0.999 };
  }

  function getMasterMeter() {
    const overall = measureBuffer(masterAnalyser, masterMeterBuffer);
    const left = measureBuffer(masterLeftAnalyser, masterLeftBuffer);
    const right = measureBuffer(masterRightAnalyser, masterRightBuffer);
    return { ...overall, left, right, stereoBalance: left.peak + right.peak > 1e-6 ? (right.peak - left.peak) / (right.peak + left.peak) : 0 };
  }

  function setBaseSolo(value) {
    baseSolo = value === true;
    if (baseSolo) for (const track of tracks.values()) track.state.solo = false;
    applyAll();
    return baseSolo;
  }

  function getBaseSolo() {
    return baseSolo;
  }

  function isActive() {
    return Boolean(context && tracks.size);
  }

  async function renderMix(baseBuffer) {
    if (rendering) throw new Error("ייצוא מיקס כבר מתבצע.");
    if (!baseBuffer) throw new Error("לא נמצא קובץ המקור לייצוא.");
    rendering = true;
    try {
      const entries = [...tracks.values()];
      if (entries.length > 16) throw new Error("אפשר לשלב עד 16 ערוצים נוספים בייצוא אחד.");
      const decoded = [];
      for (const track of entries) {
        const response = await fetch(track.audio.src);
        if (!response.ok) throw new Error("לא ניתן לטעון ערוץ לצורך ייצוא.");
        const bytes = await response.arrayBuffer();
        decoded.push({ buffer: await context.decodeAudioData(bytes.slice(0)), state: { ...track.state } });
      }
      const decodedBytes = baseBuffer.length * baseBuffer.numberOfChannels * 4 + decoded.reduce((total, item) => total + item.buffer.length * item.buffer.numberOfChannels * 4, 0);
      if (decodedBytes > 512 * 1024 * 1024) throw new Error("הקבצים גדולים מדי לייצוא בטוח בדפדפן. נסה לייצא פחות ערוצים בכל פעם.");
      const sampleRate = Math.min(48000, Math.max(baseBuffer.sampleRate, ...decoded.map(item => item.buffer.sampleRate)));
      const duration = Math.max(baseBuffer.duration, ...decoded.map(item => item.buffer.duration));
      if (duration > 600) throw new Error("ייצוא מוגבל ל־10 דקות.");
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Offline) throw new Error("הדפדפן אינו תומך בייצוא Offline.");
      const tailDuration = getEffectsTailDuration(decoded.map(item => item.state));
      const output = new Offline(2, Math.ceil((duration + tailDuration) * sampleRate), sampleRate);
      const bus = output.createGain();
      const outputLimiter = output.createDynamicsCompressor();
      outputLimiter.threshold.value = outputCeilingDb;
      outputLimiter.knee.value = 0;
      outputLimiter.ratio.value = 20;
      outputLimiter.attack.value = 0.003;
      outputLimiter.release.value = 0.12;
      bus.gain.value = 10 ** (masterDb / 20);
      bus.connect(outputLimiter);
      outputLimiter.connect(output.destination);

      const hasSolo = !baseSolo && hasSoloState(decoded.map(item => item.state));
      const baseSource = output.createBufferSource();
      baseSource.buffer = baseBuffer;
      baseSource.connect(bus);
      if (shouldPlayBase(hasSolo, leaderOriginalMute)) baseSource.start(0);
      for (const item of decoded) {
        const source = output.createBufferSource();
        source.buffer = item.buffer;
        const state = item.state;
        buildTrackGraph(output, source, bus, { ...state, mute: shouldMuteAdded(state, hasSolo, baseSolo) });
        source.start(0);
      }
      return await output.startRendering();
    } finally {
      rendering = false;
    }
  }

  window.ITZIK_PROJECT_TRACKS = { init, destroy, play, pause, stop, setTrack, getTrack, getSettings, renderMix, normalize, effectDefaults: { ...effectDefaults }, getEffectsTailDuration, normalizeMasterDb, setMasterDb, getMasterDb, normalizeOutputCeilingDb, setOutputCeilingDb, getOutputCeilingDb, getMasterMeter, hasSoloState, shouldMuteBase, shouldMuteAdded, shouldPlayBase, shouldPauseTracksOnLeaderPause, getSynchronizedSeekTime, getPlaybackStartTime, getPlaybackDuration, isAnyTrackPlaying, getDuration, getPlaybackPosition, isPlaying, seek, setBaseMute, getBaseMute, setBaseSolo, getBaseSolo, isActive };
})();
