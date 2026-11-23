import { explode, fadeAway, fx, stepParticles } from './blast.ts';

// Seen from above, facing right, wings swept back for the dive. Rotated to match his heading.
// The two leftmost cells below the middle row are Hiccup's red tail fin, the rest is night.
const ART = [
  '   ▀▀▄     ',
  '▀▄   ▀█▄   ',
  ' ════████═►',
  '▄▀   ▄█▀   ',
  '   ▄▄▀     ',
];
const NIGHT = '#16161f';
const FIN = '#c0392b';
// Black on a dark page needs a faint moonlit rim to read as a silhouette. A filter, not text-shadow, so the rim
// wraps the whole shape instead of outlining every glyph.
const RIM = 'filter: drop-shadow(0 0 1px rgba(120, 150, 255, .65)) drop-shadow(0 0 3px rgba(50, 70, 180, .45))';
const BOLT_STYLE = 'text-shadow: 0 0 6px #9b5de5, 0 0 12px #9b5de5';

// Fixed durations instead of speeds, so the hit always lands on time, wherever he comes from
const DIVE_TIME = 0.35;
const BOLT_TIME = 0.15;
export const FLIGHT_TIME = DIVE_TIME + BOLT_TIME;
const MIN_SPEED = 1400;
const SHOT_RANGE = [120, 350];
const BANK_TIME = 0.3;
const BANK_RATE = 0.75;
// rAF stalls in background tabs, never move more than this many seconds in one frame
const MAX_STEP = 0.05;

interface Point {
  x: number;
  y: number;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

function drawDragon(el: HTMLElement) {
  el.replaceChildren(...ART.flatMap((row, r) => {
    const spans = [...row].map((glyph, i) => {
      const span = document.createElement('span');
      span.textContent = glyph;
      span.style.color = r > (ART.length - 1) / 2 && i < 2 ? FIN : NIGHT;
      return span;
    });
    return r > 0 ? ['\n', ...spans] : spans;
  }));
}

// A random edge, skipping edges too close to the target to leave room for the dive
function pickStart(target: Point, margin: number): Point {
  const along = Math.random();
  const edges = [
    { x: -margin, y: along * innerHeight },
    { x: innerWidth + margin, y: along * innerHeight },
    { x: along * innerWidth, y: -margin },
    { x: along * innerWidth, y: innerHeight + margin },
  ];
  const far = edges.filter(e => Math.hypot(target.x - e.x, target.y - e.y) > SHOT_RANGE[1] + margin);
  const pool = far.length > 0 ? far : edges;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Resolves once he's gone and the dust has settled. pageX and pageY are page coordinates, so the hit follows the
// text if the reader scrolls. impactAt is a performance.now() time.
export async function launch(pageX: number, pageY: number, impactAt: number, onImpact = () => {}): Promise<void> {
  // Reduced motion: no dive and no debris, but the sound still plays
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await wait(impactAt - performance.now());
    onImpact();
    fadeAway(pageX - scrollX, pageY - scrollY);
    return;
  }

  await wait(impactAt - FLIGHT_TIME * 1000 - performance.now());

  getSelection()?.removeAllRanges();
  const el = fx('', NIGHT, `white-space: pre; transform-origin: center; ${RIM}`);
  drawDragon(el);
  const { width: w, height: h } = el.getBoundingClientRect();
  const margin = Math.max(w, h);
  const target = (): Point => ({ x: pageX - scrollX, y: pageY - scrollY });

  const start = pickStart(target(), margin);
  // fx spawns at the top left, so place it at the start before the waits below let it paint there
  el.style.transform = `translate(${start.x - w / 2}px, ${start.y - h / 2}px)`;
  const toTarget = Math.hypot(target().x - start.x, target().y - start.y);
  const fireAt = toTarget - Math.min(Math.max(toTarget * 0.45, SHOT_RANGE[0]), SHOT_RANGE[1]);
  const speed = Math.max(MIN_SPEED, fireAt / DIVE_TIME);
  // A short dive at full speed starts late, so the shot still comes BOLT_TIME before the hit
  await wait(impactAt - BOLT_TIME * 1000 - (fireAt / speed) * 1000 - performance.now());

  let { x, y } = start;
  let heading = Math.atan2(target().y - y, target().x - x);
  const bank = (Math.random() < 0.5 ? -1 : 1) * BANK_RATE;
  let travelled = 0;
  let banking = BANK_TIME;
  let flying = true;
  let bolt: { el: HTMLElement; from: Point; firedAt: number } | null = null;
  let exploded = false;
  let last = performance.now();

  return new Promise(resolve => {
    const tick = (now: number) => {
      // rAF timestamps can predate the performance.now() taken above
      const dt = Math.max(0, Math.min(MAX_STEP, (now - last) / 1000));
      last = now;

      if (flying) {
        const step = speed * dt;
        if (!bolt && !exploded && travelled + step >= fireAt) {
          bolt = { el: fx('●', '#c77dff', BOLT_STYLE), from: { x: x + Math.cos(heading) * w / 2, y: y + Math.sin(heading) * w / 2 }, firedAt: now };
        }
        if ((bolt || exploded) && banking > 0) {
          heading += bank * dt;
          banking -= dt;
        }

        x += Math.cos(heading) * step;
        y += Math.sin(heading) * step;
        travelled += step;
        el.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${heading}rad)`;

        const offScreen = x < -margin || x > innerWidth + margin || y < -margin || y > innerHeight + margin;
        if ((bolt || exploded) && offScreen) {
          flying = false;
          el.remove();
        }
      }

      if (bolt) {
        // Aimed at a moment, not a speed, so frame hiccups can't make it late
        const t = target();
        const progress = Math.min(1, (now - bolt.firedAt) / Math.max(1, impactAt - bolt.firedAt));
        const bx = bolt.from.x + (t.x - bolt.from.x) * progress;
        const by = bolt.from.y + (t.y - bolt.from.y) * progress;
        bolt.el.style.transform = `translate(${bx - 4}px, ${by - 8}px)`;

        if (now >= impactAt) {
          bolt.el.remove();
          bolt = null;
          exploded = true;
          onImpact();
          explode(t.x, t.y);
        }
      }

      const settling = stepParticles(dt);
      if (flying || bolt || settling) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(tick);
  });
}
