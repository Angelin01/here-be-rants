// The easter egg's entry point, on every page: whistle from a beacon (walls.ts puts them on the castle), then pick a
// target. The dragon itself is only downloaded once he's called.

// Time for the dragon module to load before the dive starts
const LEAD_MS = 300;
const TARGETING_TIMEOUT_MS = 15000;
// Next to js/ in the built site, wherever the site is hosted
const SOUND_URL = new URL('../sounds/get-down.mp3', import.meta.url).href;
// Where the boom is in the sound file, the bolt lands right on it
const BOOM_MS = 5528;
// Give up on reading the sound's start time after this, and schedule from when play() resolved
const START_TIMEOUT_MS = 1000;

type State = 'idle' | 'targeting' | 'diving';

let state: State = 'idle';
let targetingTimeout = 0;
let dragon: Promise<typeof import('./dragon.ts')> | null = null;
let sound: HTMLAudioElement | null = null;

// Started on the whistle, so it's usually loaded by the time a target is picked
function loadDragon(): Promise<typeof import('./dragon.ts')> {
  dragon ??= import('./dragon.ts');
  return dragon;
}

// Also started on the whistle, so it's buffered by the time a target is picked
function loadSound(): HTMLAudioElement {
  if (!sound) {
    sound = new Audio(SOUND_URL);
    sound.preload = 'auto';
  }
  return sound;
}

function nextFrame(): Promise<number> {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

// Resolves with the performance.now() time the sound started at, or null if it couldn't play. Browsers only allow
// sound from a click or tap, so this has to be called before the first await in the click's handling
async function playSound(): Promise<number | null> {
  const audio = loadSound();
  audio.currentTime = 0;
  try {
    await audio.play();
  } catch {
    return null;
  }

  // Firefox resolves play() about 100ms before the sound is actually heard, so wait for the playback position to
  // move and count back from there
  const resolvedAt = performance.now();
  while (audio.currentTime === 0 && performance.now() - resolvedAt < START_TIMEOUT_MS) {
    await nextFrame();
  }
  return performance.now() - audio.currentTime * 1000;
}

// Screen readers hear what the crosshair tells everyone else
function announce(text: string) {
  let status = document.getElementById('get-down-status');
  if (!status) {
    status = document.createElement('p');
    status.id = 'get-down-status';
    status.className = 'visually-hidden';
    status.setAttribute('aria-live', 'polite');
    document.body.append(status);
  }
  status.textContent = text;
}

function marker(pageX: number, pageY: number): HTMLElement {
  const el = document.createElement('span');
  el.className = 'marker';
  el.ariaHidden = 'true';
  el.textContent = '+';
  el.style.left = `${pageX}px`;
  el.style.top = `${pageY}px`;
  document.body.append(el);
  return el;
}

function stopTargeting() {
  clearTimeout(targetingTimeout);
  document.body.classList.remove('targeting');
}

function cancel() {
  if (state !== 'targeting') {
    return;
  }

  stopTargeting();
  state = 'idle';
  announce('The dragon flew off.');
}

function whistle() {
  if (state !== 'idle') {
    return;
  }

  state = 'targeting';
  void loadDragon();
  loadSound();
  document.body.classList.add('targeting');
  targetingTimeout = setTimeout(cancel, TARGETING_TIMEOUT_MS);
  announce('A dragon is circling. Click or tap where he should strike, or press Escape to send him away.');
}

async function strike(pageX: number, pageY: number) {
  stopTargeting();
  state = 'diving';
  announce('Get down!');
  const target = marker(pageX, pageY);

  try {
    const started = await playSound();
    const { FLIGHT_TIME, launch } = await loadDragon();
    // With sound, the whole whistle plays before he hits. Without it, there's nothing to wait for
    const impactAt = started === null ? performance.now() + FLIGHT_TIME * 1000 + LEAD_MS : started + BOOM_MS;
    await launch(pageX, pageY, impactAt, () => target.remove());
  } finally {
    target.remove();
    state = 'idle';
  }
}

// Capture phase, so the targeting click never reaches the link or button under it
function onClick(e: MouseEvent) {
  const onBeacon = (e.target as Element).closest('.beacon') !== null;

  if (state === 'targeting') {
    e.preventDefault();
    e.stopPropagation();
    // A keyboard press on the beacon has no pointer position, aim at the middle of the screen instead
    if (e.detail === 0) {
      void strike(scrollX + innerWidth / 2, scrollY + innerHeight / 2);
    } else {
      void strike(e.pageX, e.pageY);
    }
  } else if (onBeacon) {
    whistle();
  }
}

function main() {
  addEventListener('click', onClick, { capture: true });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      cancel();
    }
  });

  // ?get-down dives at the middle of the screen right away, for trying changes without the trigger
  if (new URLSearchParams(location.search).has('get-down')) {
    addEventListener('load', () => strike(scrollX + innerWidth / 2, scrollY + innerHeight / 2));
  }
}

main();
