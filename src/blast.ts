const BLAST_RADIUS = 70;
const GRAVITY = 1400;
const SPARK_COUNT = 60;
const SPARK_GLYPHS = '*+·☼';
const SPARK_COLORS = ['#c77dff', '#9b5de5', '#e0522b', '#c77dff', '#9b5de5', '#c9a227'];
const RING_COUNT = 32;
const RING_SPEED = 900;
const RING_LIFE = 0.35;
const LETTER_LIFE = 4;
const FLASH_MS = 600;
const SHAKE_MS = 250;
// One sample per grid cell finds every glyph, and each sample is a hit test, so don't sample denser
const SAMPLE_X = 9;
const SAMPLE_Y = 16;
const OFFSCREEN_MARGIN = 50;
export const GLOW = 'text-shadow: 0 0 4px #9b5de5, 0 0 8px #9b5de5';

interface Particle {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  gravity: number;
  age: number;
  life: number;
}

interface Glyph {
  node: Text;
  offset: number;
  rect: DOMRect;
}

const particles: Particle[] = [];

export function fx(text: string, color: string, extra = ''): HTMLElement {
  const el = document.createElement('span');
  el.className = 'fx';
  el.ariaHidden = 'true';
  el.textContent = text;
  el.style.cssText = `color: ${color}; ${extra}`;
  document.body.append(el);
  return el;
}

export function place(el: HTMLElement, x: number, y: number, rot = 0, opacity = 1) {
  el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  el.style.opacity = String(opacity);
}

function addParticle(p: Omit<Particle, 'rot' | 'age'>) {
  particles.push({ ...p, rot: 0, age: 0 });
}

export function stepParticles(dt: number): boolean {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    // Squared so particles stay bright for most of their life, then drop off
    place(p.el, p.x, p.y, p.rot, Math.max(0, 1 - (p.age / p.life) ** 2));

    if (p.age > p.life || p.y > innerHeight + OFFSCREEN_MARGIN) {
      p.el.remove();
      particles.splice(i, 1);
    }
  }

  return particles.length > 0;
}

// Safari only has the older caretRangeFromPoint
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position) {
    return { node: position.offsetNode, offset: position.offset };
  }

  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

function glyphAt(x: number, y: number, court: Element): Glyph | null {
  const caret = caretAt(x, y);
  const node = caret?.node;
  if (!(node instanceof Text) || !court.contains(node) || node.parentElement?.matches('.gone, .faded')) {
    return null;
  }

  // The caret lands between glyphs, so check the one on each side
  for (const offset of [caret!.offset, caret!.offset - 1]) {
    if (offset < 0 || offset >= node.length || !node.data[offset].trim()) {
      continue;
    }

    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset + 1);
    const rect = range.getBoundingClientRect();
    if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) {
      return { node, offset, rect };
    }
  }

  return null;
}

function glyphsNear(x: number, y: number, court: Element): Glyph[] {
  const found = new Map<string, Glyph>();
  const ids = new WeakMap<Text, number>();
  let nextId = 0;

  for (let py = y - BLAST_RADIUS; py <= y + BLAST_RADIUS; py += SAMPLE_Y) {
    for (let px = x - BLAST_RADIUS; px <= x + BLAST_RADIUS; px += SAMPLE_X) {
      if (Math.hypot(px - x, py - y) > BLAST_RADIUS) {
        continue;
      }

      const hit = glyphAt(px, py, court);
      if (!hit) {
        continue;
      }

      if (!ids.has(hit.node)) {
        ids.set(hit.node, nextId++);
      }
      found.set(`${ids.get(hit.node)}:${hit.offset}`, hit);
    }
  }

  return [...found.values()];
}

// The original keeps its space, hidden, so the grid never moves
function hide({ node, offset }: Glyph, className: string): Text {
  const glyph = node.splitText(offset);
  glyph.splitText(1);
  const wrapper = document.createElement('span');
  wrapper.className = className;
  glyph.replaceWith(wrapper);
  wrapper.append(glyph);
  return glyph;
}

// color is read before any letter is hidden, see explode()
function blowAway(hit: Glyph, color: string, x: number, y: number) {
  const { rect } = hit;
  const glyph = hide(hit, 'gone');

  const angle = Math.atan2(rect.top + rect.height / 2 - y, rect.left + rect.width / 2 - x);
  const speed = 300 + Math.random() * 450;
  addParticle({
    el: fx(glyph.data, color, GLOW),
    x: rect.left,
    y: rect.top,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 400,
    spin: (Math.random() - 0.5) * 1000,
    gravity: GRAVITY,
    life: LETTER_LIFE,
  });
}

function sparks(x: number, y: number) {
  for (let i = 0; i < SPARK_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 250 + Math.random() * 650;
    addParticle({
      el: fx(SPARK_GLYPHS[i % SPARK_GLYPHS.length], SPARK_COLORS[i % SPARK_COLORS.length], GLOW),
      x: x - 4,
      y: y - 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: 0,
      gravity: GRAVITY,
      life: 1 + Math.random() * 0.9,
    });
  }
}

function shockwave(x: number, y: number) {
  for (let i = 0; i < RING_COUNT; i++) {
    const angle = (i / RING_COUNT) * Math.PI * 2;
    addParticle({
      el: fx('·', '#c77dff', GLOW),
      x: x - 4,
      y: y - 8,
      vx: Math.cos(angle) * RING_SPEED,
      vy: Math.sin(angle) * RING_SPEED,
      spin: 0,
      gravity: 0,
      life: RING_LIFE,
    });
  }
}

function flash(x: number, y: number) {
  const el = fx('☼', '#c77dff', `left: ${x - 4}px; top: ${y - 8}px; ${GLOW}; animation: blast ${FLASH_MS}ms ease-out forwards`);
  setTimeout(() => el.remove(), FLASH_MS);
}

function shake(field: Element) {
  field.classList.add('shake');
  setTimeout(() => field.classList.remove('shake'), SHAKE_MS);
}

// Highest offset first, so splitting a text node doesn't shift the offsets still to come
function hitsAround(x: number, y: number): Glyph[] {
  return glyphsNear(x, y, document.getElementById('court')!).sort((a, b) => b.offset - a.offset);
}

export function explode(x: number, y: number) {
  // All reads before any write: hiding a letter invalidates styles, and reading a color after that recalculates the
  // whole page, once per letter
  const hits = hitsAround(x, y);
  const colors = hits.map(hit => getComputedStyle(hit.node.parentElement!).color);
  hits.forEach((hit, i) => blowAway(hit, colors[i], x, y));

  flash(x, y);
  shockwave(x, y);
  sparks(x, y);
  shake(document.getElementById('field')!);
}

export function fadeAway(x: number, y: number) {
  for (const hit of hitsAround(x, y)) {
    hide(hit, 'faded');
  }
}
