// UI fixture only, outside the installable extension directory.
(() => {
  let session = null;
  const store = JSON.parse(localStorage.getItem('drift-test-store') || '{}');
  window.chrome = {
    tabs: { query: async () => [{ id: 10 }] },
    storage: { local: { get: async () => store, set: async value => { Object.assign(store, value); localStorage.setItem('drift-test-store', JSON.stringify(store)); } } },
    runtime: { sendMessage: async message => {
      if (message.command === 'start') session = { tabId: message.tabId, settings: message.settings };
      if (message.command === 'stop') session = null;
      if (message.command === 'update' && session) session.settings = message.settings;
      return { ok: true, session };
    } }
  };
})();
