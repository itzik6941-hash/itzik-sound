const { test } = require("node:test");
const assert = require("node:assert/strict");
const { encode } = require("../public/wav-encoder");

function fakeBuffer(channels, sampleRate = 48000) {
  const data = channels.map(values => Float32Array.from(values));
  return {
    numberOfChannels: data.length,
    length: data[0].length,
    sampleRate,
    getChannelData(index) { return data[index]; }
  };
}

async function header(blob) {
  const bytes = await blob.arrayBuffer();
  const view = new DataView(bytes);
  return {
    bytes,
    view,
    format: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bits: view.getUint16(34, true),
    dataSize: view.getUint32(40, true)
  };
}

test("WAV encoder writes valid 16-bit PCM headers and interleaved stereo samples", async () => {
  const result = await header(encode(fakeBuffer([[0, -1], [1, 0.5]]), 16));
  assert.equal(result.format, 1);
  assert.equal(result.channels, 2);
  assert.equal(result.sampleRate, 48000);
  assert.equal(result.bits, 16);
  assert.equal(result.dataSize, 8);
  assert.equal(result.view.getInt16(44, true), 0);
  assert.equal(result.view.getInt16(46, true), 32767);
  assert.equal(result.view.getInt16(48, true), -32768);
  assert.equal(result.view.getInt16(50, true), 16384);
});

test("WAV encoder writes 24-bit PCM without losing the extra byte per sample", async () => {
  const result = await header(encode(fakeBuffer([[-1, 0, 1]]), 24));
  assert.equal(result.format, 1);
  assert.equal(result.channels, 1);
  assert.equal(result.bits, 24);
  assert.equal(result.dataSize, 9);
  assert.deepEqual([...new Uint8Array(result.bytes).slice(44, 47)], [0, 0, 128]);
  assert.deepEqual([...new Uint8Array(result.bytes).slice(50, 53)], [255, 255, 127]);
});

test("WAV encoder writes 32-bit IEEE float and preserves headroom above full scale", async () => {
  const result = await header(encode(fakeBuffer([[1.25, -1.5]]), 32));
  assert.equal(result.format, 3);
  assert.equal(result.bits, 32);
  assert.equal(result.dataSize, 8);
  assert.equal(result.view.getFloat32(44, true), 1.25);
  assert.equal(result.view.getFloat32(48, true), -1.5);
});

test("WAV encoder rejects unsupported bit depths, invalid buffers and oversized exports", () => {
  assert.throws(() => encode(fakeBuffer([[0]]), 20), /16, 24 או 32/);
  assert.throws(() => encode(null, 24), /AudioBuffer/);
  const huge = { numberOfChannels: 2, length: 200_000_000, sampleRate: 48000, getChannelData(){ return new Float32Array(1); } };
  assert.throws(() => encode(huge, 24), /גדול מדי/);
});
