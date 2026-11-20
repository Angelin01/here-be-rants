import { rng } from './random.ts';

export interface Theme {
  fluff: string;
  // Set as CSS variables on <html> (`moat` becomes `--moat`), the other colors are shared in site.css
  colors: {
    bg?: string;
    moat: string;
    grass: string;
    tree: string;
    flower: string;
  };
}

export const DEFAULT_THEME = 'meadow';

export const THEMES: Record<string, Theme> = {
  meadow: {
    fluff: `"",,''..♣τ♠*`,
    colors: {
      moat: '#3b6ea5',
      grass: '#4f7a3a',
      tree: '#2f6b3a',
      flower: '#c9a227',
    },
  },
  lava: {
    fluff: `..,,''τ°*`,
    colors: {
      bg: '#120a08',
      moat: '#e0522b',
      grass: '#6b5a4a',
      tree: '#5a4636',
      flower: '#e0522b',
    },
  },
};

export function themeFor(seed: string): string {
  const names = Object.keys(THEMES);
  return names[Math.floor(rng(seed)() * names.length)];
}
