import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { apps, renderApp, renderHome } from './apps.mjs';

test('inline ad closes and reappears after six seconds without opening tabs', () => {
 for(const page of [renderHome(), ...apps.map(app => renderApp(app))]) {
  assert.doesNotMatch(page, /window\.open|setInterval|accountut\.com|bellnewyork\.org\/14\//);
  assert.match(page, /class="ad-slot wrap inline-ad"/);
  assert.doesNotMatch(page, /smartlink-banner|View sponsored offer|auctionr\.org/);
  assert.equal((page.match(/id="ad-slot-banner"/g) || []).length, 1);
  assert.match(page, /bellnewyork\.org\/22\/b5674928314795863ff1c9be73ca0078/);
  assert.equal((page.match(/id="container-d5b768305612c010e2c2ecf25d4d053a"/g) || []).length, 1);
  const script=page.match(/<script>\s*\/\/ Inline ad box:[\s\S]*?<\/script>/)[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
  const box={hidden:false}, listeners={}; let close, timer, cleared=0;
  runInNewContext(script, {document:{querySelector: selector=>selector==='#ad-slot-1'?box:{addEventListener:(_,callback)=>close=callback}},window:{
   addEventListener:(name,callback)=>listeners[name]=callback,
   setTimeout(callback,delay){assert.equal(delay,6000);timer=callback;return 1;},
   clearTimeout(){cleared++;timer=undefined;}
  }});
  close();assert.equal(box.hidden,true);assert.ok(timer);
  timer();assert.equal(box.hidden,false);
  close();listeners['show-inline-ad']();assert.equal(box.hidden,false);assert.equal(timer,undefined);
  close();listeners.pagehide();assert.equal(timer,undefined);assert.ok(cleared);
  listeners.pageshow({persisted:true});assert.equal(box.hidden,false);
 }
});

test('every available app shows an inline ad first and downloads its own APK second', t => {
  const directory = mkdtempSync(join(tmpdir(), 'r-app-click-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const app of apps) {
    writeFileSync(join(directory, app.file), 'APK test fixture');
    const page = renderApp(app, directory);
    assert.match(page, /data-available="true"/);
    const href = page.match(/id="download"[^>]*href="([^"]+)"/)[1];
    assert.equal(href, `/download/${app.file}`);
    const script = page.match(/<script>\s*\/\/ Additional[\s\S]*?<\/script>/)[0]
      .replace(/^<script>/, '').replace(/<\/script>$/, '');
    assert.ok(page.indexOf('// Additional') < page.indexOf('src="https://'));
    for (const blocked of [false, true]) {
      let capture, ads = 0;
      const downloads = [];
      const download = { href, dataset: { available: 'true' } };
      const hint = {};
      runInNewContext(script, {
        Event: class { constructor(type) { this.type = type; } },
        document: {
          querySelector: selector => selector === '#download' ? download : hint,
          addEventListener() {}
        },
        window: {
          addEventListener: (_, listener) => capture = listener,
          dispatchEvent(event) { assert.equal(event.type, 'show-inline-ad'); ads++; },
          location: { assign: url => downloads.push(url) }
        },
        sessionStorage: { getItem: () => null },
      });
      const click = () => ({
        button: 0, target: { closest: () => download },
        prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; },
        stopPropagation() { this.stopped = true; }
      });
      const first = click(); capture(first);
      assert.equal(first.prevented, true);
      assert.equal(first.stopped, true);
      assert.equal(ads, 1);
      assert.deepEqual(downloads, []);
      assert.match(download.innerHTML, /Click again/);
      const second = click(); capture(second);
      assert.equal(second.prevented, true);
      assert.equal(second.stopped, true);
      assert.deepEqual(downloads, [`/download/${app.file}`]);
      assert.equal(ads, 1);
      const third = click(); capture(third);
      assert.equal(third.prevented, true);
      assert.equal(downloads.length, 2);
      assert.equal(ads, 1);
    }
  }
});

test('unavailable APK buttons show a message without opening ads or downloading', () => {
  for (const app of apps.slice(1)) {
    const page = renderApp(app);
    const script = page.match(/<script>\s*\/\/ Additional[\s\S]*?<\/script>/)[0]
      .replace(/^<script>/, '').replace(/<\/script>$/, '');
    let capture;
    const hint = {};
    const download = { dataset: { available: 'false' } };
    runInNewContext(script, {
      document: { querySelector: selector => selector === '#download' ? download : hint, addEventListener() {} },
      window: {
        addEventListener: (_, listener) => capture = listener,
        dispatchEvent() { assert.fail('An unavailable APK must not show an ad'); },
        location: { assign() { assert.fail('An unavailable APK must not start a download'); } }
      },
      sessionStorage: { getItem: () => null }
    });
    capture({ button: 0, target: { closest: () => download }, preventDefault() {}, stopImmediatePropagation() {} });
    assert.match(hint.textContent, /coming soon/);
  }
});
