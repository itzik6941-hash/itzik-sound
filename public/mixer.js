(() => {
  "use strict";

  const defaults = Object.freeze({
    gainDb: 0, pan: 0, low: 0, mid: 0, high: 0,
    threshold: -18, ratio: 1, reverb: 0, delay: 0,
    width: 1, masterDb: 0, mute: false, bypass: false
  });
  let settings = { ...defaults };
  let context;
  let source;
  let nodes;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
  const toGain = db => 10 ** (clamp(db, -60, 12) / 20);

  function normalize(input = {}) {
    return {
      gainDb: clamp(input.gainDb, -24, 12),
      pan: clamp(input.pan, -1, 1),
      low: clamp(input.low, -12, 12),
      mid: clamp(input.mid, -12, 12),
      high: clamp(input.high, -12, 12),
      threshold: clamp(input.threshold ?? -18, -60, 0),
      ratio: clamp(input.ratio ?? 1, 1, 20),
      reverb: clamp(input.reverb, 0, 0.6),
      delay: clamp(input.delay, 0, 0.6),
      width: clamp(input.width ?? 1, 0, 2),
      masterDb: clamp(input.masterDb, -18, 6),
      mute: input.mute === true,
      bypass: input.bypass === true
    };
  }

  function setParam(param, value) {
    if (!param || !context) return;
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, 0.015);
  }

  function makeImpulse(ctx) {
    const length = Math.floor(ctx.sampleRate * 1.25);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = (1 - i / length) ** 2.6;
        const noise = Math.sin((i + 1) * (channel ? 12.9898 : 78.233)) * 43758.5453;
        data[i] = (2 * (noise - Math.floor(noise)) - 1) * decay;
      }
    }
    return impulse;
  }

  function buildGraph(ctx, input, destination, values, enableMeter = false) {
    const track = ctx.createGain();
    const raw = ctx.createGain();
    const processed = ctx.createGain();
    const low = ctx.createBiquadFilter();
    const mid = ctx.createBiquadFilter();
    const high = ctx.createBiquadFilter();
    const compressor = ctx.createDynamicsCompressor();
    const dry = ctx.createGain();
    const delay = ctx.createDelay(1.5);
    const feedback = ctx.createGain();
    const delayWet = ctx.createGain();
    const effectBus = ctx.createGain();
    const reverbDry = ctx.createGain();
    const convolver = ctx.createConvolver();
    const reverbWet = ctx.createGain();
    const postFx = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const limiter = ctx.createDynamicsCompressor();
    const master = ctx.createGain();
    const meter = enableMeter ? ctx.createAnalyser() : null;

    // Upmix mono inputs before the mid/side matrix so they stay centered.
    postFx.channelCount = 2;
    postFx.channelCountMode = "explicit";
    postFx.channelInterpretation = "speakers";

    low.type = "lowshelf"; low.frequency.value = 100;
    mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 0.8;
    high.type = "highshelf"; high.frequency.value = 8000;
    convolver.buffer = makeImpulse(ctx);
    delay.delayTime.value = 0.28;
    feedback.gain.value = 0.24;
    compressor.knee.value = 20;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.22;
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;

    input.connect(track);
    track.connect(raw);
    track.connect(low);
    low.connect(mid); mid.connect(high); high.connect(compressor);
    compressor.connect(dry); dry.connect(effectBus);
    compressor.connect(delay); delay.connect(feedback); feedback.connect(delay);
    delay.connect(delayWet); delayWet.connect(effectBus);
    effectBus.connect(reverbDry); reverbDry.connect(postFx);
    effectBus.connect(convolver); convolver.connect(reverbWet); reverbWet.connect(postFx);

    // Mid/side matrix: a real stereo-width control for the single stereo file.
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const midLeft = ctx.createGain();
    const midRight = ctx.createGain();
    const sideLL = ctx.createGain();
    const sideLR = ctx.createGain();
    const sideRL = ctx.createGain();
    const sideRR = ctx.createGain();
    midLeft.gain.value = midRight.gain.value = 0.5;
    postFx.connect(processed);
    processed.connect(splitter);
    splitter.connect(midLeft, 0); splitter.connect(midLeft, 1);
    splitter.connect(midRight, 0); splitter.connect(midRight, 1);
    midLeft.connect(merger, 0, 0); midRight.connect(merger, 0, 1);
    splitter.connect(sideLL, 0); splitter.connect(sideLR, 1);
    splitter.connect(sideRL, 0); splitter.connect(sideRR, 1);
    sideLL.connect(merger, 0, 0); sideLR.connect(merger, 0, 0);
    sideRL.connect(merger, 0, 1); sideRR.connect(merger, 0, 1);
    merger.connect(panner);
    raw.connect(panner);
    panner.connect(limiter);
    limiter.connect(master);
    if (meter) { master.connect(meter); meter.connect(destination); }
    else master.connect(destination);

    const graph = { track, raw, processed, low, mid, high, compressor, dry,
      delay, delayWet, feedback, effectBus, reverbDry, convolver, reverbWet,
      postFx, panner, limiter, master, meter, sideLL, sideLR, sideRL, sideRR };
    applyToGraph(graph, values, ctx);
    return graph;
  }

  function applyToGraph(graph, values, ctx) {
    const v = normalize(values);
    graph.track.gain.value = v.mute ? 0 : toGain(v.gainDb);
    graph.raw.gain.value = v.bypass ? 1 : 0;
    graph.processed.gain.value = v.bypass ? 0 : 1;
    graph.low.gain.value = v.low;
    graph.mid.gain.value = v.mid;
    graph.high.gain.value = v.high;
    graph.compressor.threshold.value = v.threshold;
    graph.compressor.ratio.value = v.ratio;
    graph.compressor.knee.value = v.ratio <= 1 ? 0 : 20;
    graph.dry.gain.value = 1;
    graph.delayWet.gain.value = v.delay;
    graph.reverbDry.gain.value = 1;
    graph.reverbWet.gain.value = v.reverb;
    graph.panner.pan.value = v.pan;
    graph.master.gain.value = toGain(v.masterDb);
    // Compensate the width matrix so unity width is transparent.
    graph.sideLL.gain.value = 0.5 * v.width;
    graph.sideLR.gain.value = -0.5 * v.width;
    graph.sideRL.gain.value = -0.5 * v.width;
    graph.sideRR.gain.value = 0.5 * v.width;
    if (ctx && graph.meter) graph.meter.fftSize = 2048;
  }

  function connect() {
    if (nodes) return true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const element = document.getElementById("audio");
    if (!AudioContextClass || !element) return false;
    try {
      context = new AudioContextClass();
      context.resume().catch(() => {});
      source = context.createMediaElementSource(element);
      nodes = buildGraph(context, source, context.destination, settings, true);
      element.addEventListener("play", () => context?.resume().catch(() => {}));
      return true;
    } catch (error) {
      context?.close().catch(() => {});
      context = null; source = null; nodes = null;
      throw error;
    }
  }

  function apply(next) {
    settings = normalize({ ...settings, ...next });
    if (nodes) applyToGraph(nodes, settings, context);
    return { ...settings };
  }

  function reset() { return apply({ ...defaults, bypass: false }); }
  function hasProcessing(input = settings) {
    const v = normalize(input);
    return v.gainDb !== 0 || v.pan !== 0 || v.low !== 0 || v.mid !== 0 || v.high !== 0 ||
      v.ratio > 1 || v.reverb > 0 || v.delay > 0 || v.width !== 1 || v.masterDb !== 0;
  }

  function drawMeter(canvas, label) {
    if (!canvas || !nodes?.meter) return () => {};
    const analyser = nodes.meter;
    const samples = new Float32Array(analyser.fftSize);
    const ctx = canvas.getContext("2d");
    let frame;
    let running = true;
    const draw = () => {
      if (!running) return;
      analyser.getFloatTimeDomainData(samples);
      let peak = 0;
      let sum = 0;
      for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; }
      const db = value => value > 0 ? 20 * Math.log10(value) : -60;
      const rmsDb = Math.max(-60, db(Math.sqrt(sum / samples.length)));
      const peakDb = Math.max(-60, db(peak));
      const ratio = (rmsDb + 60) / 60;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0b1423"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = peakDb > -1 ? "#ef6262" : peakDb > -9 ? "#e6b84d" : "#52d9d0";
      ctx.fillRect(0, 0, Math.max(2, canvas.width * ratio), canvas.height);
      if (label) label.textContent = `${peakDb.toFixed(1)} dBFS peak · ${rmsDb.toFixed(1)} dBFS RMS`;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; cancelAnimationFrame(frame); };
  }

  async function renderOffline(audioBuffer, inputSettings = settings) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error("הדפדפן אינו תומך בייצוא Mix מעובד.");
    if (audioBuffer.duration > 600) throw new Error("ייצוא Mix מעובד מוגבל ל־10 דקות כדי למנוע מחסור בזיכרון.");
    const output = new Offline(Math.max(2, audioBuffer.numberOfChannels), audioBuffer.length + Math.ceil(audioBuffer.sampleRate * 1.3), audioBuffer.sampleRate);
    const sourceNode = output.createBufferSource();
    sourceNode.buffer = audioBuffer;
    const exportSettings = normalize({ ...inputSettings, bypass: false, mute: false });
    buildGraph(output, sourceNode, output.destination, exportSettings, false);
    sourceNode.start(0);
    return output.startRendering();
  }

  window.ITZIK_MIXER = {
    defaults: { ...defaults }, normalize, connect, apply, reset,
    getSettings: () => ({ ...settings }), drawMeter, renderOffline, hasProcessing,
    isConnected: () => Boolean(nodes)
  };
})();
