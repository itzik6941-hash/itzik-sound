(() => {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const hasSoloState = states => states.some(state => state?.solo === true);
  const shouldMuteBase = states => hasSoloState(states);
  const normalize = input => ({
    gainDb: clamp(input?.gainDb ?? 0, -48, 12),
    pan: clamp(input?.pan ?? 0, -1, 1),
    mute: input?.mute === true,
    solo: input?.solo === true
  });

  let context = null;
  let master = null;
  let limiter = null;
  let ownsContext = false;
  let leaderAudio = null;
  let leaderOriginalMute = false;
  let leaderPauseHandler = null;
  let leaderSeekingHandler = null;
  let tracks = new Map();
  let syncTimer = null;
  let rendering = false;

  function stopSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
  }

  function applyAll() {
    if (!context) return;
    const states = [...tracks.values()].map(track => track.state);
    const hasSolo = hasSoloState(states);
    if (leaderAudio && window.ITZIK_MIXER) window.ITZIK_MIXER.apply({ mute: shouldMuteBase(states) || leaderOriginalMute });
    const now = context.currentTime;
    for (const track of tracks.values()) {
      const state = track.state;
      const muted = state.mute || (hasSolo && !state.solo);
      track.gain.gain.setTargetAtTime(muted ? 0 : 10 ** (state.gainDb / 20), now, 0.015);
      track.pan.pan.setTargetAtTime(state.pan, now, 0.015);
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
    for (const track of tracks.values()) {
      try { track.source.disconnect(); } catch {}
      try { track.gain.disconnect(); } catch {}
      try { track.pan.disconnect(); } catch {}
    }
    tracks.clear();
    leaderAudio = null;
    try { master?.disconnect(); } catch {}
    try { limiter?.disconnect(); } catch {}
    if (context && ownsContext) await context.close().catch(() => {});
    context = null;
    master = null;
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
    master.gain.value = 0.85;
    if (sharedContext && sharedDestination) {
      master.connect(sharedDestination);
    } else {
      limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      master.connect(limiter);
      limiter.connect(context.destination);
    }

    if (leaderAudio) {
      leaderPauseHandler = () => pause();
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
      const gain = context.createGain();
      const pan = context.createStereoPanner();
      source.connect(gain);
      gain.connect(pan);
      pan.connect(master);
      tracks.set(item.id, {
        id: item.id,
        audio,
        source,
        gain,
        pan,
        state: normalize(item.settings)
      });
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
      if (audio.ended) audio.currentTime = 0;
      else if (Math.abs(audio.currentTime - start) > 0.12) {
        try { audio.currentTime = Math.min(start, Math.max(0, (audio.duration || start) - 0.02)); } catch {}
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
    syncTimer = setInterval(() => {
      const active = players.filter(audio => !audio.paused && !audio.ended);
      if (active.length < 2) {
        if (!active.length) stopSync();
        return;
      }
      sync();
    }, 250);
  }

  function pause() {
    stopSync();
    if (leaderAudio) leaderAudio.pause();
    for (const track of tracks.values()) track.audio.pause();
  }

  function stop() {
    pause();
    if (leaderAudio) {
      try { leaderAudio.currentTime = 0; } catch {}
    }
    for (const track of tracks.values()) {
      try { track.audio.currentTime = 0; } catch {}
    }
  }

  function setTrack(id, patch) {
    const track = tracks.get(id);
    if (!track) return null;
    track.state = normalize({ ...track.state, ...patch });
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
      const output = new Offline(2, Math.ceil(duration * sampleRate), sampleRate);
      const bus = output.createGain();
      const outputLimiter = output.createDynamicsCompressor();
      outputLimiter.threshold.value = -1;
      outputLimiter.knee.value = 0;
      outputLimiter.ratio.value = 20;
      outputLimiter.attack.value = 0.003;
      outputLimiter.release.value = 0.12;
      bus.gain.value = 0.85;
      bus.connect(outputLimiter);
      outputLimiter.connect(output.destination);

      const hasSolo = hasSoloState(decoded.map(item => item.state));
      const baseSource = output.createBufferSource();
      baseSource.buffer = baseBuffer;
      baseSource.connect(bus);
      if (!hasSolo) baseSource.start(0);
      for (const item of decoded) {
        const source = output.createBufferSource();
        const gain = output.createGain();
        const pan = output.createStereoPanner();
        source.buffer = item.buffer;
        const state = item.state;
        gain.gain.value = state.mute || (hasSolo && !state.solo) ? 0 : 10 ** (state.gainDb / 20);
        pan.pan.value = state.pan;
        source.connect(gain);
        gain.connect(pan);
        pan.connect(bus);
        source.start(0);
      }
      return await output.startRendering();
    } finally {
      rendering = false;
    }
  }

  window.ITZIK_PROJECT_TRACKS = { init, destroy, play, pause, stop, setTrack, getTrack, getSettings, renderMix, normalize, hasSoloState, shouldMuteBase, getPlaybackStartTime };
})();
