import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalize } from '../extension/settings.js';
import { makeImpulse } from '../extension/audio.js';
test('invalid saved settings cannot reach the audio engine', () => {
  assert.deepEqual(normalize(null), DEFAULTS);
  assert.equal(normalize({ speed: Infinity }).speed, DEFAULTS.speed);
  assert.equal(normalize({ speed: -5, reverb: 3, pitch: NaN, preservePitch: 'false' }).speed, 0.25);
  assert.equal(normalize({ reverb: 3 }).reverb, 1);
  assert.equal(normalize({ speed: 1.37, pitch: -4.2, preservePitch: true }).pitch, -4.2);
});
test('generated reverb is finite, reproducible, stereo and decays', () => {
  const context = { sampleRate: 48000, createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, getChannelData: i => data[i] };
  } };
  const a = makeImpulse(context, 2.8), b = makeImpulse(context, 2.8);
  assert.equal(a.length, 134400);
  assert.deepEqual(a.getChannelData(0), b.getChannelData(0));
  assert.notDeepEqual(a.getChannelData(0), a.getChannelData(1));
  const data = a.getChannelData(0);
  assert.ok(data.every(Number.isFinite));
  const energy = samples => samples.reduce((sum, value) => sum + value * value, 0);
  assert.ok(energy(data.slice(0, 48000)) > energy(data.slice(-48000)) * 100);
});
