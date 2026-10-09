import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { apps, renderApp, renderHome } from './apps.mjs';

test('inline ad closes and reappears after six seconds', () => {
 for(const page of [renderHome(), ...apps.map(app => renderApp(app))]) {
  assert.doesNotMatch(page, /setInterval/);
  assert.equal(page.split("<script data-cfasync=\"false\" src=\"https://accountut.com/1/a447b7f145cfe949d126e298b7f001e2\"></script>").length - 1, 1);
  assert.match(page, /class="ad-slot wrap inline-ad"/);
  for (const source of [
   'https://bellnewyork.org/21/d5b768305612c010e2c2ecf25d4d053a',
   'https://bellnewyork.org/22/b5674928314795863ff1c9be73ca0078',
   'https://bellnewyork.org/14/2419643dbfd45818eb2bf8d3c0adaae5'
  ]) assert.equal(page.split('src="' + source + '"').length - 1, 1);
  assert.equal(page.split('id="container-d5b768305612c010e2c2ecf25d4d053a"').length - 1, 1);
  assert.equal(page.split('id="ad-slot-banner"').length - 1, 1);
  assert.match(page, /height: 90, width: 728/);
  assert.equal((page.match(/class="smartlink-offer"/g) || []).length, 1);
  assert.match(page, /href="https:\/\/auctionr.org\/4\/07c4573883eaaad1956ac62edd3f7a40" rel="sponsored nofollow noreferrer"/);
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
    assert.ok(page.indexOf('// Additional') < page.indexOf('class="smartlink-offer"'));
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


test('Smartlink opens once per trusted control click without cancelling the control action', () => {
 for (const page of [renderHome(), ...apps.map(app => renderApp(app))]) {
  const scripts = page.match(/<script>\s*\/\/ Smartlink ads:[\s\S]*?<\/script>/g);
  assert.equal(scripts.length, 1);
  const script = scripts[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  const opened = [];
  let click;
  runInNewContext(script, { window: {
   addEventListener(type, listener, capture) { assert.equal(type, 'click'); assert.equal(capture, true); click = listener; },
   open(...args) { opened.push(args); return null; }
  }});
  const control = { getAttribute: () => null, closest: () => null };
  const event = { isTrusted: true, button: 0, target: { closest: () => control },
   preventDefault() { assert.fail('Control action must remain available'); },
   stopImmediatePropagation() { assert.fail('Other click handlers must remain available'); }
  };
  click(event); click(event);
  assert.equal(opened.length, 2);
  assert.deepEqual(opened[0], ['https://auctionr.org/4/07c4573883eaaad1956ac62edd3f7a40', '_blank', 'noopener,noreferrer']);
  for (const override of [{ isTrusted: false }, { button: 1 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { target: { closest: () => null } }]) click({ ...event, ...override });
  control.disabled = true; click(event); control.disabled = false;
  control.href = opened[0][0]; click(event);
  assert.equal(opened.length, 2);
 }
});
