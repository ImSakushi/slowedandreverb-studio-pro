import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const code = await readFile(new URL('../extension/media.js', import.meta.url), 'utf8');
test('media speed, pitch locking, dynamic players and restoration', async () => {
  class Media { playbackRate = 1.25; preservesPitch = true; isConnected = true; }
  const first = new Media();
  const media = [first];
  const listeners = new Map();
  let onMessage, mutation;
  const document = { querySelectorAll: selector => selector === 'audio,video' ? media : [], addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
  const sandbox = { HTMLMediaElement: Media, document, window: { addEventListener() {} }, setTimeout: fn => { fn(); return 1; }, clearTimeout() {}, MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() {} }, chrome: { runtime: { id: 'test', onMessage: { addListener: fn => onMessage = fn }, sendMessage: async () => ({ ok: true, settings: null }) } } };
  vm.runInNewContext(code, sandbox);
  await new Promise(resolve => setImmediate(resolve));
  const update = settings => onMessage({ target: 'media', settings }, { id: 'test' }, () => {});
  update({ speed: 0.85, preservePitch: false });
  assert.equal(first.playbackRate, 0.85); assert.equal(first.preservesPitch, false);
  first.playbackRate = 1; listeners.get('ratechange')({ target: first }); assert.equal(first.playbackRate, 0.85);
  const second = new Media(); media.push(second); mutation(); assert.equal(second.playbackRate, 0.85);
  update({ speed: 0.25, preservePitch: true }); assert.equal(first.playbackRate, 0.25); assert.equal(first.preservesPitch, true);
  update(null);
  for (const item of media) { assert.equal(item.playbackRate, 1.25); assert.equal(item.preservesPitch, true); }
  assert.equal(listeners.size, 0);
  onMessage({ target: 'media', settings: { speed: 2 } }, { id: 'foreign' }, () => {});
  assert.equal(first.playbackRate, 1.25);
});
