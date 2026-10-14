// Development-only server with a repository prefix, matching GitHub Pages.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/repository-name/')) { res.writeHead(404).end(); return; }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname.slice('/repository-name'.length)) + (url.pathname.endsWith('/') ? 'index.html' : ''));
    if (!path.startsWith(root + sep) || /(?:^|[/\\])\./.test(path.slice(root.length))) { res.writeHead(403).end(); return; }
    const contents = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(contents);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173/repository-name/'));
