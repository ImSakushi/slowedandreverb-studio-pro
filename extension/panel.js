import { DEFAULTS, FACTORY_PRESETS, normalize } from './settings.js';
const $ = id => document.getElementById(id);
let settings = { ...DEFAULTS };
let session = null;
let tabId;
let presets = [];
let revision = 0;
let pending;
let queue = Promise.resolve();
const keys = ['speed', 'pitch', 'reverb', 'decay', 'bass', 'volume'];
function notice(text, error = false) { $('notice').textContent = text; $('notice').classList.toggle('error', error); }
async function send(command, extra = {}) {
  const response = await chrome.runtime.sendMessage({ target: 'worker', command, ...extra });
  if (!response?.ok) throw new Error(response?.error || 'The extension did not respond. Reload the extension and try again.');
  return response;
}
function enqueue(task) {
  queue = queue.then(task).catch(error => notice(error.message, true));
  return queue;
}
function renderSession() {
  $('session-state').textContent = session ? (session.tabId === tabId ? 'Processing this tab' : 'Processing another tab') : 'Ready when you are';
  $('toggle').textContent = session ? 'Stop processing' : 'Start on this tab';
}
function render() {
  for (const key of keys) $(key).value = settings[key];
  $('speed-number').value = settings.speed.toFixed(2);
  $('pitch-number').value = settings.pitch;
  $('preservePitch').checked = settings.preservePitch;
  $('pitch-output').textContent = `${settings.pitch > 0 ? '+' : ''}${settings.pitch.toFixed(1)} st`;
  $('reverb-output').textContent = `${Math.round(settings.reverb * 100)}%`;
  $('decay-output').textContent = `${settings.decay.toFixed(1)} s`;
  $('bass-output').textContent = `+${settings.bass.toFixed(1)} dB`;
  $('volume-output').textContent = `${Math.round(settings.volume * 100)}%`;
  renderSession();
}
function changed(next) {
  settings = normalize(next); render();
  const version = ++revision;
  const snapshot = { ...settings };
  clearTimeout(pending);
  pending = setTimeout(() => enqueue(async () => {
    await chrome.storage.local.set({ lastSettings: snapshot });
    if (session) {
      const result = await send('update', { settings: snapshot });
      session = result.session;
      if (version === revision) renderSession();
    }
  }), 90);
}
function renderPresets() {
  $('saved').replaceChildren(new Option('Saved presets', ''));
  for (const preset of presets) $('saved').add(new Option(preset.name, preset.id));
  $('load').disabled = $('delete').disabled = true;
}
for (const key of keys) $(key).addEventListener('input', () => changed({ ...settings, [key]: Number($(key).value) }));
for (const key of ['speed', 'pitch']) $(`${key}-number`).addEventListener('change', () => {
  const field = $(`${key}-number`);
  if (field.value === '' || !Number.isFinite(field.valueAsNumber)) { render(); return; }
  changed({ ...settings, [key]: field.valueAsNumber });
});
$('preservePitch').addEventListener('change', () => changed({ ...settings, preservePitch: $('preservePitch').checked }));
$('toggle').addEventListener('click', () => {
  $('toggle').disabled = true;
  clearTimeout(pending);
  enqueue(async () => {
    try {
      await chrome.storage.local.set({ lastSettings: settings });
      session = (await send(session ? 'stop' : 'start', { tabId, settings })).session;
      renderSession();
      notice(session ? 'Audio stays on your device. You can close this panel.' : 'Stopped. The page’s previous playback settings are restored.');
    } finally { $('toggle').disabled = false; }
  });
});
$('defaults').addEventListener('click', () => enqueue(async () => {
  await chrome.storage.local.set({ defaults: settings }); notice('Current sound saved as the default for new sessions.');
}));
$('saved').addEventListener('change', () => { $('load').disabled = $('delete').disabled = !$('saved').value; });
$('load').addEventListener('click', () => { const preset = presets.find(p => p.id === $('saved').value); if (preset) changed(preset.settings); });
$('delete').addEventListener('click', () => {
  const id = $('saved').value;
  enqueue(async () => {
    const next = presets.filter(p => p.id !== id);
    await chrome.storage.local.set({ presets: next }); presets = next; renderPresets(); notice('Preset deleted.');
  });
});
$('save-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('preset-name').value.trim();
  if (!name) return;
  const preset = { id: crypto.randomUUID(), name, settings: { ...settings } };
  enqueue(async () => {
    if (presets.length >= 100) throw new Error('Your shelf has 100 presets. Delete one before saving another.');
    const next = [...presets, preset];
    await chrome.storage.local.set({ presets: next }); presets = next;
    renderPresets(); $('preset-name').value = ''; notice('Preset saved on this device.');
  });
});
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); tabId = tab?.id;
  const stored = await chrome.storage.local.get(['lastSettings', 'defaults', 'presets']);
  session = (await send('status')).session;
  settings = normalize(session?.settings || stored.defaults || stored.lastSettings);
  presets = Array.isArray(stored.presets) ? stored.presets.filter(p => typeof p?.name === 'string' && typeof p?.id === 'string').map(p => ({ id: p.id, name: p.name.slice(0, 48), settings: normalize(p.settings) })) : [];
  for (const preset of FACTORY_PRESETS) {
    const button = document.createElement('button'); button.textContent = preset.name;
    button.addEventListener('click', () => changed(preset.settings)); $('factory-presets').append(button);
  }
  render(); renderPresets();
  $('controls').disabled = $('toggle').disabled = $('save').disabled = $('defaults').disabled = false;
  notice('Start on a music or video tab. For pitch only, leave playback speed at 1×.');
}
init().catch(error => notice(error.message, true));
