import { DEFAULTS, normalize } from './settings.js';
async function hasHost() {
  return (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL('audio-host.html')] })).length > 0;
}
async function audio(command, extra = {}) {
  const result = await chrome.runtime.sendMessage({ target: 'audio-host', command, ...extra });
  if (!result?.ok) throw new Error(result?.error || 'The audio engine did not respond.');
  return result;
}
async function tellMedia(tabId, settings) {
  try { await chrome.tabs.sendMessage(tabId, { target: 'media', settings }); } catch { /* Page may have navigated or closed. */ }
}
async function clearSession() {
  const { activeSession } = await chrome.storage.session.get('activeSession');
  await chrome.storage.session.remove('activeSession');
  if (activeSession) await tellMedia(activeSession.tabId, null);
  await chrome.action.setBadgeText({ text: '' });
}
async function status() {
  const current = await hasHost() ? (await audio('status')).session : null;
  if (!current) await clearSession();
  return current;
}
async function stop() {
  if (await hasHost()) await audio('stop');
  await clearSession();
}
async function handle(message, sender) {
  if (message.command === 'media-ready') {
    const { activeSession } = await chrome.storage.session.get('activeSession');
    return { settings: activeSession?.tabId === sender.tab?.id ? activeSession.settings : null };
  }
  // Content scripts can only request their own media settings.
  if (sender.tab || !sender.url?.startsWith(chrome.runtime.getURL(''))) throw new Error('Extension page required.');
  if (message.command === 'status') return { session: await status() };
  if (message.command === 'ended') { await clearSession(); return {}; }
  if (message.command === 'stop') { await stop(); return { session: null }; }
  if (message.command === 'start') {
    const tab = await chrome.tabs.get(message.tabId);
    if (!/^https?:\/\//.test(tab.url || '')) throw new Error('Open a regular website with audio, then start Drift Audio there.');
    await stop();
    const settings = normalize(message.settings || DEFAULTS);
    try {
      if (!await hasHost()) await chrome.offscreen.createDocument({ url: 'audio-host.html', reasons: ['USER_MEDIA'], justification: 'Process the tab audio selected by the user.' });
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      const result = await audio('start', { streamId, tabId: tab.id, settings });
      await chrome.storage.session.set({ activeSession: result.session });
      await tellMedia(tab.id, settings);
      await chrome.action.setBadgeBackgroundColor({ color: '#22766c' });
      await chrome.action.setBadgeText({ text: 'ON' });
      return result;
    } catch (error) { await stop(); throw error; }
  }
  if (message.command === 'update') {
    const current = await status();
    if (!current) throw new Error('Start audio processing first.');
    const settings = normalize(message.settings);
    const result = await audio('update', { settings });
    await chrome.storage.session.set({ activeSession: result.session });
    await tellMedia(current.tabId, settings);
    return result;
  }
  throw new Error('Unknown command.');
}
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.target !== 'worker' || sender.id !== chrome.runtime.id) return;
  queue = queue.then(() => handle(message, sender));
  queue.then(value => reply({ ok: true, ...value }), error => reply({ ok: false, error: error.message }));
  queue = queue.catch(() => {});
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  queue = queue.then(async () => {
    const { activeSession } = await chrome.storage.session.get('activeSession');
    if (activeSession?.tabId === tabId) await stop();
  }).catch(console.error);
});
