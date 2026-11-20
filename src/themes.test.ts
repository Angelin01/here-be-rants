import { test } from 'node:test';
import assert from 'node:assert/strict';
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
