import type { Scenery } from './castle.ts';
import { rng } from './random.ts';

export interface Theme extends Scenery {
  // Set as CSS variables on <html>. Fluff tints name these, or a shared color in site.css.
  // Every theme needs `moat` and `tree`, the castle itself uses them.
  colors: Record<string, string>;
}

export const DEFAULT_THEME = 'meadow';

export const THEMES: Record<string, Theme> = {
  meadow: {
    fluff: [
      { glyphs: `"',.`, tint: 'grass', weight: 66 },
      { glyphs: '♣♠τ', tint: 'tree', weight: 24 },
      { glyphs: '*', tint: 'flower-yellow', weight: 3 },
      { glyphs: '*', tint: 'flower-red', weight: 2.5 },
      { glyphs: '*°', tint: 'flower-purple', weight: 2.5 },
      { glyphs: '°', tint: 'flower-blue', weight: 2 },
    ],
    pond: { glyph: '≈', tint: 'moat' },
    colors: {
      moat: '#3b6ea5',
      grass: '#4f7a3a',
      tree: '#2f6b3a',
      'flower-yellow': '#c9a227',
      'flower-red': '#b8443a',
      'flower-purple': '#8a5bc4',
      'flower-blue': '#4a78b5',
    },
  },
  lava: {
    fluff: [
      { glyphs: `.,'`, tint: 'ash', weight: 55 },
      { glyphs: '▪•', tint: 'rock', weight: 18 },
      { glyphs: 'τ', tint: 'tree', weight: 9 },
      { glyphs: '°*', tint: 'ember', weight: 9 },
      { glyphs: '♦', tint: 'obsidian', weight: 4 },
    ],
    pond: { glyph: '≈', tint: 'moat' },
    colors: {
      bg: '#120a08',
      moat: '#e0522b',
      tree: '#5a4636',
      ash: '#6b5a4a',
      rock: '#3d3632',
      obsidian: '#5e3a78',
    },
  },
};

export function themeFor(seed: string): string {
  const names = Object.keys(THEMES);
  return names[Math.floor(rng(seed)() * names.length)];
}
