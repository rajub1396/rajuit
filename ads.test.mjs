import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('first download click opens an ad; second downloads even when the ad is blocked', () => {
  const page = readFileSync(new URL('public/index.html', import.meta.url), 'utf8');
  const script = page.match(/<script>\s*\/\/ Additional[\s\S]*?<\/script>/)[0]
    .replace(/^<script>/, '').replace(/<\/script>$/, '');
  for (const blocked of [false, true]) {
    let capture, targetClick, ads = 0;
    const download = { addEventListener: (_, listener) => targetClick = listener };
    const hint = {};
    runInNewContext(script, {
      document: {
        querySelector: selector => selector === '#download' ? download : hint,
        addEventListener() {}
      },
      window: {
        addEventListener: (_, listener) => capture = listener,
        open() { ads++; if (blocked) throw new Error('Blocked'); }
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
    assert.match(download.innerHTML, /Click again/);
    const second = click(); capture(second); targetClick(second);
    assert.equal(second.prevented, false);
    assert.equal(ads, 1);
    const third = click(); capture(third);
    assert.equal(third.prevented, false);
    assert.equal(ads, 1);
  }
});
