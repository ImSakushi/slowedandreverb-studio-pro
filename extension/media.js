(() => {
  let settings = null;
  const originals = new Map();
  const roots = new Set();
  let scanTimer;
  function apply(media) {
    if (!settings) return;
    if (!originals.has(media)) originals.set(media, { speed: media.playbackRate, pitch: media.preservesPitch });
    if (media.preservesPitch !== settings.preservePitch) media.preservesPitch = settings.preservePitch;
    if (Math.abs(media.playbackRate - settings.speed) > 0.001) media.playbackRate = settings.speed;
  }
  function enforce(event) { if (event.target instanceof HTMLMediaElement) apply(event.target); }
  const observer = new MutationObserver(() => {
    if (settings && !scanTimer) scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 80);
  });
  function visit(root) {
    if (!roots.has(root)) {
      roots.add(root); observer.observe(root, { childList: true, subtree: true });
      root.addEventListener('play', enforce, true);
      root.addEventListener('ratechange', enforce, true);
    }
    for (const media of root.querySelectorAll('audio,video')) apply(media);
    for (const element of root.querySelectorAll('*')) if (element.shadowRoot) visit(element.shadowRoot);
  }
  function scan() {
    for (const [media, original] of originals) if (!media.isConnected) {
      media.playbackRate = original.speed; media.preservesPitch = original.pitch; originals.delete(media);
    }
    visit(document);
  }
  function update(next) {
    settings = next;
    if (next) { scan(); return; }
    clearTimeout(scanTimer); scanTimer = null; observer.disconnect();
    for (const root of roots) { root.removeEventListener('play', enforce, true); root.removeEventListener('ratechange', enforce, true); }
    roots.clear();
    for (const [media, original] of originals) { media.playbackRate = original.speed; media.preservesPitch = original.pitch; }
    originals.clear();
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.target !== 'media') return;
    update(message.settings); reply({ ok: true });
  });
  async function synchronize() {
    try {
      const result = await chrome.runtime.sendMessage({ target: 'worker', command: 'media-ready' });
      if (result?.ok) update(result.settings);
    } catch { update(null); }
  }
  window.addEventListener('pageshow', synchronize);
  void synchronize();
})();
