import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { apps, renderApp } from './apps.mjs';

test('first download click opens an ad; second downloads even when the ad is blocked', () => {
  const page = renderApp(apps[0]);
  const script = page.match(/<script>\s*\/\/ Additional[\s\S]*?<\/script>/)[0]
    .replace(/^<script>/, '').replace(/<\/script>$/, '');
  assert.ok(page.indexOf('// Additional') < page.indexOf('src="https://'));
  for (const blocked of [false, true]) {
    let capture, ads = 0;
    const downloads = [];
    const download = { href: '/download/RYT-universal.apk', dataset: { available: 'true' } };
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
    assert.deepEqual(downloads, ['/download/RYT-universal.apk']);
    assert.equal(ads, 1);
    const third = click(); capture(third);
    assert.equal(third.prevented, true);
    assert.equal(downloads.length, 2);
    assert.equal(ads, 1);
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
