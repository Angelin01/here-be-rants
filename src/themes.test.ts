import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { DEFAULT_THEMES, THEMES, modeOf, rotation, themeFor, type Mode } from './themes.ts';

const SEEDS = Array.from({ length: 200 }, (_, i) => `/posts/${i}/`);

const MODES: Mode[] = ['dark', 'light'];

test('given many seeds, when picking themes in either mode, then every theme of that rotation gets picked, and only those', () => {
  for (const mode of MODES) {
    const picked = new Set(SEEDS.map(seed => themeFor(seed, mode)));
    assert.deepEqual([...picked].sort(), rotation(mode).sort(), mode);
  }
});

test('when listing a rotation, then it only has themes of its mode and no pinned-only ones', () => {
  for (const mode of MODES) {
    assert.ok(rotation(mode).length > 0, mode);
    for (const name of rotation(mode)) {
      assert.equal(modeOf(name), mode, name);
      assert.ok(!THEMES[name].pinnedOnly, name);
    }
  }
});

test('when checking the defaults, then each mode defaults to a theme of that mode', () => {
  for (const mode of MODES) {
    assert.equal(modeOf(DEFAULT_THEMES[mode]), mode);
  }
});

test('given the same seed, when picking twice, then the theme matches', () => {
  for (const seed of SEEDS) {
    assert.equal(themeFor(seed, 'dark'), themeFor(seed, 'dark'), seed);
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
