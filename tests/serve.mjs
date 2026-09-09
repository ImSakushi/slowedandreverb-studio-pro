import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Serve only new extension files and test fixtures; never historical material.
    if (!/^\/(extension|tests)\//.test(requested)) throw new Error('Not found');
    const preview = requested === '/tests/panel-preview.html';
    const file = path.resolve(root, `.${preview ? '/extension/panel.html' : requested}`);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    let body = await readFile(file);
    if (preview) body = Buffer.from(body.toString().replace('<head>', '<head><base href="/extension/"><script src="/tests/panel-mock.js"></script>'));
    res.setHeader('Content-Type', mime[path.extname(file)] || 'text/plain');
    res.setHeader('Cache-Control', 'no-store'); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(8765, '127.0.0.1', () => console.log('Verification at http://localhost:8765/tests/browser.html'));
