import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createApp } from './server.mjs';

test('serves the website and an exact, resumable APK without exposing source files', async (t) => {
  const server = createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const expected = readFileSync(new URL('downloads/RYT-universal.apk', import.meta.url));
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  const homepage = await page.text();
  for (const slug of ['ryt', 'rvpn', 'rplayer', 'rtik', 'rins']) {
    assert.match(homepage, new RegExp(`href="/apps/${slug}"`));
    const appPage = await fetch(origin + '/apps/' + slug);
    assert.equal(appPage.status, 200);
    const html = await appPage.text();
    assert.match(html, /id="download"/);
    assert.match(html, /href="\/styles.css"/);
    assert.doesNotMatch(html, /\{\{\w+\}\}/);
    assert.match(html, new RegExp(`data-available="${slug === 'ryt' || slug === 'rvpn'}"`));
  }
  assert.match(await (await fetch(origin + '/apps/ryt')).text(), /href="\/download\/RYT-universal.apk"/);
  assert.equal((await fetch(origin + '/apps/unknown')).status, 404);
  const vpnExpected = readFileSync(new URL('downloads/RVpn.apk', import.meta.url));
  const vpnPage = await (await fetch(origin + '/apps/rvpn')).text();
  assert.match(vpnPage, /href="\/download\/RVpn.apk"/);
  const vpnDownload = await fetch(origin + '/download/RVpn.apk');
  assert.equal(vpnDownload.status, 200);
  assert.deepEqual(Buffer.from(await vpnDownload.arrayBuffer()), vpnExpected);
  assert.equal((await fetch(origin + '/download/RPlayer.apk')).status, 404);
  assert.equal((await fetch(origin + '/styles.css')).status, 200);
  assert.deepEqual(await (await fetch(origin + '/healthz')).json(), { status: 'ok' });
  assert.equal((await fetch(origin + '/server.mjs')).status, 404);
  assert.equal((await fetch(origin + '/downloads/RYT-universal.apk')).status, 404);
  const head = await fetch(origin + '/download/RYT-universal.apk', { method: 'HEAD' });
  assert.equal(Number(head.headers.get('content-length')), expected.length);
  assert.match(head.headers.get('content-disposition'), /attachment/);
  const full = await fetch(origin + '/download/RYT-universal.apk');
  const digest = data => createHash('sha256').update(data).digest('hex');
  assert.equal(digest(Buffer.from(await full.arrayBuffer())), digest(expected));
  for (const range of ['bytes=0-1023', 'bytes=-1024', `bytes=${expected.length - 1024}-`]) {
    const partial = await fetch(origin + '/download/RYT-universal.apk', { headers: { Range: range } });
    assert.equal(partial.status, 206);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), range === 'bytes=0-1023' ? expected.subarray(0, 1024) : expected.subarray(-1024));
  }
  for (const range of ['bytes=999999999-', 'bytes=-0', 'bytes=10-1', 'bytes=0-10,20-30']) {
    assert.equal((await fetch(origin + '/download/RYT-universal.apk', { headers: { Range: range } })).status, 416);
  }
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
});

test('adding an APK enables its page and exact resumable download without source changes', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'r-apps-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const server = createApp({ downloadsDirectory: directory });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [slug, file] of [['rvpn', 'RVpn.apk'], ['rplayer', 'RPlayer.apk'], ['rtik', 'RTik.apk'], ['rins', 'RIns.apk']]) {
    assert.match(await (await fetch(origin + '/apps/' + slug)).text(), /data-available="false"/);
    const bytes = Buffer.from('APK test fixture for ' + slug);
    writeFileSync(join(directory, file), bytes);
    const html = await (await fetch(origin + '/apps/' + slug)).text();
    assert.match(html, /data-available="true"/);
    assert.ok(html.includes(`href="/download/${file}"`));
    const response = await fetch(origin + '/download/' + file);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-disposition'), `attachment; filename="${file}"`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const partial = await fetch(origin + '/download/' + file, { headers: { Range: 'bytes=0-3' } });
    assert.equal(partial.status, 206);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(0, 4));
  }
});
