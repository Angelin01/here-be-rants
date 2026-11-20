import { castle, layout } from './castle.ts';
import { rng } from './random.ts';

const MEADOW_FLUFF = `"",,''..♣τ♠*`;
const PROBE_CHARS = 100;

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
  stone: '═║╔╗╚╝╠╣╦╩╧╢╟\\/',
};
const CLASS_OF = new Map(Object.entries(GLYPH_CLASSES).flatMap(([cls, glyphs]) => [...glyphs].map(g => [g, cls] as const)));

const field = document.getElementById('field')!;
const walls = document.getElementById('walls')!;
const court = document.getElementById('court')!;
const seed = document.body.dataset.seed ?? location.pathname;

let paintQueued = false;

function measure(): { cw: number; lh: number } {
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

function paint() {
  const { cw, lh } = measure();
  const l = layout(Math.floor(document.documentElement.clientWidth / cw));

  field.classList.add('walled');
  field.style.width = `${l.cols * cw}px`;
  court.style.left = `${l.content.col * cw}px`;
  court.style.top = `${l.content.row * lh}px`;
  court.style.width = `${l.content.width * cw}px`;

  // Only measurable now that the court has its final width
  const contentRows = Math.ceil(court.offsetHeight / lh);
  const rows = castle(l, contentRows, rng(seed), MEADOW_FLUFF);

  walls.innerHTML = rows.map(toHtml).join('\n');
  walls.dataset.cols = String(l.cols);
  field.style.height = `${rows.length * lh}px`;
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
  repaintOnResize();
  document.fonts.ready.then(schedulePaint);
  schedulePaint();
}

main();
