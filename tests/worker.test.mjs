import test from 'node:test';
import assert from 'node:assert/strict';

test('session lifecycle: start, update, worker wake, capture loss, rejection and stop', async () => {
  const storage = {};
  const notifications = [];
  let onMessage, onRemoved, hosted = false, active = null, failCapture = false;
  const chrome = {
    runtime: {
      id: 'drift', getURL: path => `chrome-extension://drift/${path}`,
      getContexts: async () => hosted ? [{}] : [],
      onMessage: { addListener: fn => onMessage = fn },
      sendMessage: async message => {
        if (message.command === 'start') active = { tabId: message.tabId, settings: message.settings };
        if (message.command === 'stop') active = null;
        if (message.command === 'update') active = { ...active, settings: message.settings };
        return { ok: true, session: active };
      }
    },
    offscreen: { createDocument: async () => { hosted = true; } },
    tabCapture: { getMediaStreamId: async () => { if (failCapture) throw new Error('Capture denied'); return 'stream-id'; } },
    tabs: {
      get: async id => ({ id, url: id === 99 ? 'chrome://extensions' : 'https://example.test/music' }),
      sendMessage: async (id, message) => notifications.push({ id, ...message }),
      onRemoved: { addListener: fn => onRemoved = fn }
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    storage: { session: {
      get: async () => ({ ...storage }),
      set: async value => Object.assign(storage, value),
      remove: async key => { delete storage[key]; }
    } }
  };
  globalThis.chrome = chrome;
  await import('../extension/worker.js?test=first');
  const panel = { id: 'drift', url: 'chrome-extension://drift/panel.html' };
  const call = (command, extra = {}, sender = panel) => new Promise(resolve => onMessage({ target: 'worker', command, ...extra }, sender, resolve));
  assert.equal((await call('status')).session, null);
  const started = await call('start', { tabId: 4, settings: { speed: 0.8, reverb: 0.3 } });
  assert.equal(started.session.tabId, 4); assert.equal(storage.activeSession.settings.speed, 0.8);
  assert.equal(notifications.at(-1).settings.speed, 0.8);
  assert.equal((await call('media-ready', {}, { id: 'drift', tab: { id: 4 } })).settings.speed, 0.8);
  assert.equal((await call('media-ready', {}, { id: 'drift', tab: { id: 5 } })).settings, null);
  assert.equal((await call('stop', {}, { id: 'drift', tab: { id: 4 } })).ok, false);
  const updated = await call('update', { settings: { speed: 1.5, pitch: -7 } });
  assert.equal(updated.session.settings.pitch, -7);
  await import('../extension/worker.js?test=restart');
  assert.equal((await call('status')).session.settings.speed, 1.5);
  active = null;
  assert.equal((await call('status')).session, null);
  assert.equal(storage.activeSession, undefined); assert.equal(notifications.at(-1).settings, null);
  failCapture = true;
  assert.equal((await call('start', { tabId: 4 })).ok, false);
  assert.equal(storage.activeSession, undefined);
  failCapture = false;
  assert.equal((await call('start', { tabId: 99 })).ok, false);
  await call('start', { tabId: 4 });
  await call('stop'); assert.equal(active, null); assert.equal(notifications.at(-1).settings, null);
  await call('start', { tabId: 4 });
  onRemoved(4);
  await call('status'); assert.equal(active, null);
  delete globalThis.chrome;
});
