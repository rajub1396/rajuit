import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('first download click opens an ad; second downloads even when the ad is blocked', () => {
  const page = readFileSync(new URL('public/index.html', import.meta.url), 'utf8');
  const script = page.match(/<script>\s*\/\/ Additional[\s\S]*?<\/script>/)[0]
    .replace(/^<script>/, '').replace(/<\/script>$/, '');
  assert.ok(page.indexOf('// Additional') < page.indexOf('src="https://'));
  for (const blocked of [false, true]) {
    let capture, ads = 0;
    const downloads = [];
    const download = {};
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
