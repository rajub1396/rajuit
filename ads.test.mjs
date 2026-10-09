import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { apps, renderApp, renderHome } from './apps.mjs';

test('Smartlink repeats every six seconds, pauses in hidden pages and stops on departure', () => {
  for (const page of [renderHome(), ...apps.map(app => renderApp(app))]) {
    const script = page.match(/<script>\s*\/\/ Smartlink:[\s\S]*?<\/script>/)[0]
      .replace(/^<script>/, '').replace(/<\/script>$/, '');
    for (const readyState of ['loading', 'complete']) {
      for (const blocked of [false, true]) {
        const listeners = {};
        const document = { readyState, hidden: false };
        let attempts = 0, tick, clears = 0;
        runInNewContext(script, { document, window: {
          addEventListener(event, callback) { listeners[event] = callback; },
          setInterval(callback, delay) { assert.equal(delay, 6000); tick = callback; return 1; },
          clearInterval(id) { assert.equal(id, 1); clears++; tick = undefined; },
          open(url, target, features) {
            attempts++;
            assert.equal(url, 'https://auctionr.org/4/07c4573883eaaad1956ac62edd3f7a40');
            assert.equal(target, '_blank');
            assert.equal(features, 'noopener,noreferrer');
            if (blocked) throw new Error('Blocked');
          }
        }});
        if (readyState === 'loading') { assert.equal(attempts, 0); listeners.load(); listeners.load(); }
        assert.equal(attempts, 1);
        tick(); assert.equal(attempts, 2);
        document.hidden = true;
        tick(); assert.equal(attempts, 2);
        document.hidden = false;
        tick(); assert.equal(attempts, 3);
        listeners.pagehide(); assert.equal(clears, 1); assert.equal(tick, undefined);
        listeners.pageshow({persisted: true}); assert.equal(attempts, 4);
        tick(); assert.equal(attempts, 5);
      }
    }
  }
});

test('every available app opens an ad first and downloads its own APK second, even when ads are blocked', t => {
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
        document: {
          querySelector: selector => selector === '#download' ? download : hint,
          addEventListener() {}
        },
        window: {
          addEventListener: (_, listener) => capture = listener,
          open() { ads++; if (blocked) throw new Error('Blocked'); },
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
        open() { assert.fail('An unavailable APK must not open an ad'); },
        location: { assign() { assert.fail('An unavailable APK must not start a download'); } }
      },
      sessionStorage: { getItem: () => null }
    });
    capture({ button: 0, target: { closest: () => download }, preventDefault() {}, stopImmediatePropagation() {} });
    assert.match(hint.textContent, /coming soon/);
  }
});
