import { castle, layout, outline, type Cells } from './castle.ts';
import { rng } from './random.ts';
import { DEFAULT_THEME, THEMES, themeFor, type Theme } from './themes.ts';

const PROBE_CHARS = 100;
const ROW_TOLERANCE = 0.01;

// Anything not listed is painted in the default text color
const GLYPH_CLASSES: Record<string, string> = {
  moat: '≈',
  grass: `"',.`,
  tree: '♣♠τ',
  flower: '*°',
  ember: '☼',
  purple: '►',
  detail: '⌂○•',
  wood: '+≡╤',
  code: '│┌┐└┘─',
  stone: '═║╔╗╚╝╠╣╦╩╧╢╟\\/',
};
const CLASS_OF = new Map(Object.entries(GLYPH_CLASSES).flatMap(([cls, glyphs]) => [...glyphs].map(g => [g, cls] as const)));

const field = document.getElementById('field')!;
const walls = document.getElementById('walls')!;
const court = document.getElementById('court')!;
const seed = document.body.dataset.seed ?? location.pathname;

let paintQueued = false;
let theme: Theme = THEMES[DEFAULT_THEME];

interface Cell {
  cw: number;
  lh: number;
}

function measure(): Cell {
  // One glyph's width is fractional, so measure a long run and divide
  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(PROBE_CHARS);
  probe.style.cssText = 'position: absolute; visibility: hidden; white-space: pre';
  walls.after(probe);
  const cw = probe.getBoundingClientRect().width / PROBE_CHARS;
  probe.remove();

  return { cw, lh: parseFloat(getComputedStyle(walls).lineHeight) };
}

// Spaces join whatever run they're in, for fewer spans
function toHtml(row: string): string {
  let out = '';
  let cls = '';
  let run = '';
  const flush = () => {
    out += cls ? `<span class="${cls}">${run}</span>` : run;
  };

  for (const g of row) {
    const next = g === ' ' ? cls : (CLASS_OF.get(g) ?? '');
    if (next !== cls) {
      flush();
      cls = next;
      run = '';
    }
    run += g;
  }
  flush();

  return out;
}

function snapToRows(lh: number) {
  for (const el of court.querySelectorAll<HTMLElement>('img, [data-snap]')) {
    if (el.parentElement?.closest('[data-snap]')) {
      continue;
    }

    el.style.paddingBottom = '';
    const height = el.getBoundingClientRect().height;
    el.style.paddingBottom = `${Math.ceil(height / lh - ROW_TOLERANCE) * lh - height}px`;
  }
}

function cellsOf(el: Element, origin: DOMRect, { cw, lh }: Cell): Cells {
  const box = el.getBoundingClientRect();
  return {
    top: Math.round((box.top - origin.top) / lh),
    bottom: Math.round((box.bottom - origin.top) / lh) - 1,
    left: Math.round((box.left - origin.left) / cw),
    right: Math.round((box.right - origin.left) / cw) - 1,
  };
}

function paint() {
  const cell = measure();
  const { cw, lh } = cell;
  const l = layout(Math.floor(document.documentElement.clientWidth / cw));

  field.classList.add('walled');
  field.style.width = `${l.cols * cw}px`;
  court.style.left = `${l.content.col * cw}px`;
  court.style.top = `${l.content.row * lh}px`;
  court.style.width = `${l.content.width * cw}px`;

  // Only measurable now that the court has its final width
  snapToRows(lh);
  const contentRows = Math.ceil(court.offsetHeight / lh);
  const rows = castle(l, contentRows, rng(seed), theme.fluff);

  const origin = field.getBoundingClientRect();
  const frames = [...court.querySelectorAll('pre')].map(el => cellsOf(el, origin, cell));
  const bars = [...court.querySelectorAll('blockquote')].map(el => cellsOf(el, origin, cell));

  walls.innerHTML = outline(rows, frames, bars).map(toHtml).join('\n');
  walls.dataset.cols = String(l.cols);
  field.style.height = `${rows.length * lh}px`;
}

function chooseTheme(): string {
  const wanted = new URLSearchParams(location.search).get('theme') || document.body.dataset.theme || themeFor(seed);
  return wanted in THEMES ? wanted : DEFAULT_THEME;
}

function applyTheme(name: string) {
  theme = THEMES[name];
  const root = document.documentElement;
  root.dataset.theme = name;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key}`, value);
  }
}

function schedulePaint() {
  // Many resize events can fire per frame, only paint once
  if (paintQueued) {
    return;
  }

  paintQueued = true;
  requestAnimationFrame(() => {
    paintQueued = false;
    paint();
  });
}

function repaintOnResize() {
  addEventListener('resize', schedulePaint);
  new ResizeObserver(schedulePaint).observe(court);
}

function main() {
  applyTheme(chooseTheme());
  repaintOnResize();
  document.fonts.ready.then(schedulePaint);
  schedulePaint();
}

main();
