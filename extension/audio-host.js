import { createEffects } from './audio.js';
import { normalize } from './settings.js';
let session;
let context;
let stream;
let effects;

async function stop() {
  session = undefined;
  effects?.dispose(); effects = undefined;
  stream?.getTracks().forEach(track => { track.onended = null; track.stop(); }); stream = undefined;
  if (context && context.state !== 'closed') await context.close();
  context = undefined;
}
async function handle(message) {
  if (message.command === 'status') return { session: session ?? null };
  if (message.command === 'stop') { await stop(); return {}; }
  if (message.command === 'update') {
    if (!session) throw new Error('Audio capture has ended. Start again on the media tab.');
    session.settings = normalize(message.settings);
    effects.update(session.settings);
    return { session };
  }
  if (message.command !== 'start') throw new Error('Unknown audio command.');
  await stop();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: {
      chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId
    } }, video: false });
    context = new AudioContext({ latencyHint: 'playback' });
    effects = await createEffects(context, context.createMediaStreamSource(stream), message.settings, chrome.runtime.getURL('vendor/soundtouch-processor.js'));
    effects.output.connect(context.destination);
    await context.resume();
    if (context.state !== 'running') throw new Error('Chrome suspended the audio engine. Start again from the extension button.');
    session = { tabId: message.tabId, settings: normalize(message.settings) };
    for (const track of stream.getTracks()) track.onended = () => {
      void stop().then(() => chrome.runtime.sendMessage({ target: 'worker', command: 'ended' })).catch(console.error);
    };
    return { session };
  } catch (error) { await stop(); throw error; }
}
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.target !== 'audio-host' || sender.id !== chrome.runtime.id) return;
  queue = queue.then(() => handle(message));
  queue.then(value => reply({ ok: true, ...value }), error => reply({ ok: false, error: error.message }));
  queue = queue.catch(() => {});
  return true;
});
