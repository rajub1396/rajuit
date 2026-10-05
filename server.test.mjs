import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
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
  assert.match(await page.text(), /href="\/download\/RYT-universal.apk"/);
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
