import { normalize } from './settings.js';

// Deterministic stereo noise with an exponential tail. No sampled recordings.
export function makeImpulse(context, seconds) {
  const length = Math.ceil(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let seed = 15485863 + channel * 32452843;
    let filtered = 0;
    for (let i = 0; i < length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const noise = (seed >>> 0) / 2147483648 - 1;
      filtered += 0.55 * (noise - filtered);
      const attack = Math.min(1, i / (context.sampleRate * 0.012));
      data[i] = filtered * attack * Math.exp(-6.91 * i / length);
    }
  }
  return buffer;
}

export async function createEffects(context, input, initial, processorUrl = './vendor/soundtouch-processor.js') {
  await context.audioWorklet.addModule(processorUrl);
  const shifter = new AudioWorkletNode(context, 'soundtouch-processor', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { sampleBufferType: 'circular', interpolationStrategy: 'lanczos' }
  });
  const direct = context.createGain();
  const shifted = context.createGain();
  const bass = context.createBiquadFilter();
  bass.type = 'lowshelf'; bass.frequency.value = 180;
  const dry = context.createGain();
  const wet = context.createGain();
  const output = context.createGain();
  // Transparent below 0.9, smoothly rounded near full scale. Unlike Chrome's
  // compressor this does not apply automatic makeup gain to the dry signal.
  const limiter = context.createWaveShaper();
  const curve = new Float32Array(65537);
  for (let i = 0; i < curve.length; i++) {
    const x = 2 * i / (curve.length - 1) - 1;
    const t = (Math.abs(x) - 0.9) / 0.1;
    curve[i] = Math.abs(x) <= 0.9 ? x : Math.sign(x) * (0.9 + 0.1 * (t - t * t / 2));
  }
  limiter.curve = curve;
  input.connect(direct).connect(bass);
  input.connect(shifter).connect(shifted).connect(bass);
  bass.connect(dry).connect(output);
  wet.connect(output);
  output.connect(limiter);
  let tail;
  let previousDecay;
  let initialized = false;
  let disposed = false;
  const retired = new Set();
  function set(param, value) {
    param.cancelScheduledValues(context.currentTime);
    if (!initialized) param.setValueAtTime(value, context.currentTime);
    else param.setTargetAtTime(value, context.currentTime, 0.02);
  }
  function update(value) {
    const s = normalize(value);
    set(shifter.parameters.get('pitch'), 2 ** (s.pitch / 12));
    // The media element already controls speed and native pitch preservation.
    // Only an additional, duration-neutral pitch shift is applied here.
    set(shifter.parameters.get('playbackRate'), 1);
    set(direct.gain, s.pitch === 0 ? 1 : 0);
    set(shifted.gain, s.pitch === 0 ? 0 : 1);
    set(bass.gain, s.bass);
    set(dry.gain, Math.cos(s.reverb * Math.PI / 2));
    set(wet.gain, Math.sin(s.reverb * Math.PI / 2) * 0.75);
    set(output.gain, s.volume);
    if (s.decay !== previousDecay) {
      const convolution = context.createConvolver();
      convolution.buffer = makeImpulse(context, s.decay);
      const fade = context.createGain();
      fade.gain.value = initialized ? 0 : 1;
      bass.connect(convolution).connect(fade).connect(wet);
      set(fade.gain, 1);
      if (tail) {
        const old = tail;
        set(old.fade.gain, 0);
        const timer = setTimeout(() => {
          if (!disposed) { bass.disconnect(old.convolution); old.convolution.disconnect(); old.fade.disconnect(); }
          retired.delete(timer);
        }, 250);
        retired.add(timer);
      }
      tail = { convolution, fade };
      previousDecay = s.decay;
    }
    initialized = true;
  }
  update(initial);
  return { output: limiter, update, dispose() {
    disposed = true;
    for (const timer of retired) clearTimeout(timer);
    input.disconnect(); shifter.port.close();
    for (const node of [shifter, direct, shifted, bass, dry, wet, output, limiter, tail?.convolution, tail?.fade]) node?.disconnect();
  } };
}
