import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const apk = resolve(root, 'downloads/RYT-universal.apk');
const apkSize = statSync(apk).size;
const routes = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['public/index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']],
  ['/download/RYT-universal.apk', ['downloads/RYT-universal.apk', 'application/vnd.android.package-archive']]
]);

export function createApp() {
  return createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Method not allowed');
    }
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { res.writeHead(400); return res.end('Bad request'); }
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}');
    }
    const route = routes.get(pathname);
    if (!route) { res.writeHead(404); return res.end('Not found'); }
    const [relative, contentType] = route;
    const filename = resolve(root, relative);
    const isApk = filename === apk;
    const size = isApk ? apkSize : statSync(filename).size;
    let start = 0, end = size - 1, status = 200;
    const headers = { 'Content-Type': contentType, 'Cache-Control': 'no-cache' };
    if (isApk) {
      headers['Content-Disposition'] = 'attachment; filename="RYT-universal.apk"';
      headers['Accept-Ranges'] = 'bytes';
      // HTTP Range lets browsers resume interrupted APK downloads.
      if (req.headers.range && req.method === 'GET') {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (match && (match[1] || match[2])) {
          if (!match[1]) start = Math.max(0, size - Number(match[2]));
          else { start = Number(match[1]); end = match[2] ? Math.min(size - 1, Number(match[2])) : size - 1; }
        } else start = size;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` });
          return res.end();
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      }
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(filename, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createApp();
  server.listen(port, '0.0.0.0', () => console.log(`RYT website listening on port ${port}`));
  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
}
