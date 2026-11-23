import { castle, footerRow, layout, outline, type Cells } from './castle.ts';
import { rng } from './random.ts';
import { AUTO, closeLikeAMenu, renderPicker } from './picker.ts';
import { DEFAULT_THEMES, THEMES, modeOf, themeFor, type Mode } from './themes.ts';

const PROBE_CHARS = 100;
const ROW_TOLERANCE = 0.01;
const SAVED_THEME_KEY = 'theme';
// The <head> script in base.html reads this one before anything renders, keep the key in sync
const SAVED_MODE_KEY = 'mode';
// Every variable any theme sets, so switching themes can clear the previous one's leftovers
const THEME_VARS = new Set(Object.values(THEMES).flatMap(t => Object.keys(t.colors)));

// CSS variable per castle glyph. Fluff brings its own tint, anything else uses the text color
const GLYPH_COLORS: Record<string, string> = {
  moat: '≈',
  tree: '♣τ',
  ember: '☼',
  purple: '►│┌┐└┘─',
  detail: '⌂○•',
  wood: '+≡╤',
  stone: '═║╔╗╚╝╠╣╦╩╧╢╟\\/',
};
const COLOR_OF = new Map(Object.entries(GLYPH_COLORS).flatMap(([color, glyphs]) => [...glyphs].map(g => [g, color] as const)));

const field = document.getElementById('field')!;
const walls = document.getElementById('walls')!;
const court = document.getElementById('court')!;
const footer = court.querySelector('footer');
const picker = document.querySelector<HTMLDetailsElement>('#themes');
const seed = document.body.dataset.seed ?? location.pathname;

let paintQueued = false;
const beaconButtons: HTMLButtonElement[] = [];
let themeName = DEFAULT_THEMES.dark;
// Kept in memory too, so picking still works for the visit when storage is blocked
let chosenTheme: string | null = null;

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
function toHtml(row: string, tints: string[]): string {
  let out = '';
  let color = '';
  let run = '';
  const flush = () => {
    out += color ? `<span style="color: var(--${color})">${run}</span>` : run;
  };

  [...row].forEach((glyph, i) => {
    const next = glyph === ' ' ? color : (tints[i] || COLOR_OF.get(glyph) || '');
    if (next !== color) {
      flush();
      color = next;
      run = '';
    }
    run += glyph;
  });
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

// get-down.ts listens for clicks on these, buttons are reused across repaints so keyboard focus survives a resize
function placeBeacons(beacons: Cells[], { cw, lh }: Cell) {
  while (beaconButtons.length < beacons.length) {
    const button = document.createElement('button');
    button.className = 'beacon';
    button.type = 'button';
    button.ariaLabel = 'Whistle for a dragon';
    field.append(button);
    beaconButtons.push(button);
  }
  while (beaconButtons.length > beacons.length) {
    beaconButtons.pop()!.remove();
  }

  beacons.forEach((b, i) => {
    const style = beaconButtons[i].style;
    style.left = `${b.left * cw}px`;
    style.top = `${b.top * lh}px`;
    style.width = `${(b.right - b.left + 1) * cw}px`;
    style.height = `${(b.bottom - b.top + 1) * lh}px`;
  });
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

  // Only measurable now that the court has its final width. The footer is out of the flow by now, see site.css
  snapToRows(lh);
  const contentRows = Math.ceil(court.offsetHeight / lh);
  const footerRows = footer ? Math.ceil(footer.offsetHeight / lh) : 0;
  if (footer) {
    footer.style.top = `${(footerRow(l, contentRows) - l.content.row) * lh}px`;
  }
  // Rounded down to avoid a scrollbar
  const screenRows = Math.floor(document.documentElement.clientHeight / lh);
  const painting = castle(l, contentRows, rng(seed), THEMES[themeName], footerRows, screenRows);

  const origin = field.getBoundingClientRect();
  const frames = [...court.querySelectorAll('pre')].map(el => cellsOf(el, origin, cell));
  const bars = [...court.querySelectorAll('blockquote')].map(el => cellsOf(el, origin, cell));

  const { rows, tints, beacons } = outline(painting, frames, bars);
  walls.innerHTML = rows.map((row, r) => toHtml(row, tints[r])).join('\n');
  walls.dataset.cols = String(l.cols);
  field.style.height = `${rows.length * lh}px`;
  placeBeacons(beacons, cell);
}

// Storage throws in some private modes and with blocked site data, the choice then only lasts the visit
function savedTheme(): string | null {
  try {
    return localStorage.getItem(SAVED_THEME_KEY);
  } catch {
    return null;
  }
}

function saveTheme(name: string) {
  try {
    if (name === AUTO) {
      localStorage.removeItem(SAVED_THEME_KEY);
      localStorage.removeItem(SAVED_MODE_KEY);
    } else {
      localStorage.setItem(SAVED_THEME_KEY, name);
      localStorage.setItem(SAVED_MODE_KEY, modeOf(name));
    }
  } catch {
    // Nothing to do, see savedTheme()
  }
}

function pageMode(): Mode {
  const pinned = document.documentElement.dataset.modePin;
  if (pinned === 'light' || pinned === 'dark') {
    return pinned;
  }

  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(): string {
  const mode = pageMode();
  const pinned = document.body.dataset.theme === 'default' ? DEFAULT_THEMES[mode] : document.body.dataset.theme;
  const wanted = new URLSearchParams(location.search).get('theme') || chosenTheme || pinned || themeFor(seed, mode);
  return wanted in THEMES ? wanted : DEFAULT_THEMES[mode];
}

function applyTheme(name: string) {
  themeName = name;
  const root = document.documentElement;
  root.dataset.theme = name;
  // Usually the <head> script already guessed right, this settles the cases it can't know, like ?theme=
  root.dataset.mode = modeOf(name);

  for (const key of THEME_VARS) {
    root.style.removeProperty(`--${key}`);
  }
  for (const [key, value] of Object.entries(THEMES[name].colors)) {
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

function refreshPicker() {
  if (!picker) {
    return;
  }

  renderPicker(picker, { names: Object.keys(THEMES), chosen: chosenTheme ?? AUTO, shown: themeName }, pickTheme);
}

function pickTheme(name: string) {
  chosenTheme = name === AUTO ? null : name;
  saveTheme(name);

  // ?theme= outranks the saved choice, so it has to go or the choice would seem to do nothing
  const params = new URLSearchParams(location.search);
  params.delete('theme');
  history.replaceState(null, '', location.pathname + (params.size > 0 ? `?${params}` : ''));

  applyTheme(resolveTheme());
  refreshPicker();
  schedulePaint();
}

function showPicker() {
  if (!picker) {
    return;
  }

  closeLikeAMenu(picker);
  refreshPicker();
  picker.hidden = false;
  picker.closest('header')!.hidden = false;
}

function repaintOnResize() {
  addEventListener('resize', schedulePaint);
  new ResizeObserver(schedulePaint).observe(court);
}

function main() {
  chosenTheme = savedTheme();
  applyTheme(resolveTheme());
  showPicker();
  repaintOnResize();
  document.fonts.ready.then(schedulePaint);
  schedulePaint();
}

main();
