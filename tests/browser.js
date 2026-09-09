import { createEffects } from '../extension/audio.js';
import { DEFAULTS } from '../extension/settings.js';
const results = document.getElementById('results');
function assert(condition, message) { if (!condition) throw new Error(message); }
const rms = data => Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
function frequency(data, rate) {
  let crossings = 0;
  for (let i = 1; i < data.length; i++) if (data[i - 1] <= 0 && data[i] > 0) crossings++;
  return crossings * rate / data.length;
}
async function render(settings, { frequency: hz = 440, burst = false, sampleRate = 48000 } = {}) {
  const ctx = new OfflineAudioContext(2, sampleRate * 3, sampleRate);
  const source = ctx.createBufferSource();
  const buffer = ctx.createBuffer(2, sampleRate * 3, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = burst && i > sampleRate * 0.15 ? 0 : Math.sin(2 * Math.PI * hz * i / sampleRate) * 0.08;
  }
  source.buffer = buffer;
  const graph = await createEffects(ctx, source, { ...DEFAULTS, speed: 1, reverb: 0, ...settings }, '/extension/vendor/soundtouch-processor.js');
  graph.output.connect(ctx.destination); source.start();
  const rendered = await ctx.startRendering();
  const data = rendered.getChannelData(0);
  assert(data.every(Number.isFinite), 'Non-finite output');
  graph.dispose();
  return data;
}
document.getElementById('run').addEventListener('click', async () => {
  const button = document.getElementById('run'); button.disabled = true; results.textContent = 'Running…\n';
  let count = 0;
  async function check(name, fn) { await fn(); count++; results.textContent += `PASS ${name}\n`; }
  try {
    for (const sampleRate of [44100, 48000]) {
      await check(`Dry signal at ${sampleRate} Hz`, async () => {
        const data = (await render({}, { sampleRate })).slice(sampleRate);
        assert(Math.abs(frequency(data, sampleRate) - 440) < 2, 'Dry pitch changed');
        assert(Math.abs(rms(data) - 0.08 / Math.sqrt(2)) < 0.002, 'Dry level changed');
      });
      for (const pitch of [-12, -5, 7, 12]) await check(`Pitch ${pitch} st at ${sampleRate} Hz, stable duration`, async () => {
        const data = await render({ pitch }, { sampleRate });
        const tail = data.slice(sampleRate, sampleRate * 3);
        const hz = frequency(tail, sampleRate), expected = 440 * 2 ** (pitch / 12);
        assert(Math.abs(hz - expected) < expected * 0.015, `Expected ${expected} Hz, got ${hz} Hz`);
        assert(rms(tail) > 0.02, 'Pitch output is silent');
        for (let i = sampleRate; i < data.length - 4096; i += 4096) assert(rms(data.slice(i, i + 4096)) > 0.015, 'Audio dropout');
      });
    }
    await check('Reverb produces a finite, decaying tail', async () => {
      const dry = await render({}, { burst: true });
      const wet = await render({ reverb: 0.65 }, { burst: true });
      assert(rms(dry.slice(24000)) < 0.00001, 'Dry audio unexpectedly has a tail');
      assert(rms(wet.slice(24000, 48000)) > 0.00001, 'Missing reverb tail');
      assert(rms(wet.slice(24000, 48000)) > rms(wet.slice(96000)), 'Tail does not decay');
    });
    await check('Bass increases low-frequency energy', async () => {
      const dry = await render({}, { frequency: 60 });
      const boosted = await render({ bass: 6 }, { frequency: 60 });
      assert(rms(boosted.slice(48000)) > rms(dry.slice(48000)) * 1.7, 'Bass shelf is ineffective');
    });
    await check('Zero output volume is silent', async () => { assert(rms(await render({ volume: 0, reverb: 0.7, pitch: 7 })) === 0, 'Mute leaked audio'); });
    results.textContent += `ALL ${count} AUDIO CHECKS PASSED\n`;
  } catch (error) { results.textContent += `FAIL ${error.stack}\n`; }
  finally { button.disabled = false; }
});
