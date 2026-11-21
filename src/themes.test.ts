import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { THEMES, themeFor } from './themes.ts';

const SEEDS = Array.from({ length: 200 }, (_, i) => `/posts/${i}/`);

test('given many seeds, when picking themes, then every theme gets picked', () => {
  const picked = new Set(SEEDS.map(themeFor));
  assert.deepEqual([...picked].sort(), Object.keys(THEMES).sort());
});

test('given the same seed, when picking twice, then the theme matches', () => {
  for (const seed of SEEDS) {
    assert.equal(themeFor(seed), themeFor(seed), seed);
  }
});

function sharedColors(): Set<string> {
  const css = fs.readFileSync(new URL('../static/css/site.css', import.meta.url), 'utf8');
  const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  return new Set([...root.matchAll(/--([\w-]+):/g)].map(m => m[1]));
}

test('given every theme, when checking its tints, then each one has a color', () => {
  const shared = sharedColors();

  for (const [name, theme] of Object.entries(THEMES)) {
    const tints = [...theme.fluff.map(f => f.tint), ...(theme.pond ? [theme.pond.tint] : [])];
    for (const tint of tints) {
      assert.ok(tint in theme.colors || shared.has(tint), `${name}: tint ${tint} has no color`);
    }
  }
});

test('given every theme, when checking its colors, then the castle colors are there', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    for (const color of ['moat', 'tree']) {
      assert.ok(color in theme.colors, `${name}: missing ${color}`);
    }
  }
});
