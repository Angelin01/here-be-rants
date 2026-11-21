import type { Scenery } from './castle.ts';
import { rng } from './random.ts';

export interface Theme extends Scenery {
  // Set as CSS variables on <html>. Fluff tints name these, or a shared color in site.css.
  // Every theme needs `moat` and `tree`, the castle itself uses them.
  colors: Record<string, string>;
  // Out of the seeded rotation, so only a page pin or the picker shows it
  pinnedOnly?: boolean;
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
  winter: {
    density: 0.45,
    fluff: [
      { glyphs: `.,'`, tint: 'snow', weight: 50 },
      { glyphs: `"'.`, tint: 'snow-shadow', weight: 18 },
      { glyphs: '*', tint: 'snowflake', weight: 10 },
      { glyphs: '♠', tint: 'tree', weight: 14 },
      { glyphs: '°', tint: 'ice', weight: 8 },
    ],
    pond: { glyph: '░', tint: 'ice' },
    colors: {
      moat: '#7fa8cf',
      tree: '#2f5a3f',
      snow: '#c9d3df',
      'snow-shadow': '#5d7593',
      snowflake: '#f2f6fa',
      ice: '#9cc4e4',
    },
  },
  // Overrides stone and wood as well so the castle itself goes blue
  night: {
    fluff: [
      { glyphs: `"',.`, tint: 'grass', weight: 66 },
      { glyphs: '♣♠τ', tint: 'tree', weight: 24 },
      { glyphs: '*°', tint: 'flower', weight: 6 },
      { glyphs: '·', tint: 'firefly', weight: 3 },
    ],
    pond: { glyph: '≈', tint: 'moat' },
    colors: {
      bg: '#0b0d14',
      moat: '#2c4f80',
      tree: '#1f3d4a',
      grass: '#2f4f5a',
      flower: '#6f74a8',
      firefly: '#e8d36a',
      stone: '#6e7a8f',
      wood: '#5a5f78',
    },
  },
  desert: {
    fluff: [
      { glyphs: `.,'`, tint: 'sand', weight: 60 },
      { glyphs: '~', tint: 'dune', weight: 18 },
      { glyphs: '•▪', tint: 'rock', weight: 12 },
      { glyphs: 'Ψ', tint: 'tree', weight: 4 },
      { glyphs: '"', tint: 'scrub', weight: 3 },
    ],
    // Dry, so they blend into the sand like the moat does
    pond: { glyph: '░', tint: 'moat' },
    colors: {
      bg: '#120f0a',
      moat: '#8a7650',
      tree: '#5f8a3a',
      sand: '#c9b27a',
      dune: '#a8905c',
      rock: '#7a5a3c',
      scrub: '#7d8a4a',
    },
  },
  // Pinned on the 404 page
  barren: {
    pinnedOnly: true,
    density: 0.22,
    fluff: [
      { glyphs: `.,'`, tint: 'dust', weight: 60 },
      { glyphs: '•▪', tint: 'rock', weight: 18 },
      { glyphs: 'τ', tint: 'tree', weight: 12 },
      { glyphs: '"', tint: 'dead-grass', weight: 10 },
    ],
    pond: { glyph: '░', tint: 'moat' },
    colors: {
      moat: '#3e4644',
      tree: '#4a4540',
      dust: '#6e6a64',
      rock: '#55504a',
      'dead-grass': '#6b6450',
    },
  },
  unicorn: {
    density: 0.35,
    fluff: [
      { glyphs: `"',.`, tint: 'grass', weight: 40 },
      { glyphs: '*', tint: 'red', weight: 6 },
      { glyphs: '*', tint: 'orange', weight: 6 },
      { glyphs: '*', tint: 'yellow', weight: 6 },
      { glyphs: '*', tint: 'green', weight: 6 },
      { glyphs: '*', tint: 'blue', weight: 6 },
      { glyphs: '*', tint: 'violet', weight: 6 },
      { glyphs: '♥', tint: 'heart', weight: 6 },
      { glyphs: '°·', tint: 'sparkle', weight: 8 },
      { glyphs: '♣', tint: 'tree', weight: 10 },
    ],
    pond: { glyph: '≈', tint: 'moat' },
    colors: {
      bg: '#120c14',
      moat: '#e48ac8',
      tree: '#7ed6b0',
      grass: '#b48ad0',
      red: '#ff6b6b',
      orange: '#ffa94d',
      yellow: '#ffe066',
      green: '#8ce99a',
      blue: '#74c0fc',
      violet: '#b197fc',
      heart: '#ff8cc6',
      sparkle: '#fff3bf',
    },
  },
};

export const ROTATION = Object.keys(THEMES).filter(name => !THEMES[name].pinnedOnly);

export function themeFor(seed: string): string {
  return ROTATION[Math.floor(rng(seed)() * ROTATION.length)];
}
