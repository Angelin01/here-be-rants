import type { Scenery } from './castle.ts';
import { rng } from './random.ts';

export interface Theme extends Scenery {
  // Set as CSS variables on <html>. Fluff tints name these, or a shared color in site.css.
  // Every theme needs `moat` and `tree`, the castle itself uses them.
  colors: Record<string, string>;
  // Out of the seeded rotation, so only a page pin or the picker shows it
  pinnedOnly?: boolean;
  // Light themes swap the page itself to the light palette in site.css
  light?: boolean;
}

export type Mode = 'dark' | 'light';

// Also what a page gets when it pins the theme "default"
export const DEFAULT_THEMES: Record<Mode, string> = { dark: 'meadow', light: 'parchment' };

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
  // Snow is the page itself, fluff is the drifts and shadows on it
  winter: {
    light: true,
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
      bg: '#d6dde5',
      moat: '#4f7fae',
      tree: '#2a4f37',
      snow: '#a6b4c5',
      'snow-shadow': '#6a7f9a',
      snowflake: '#f4f7fa',
      ice: '#5f8cb8',
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
    light: true,
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
      bg: '#f2ec91',
      moat: '#b08a4a',
      tree: '#3f7027',
      sand: '#c9a24a',
      dune: '#b48a34',
      rock: '#7d5636',
      scrub: '#6f7c38',
    },
  },
  parchment: {
    light: true,
    fluff: [
      { glyphs: `.,'"`, tint: 'ink-faded', weight: 64 },
      { glyphs: '♣♠', tint: 'tree', weight: 20 },
      { glyphs: '~', tint: 'moat', weight: 6 },
      { glyphs: '▲', tint: 'ink', weight: 5 },
      { glyphs: '*', tint: 'ink-red', weight: 3 },
    ],
    pond: { glyph: '≈', tint: 'moat' },
    colors: {
      bg: '#f7f2e4',
      moat: '#55748f',
      tree: '#4f4029',
      ink: '#5e4d33',
      'ink-faded': '#c2b08e',
      'ink-red': '#9a4a28',
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

export function modeOf(name: string): Mode {
  return THEMES[name].light ? 'light' : 'dark';
}

export function rotation(mode: Mode): string[] {
  return Object.keys(THEMES).filter(name => !THEMES[name].pinnedOnly && modeOf(name) === mode);
}

export function themeFor(seed: string, mode: Mode): string {
  const names = rotation(mode);
  return names[Math.floor(rng(seed)() * names.length)];
}
