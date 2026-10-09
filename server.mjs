import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { apps, apkPath, apkSize, renderHome, renderApp } from './apps.mjs';
import { robots, sitemap, searchMetadata } from './seo.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const routes = new Map([
  ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']],
]);

export function createApp({ downloadsDirectory } = {}) {
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
    if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
      const body = pathname === '/robots.txt' ? robots : sitemap;
      res.writeHead(200, {
        'Content-Type': pathname === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'public, max-age=300',
      });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}');
    }
    const legacyApp = apps.find(item => pathname === `/apps/${item.slug}` || pathname === `/apps/${item.slug}/` || pathname === `/${item.slug}-download/`);
    if (legacyApp) {
      res.writeHead(301, { Location: `/${legacyApp.slug}-download` });
      return res.end();
    }
    const app = apps.find(item => pathname === `/${item.slug}-download`);
    if (pathname === '/' || pathname === '/index.html' || app) {
      const html = searchMetadata(app ? renderApp(app, downloadsDirectory) : renderHome(downloadsDirectory), app);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Length': Buffer.byteLength(html) });
      return res.end(req.method === 'HEAD' ? undefined : html);
    }
    const downloadApp = apps.find(item => pathname === `/download/${item.file}`);
    const downloadSize = downloadApp ? apkSize(downloadApp, downloadsDirectory) : null;
    if (downloadApp && downloadSize === null) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(req.method === 'HEAD' ? undefined : `${downloadApp.name} APK is coming soon.`);
    }
    const route = downloadApp ? [null, 'application/vnd.android.package-archive'] : routes.get(pathname);
    if (!route) { res.writeHead(404); return res.end('Not found'); }
    const [relative, contentType] = route;
    const filename = downloadApp ? apkPath(downloadApp, downloadsDirectory) : resolve(root, relative);
    const isApk = Boolean(downloadApp);
    const size = isApk ? downloadSize : statSync(filename).size;
    let start = 0, end = size - 1, status = 200;
    const headers = { 'Content-Type': contentType, 'Cache-Control': 'no-cache' };
    if (isApk) {
      headers['Content-Disposition'] = `attachment; filename="${downloadApp.file}"`;
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
