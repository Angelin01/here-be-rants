// The easter egg's entry point, on every page. The dragon itself is only downloaded once he's called.

// Time for the dragon module to load before the dive starts
const LEAD_MS = 300;

async function diveAt(pageX: number, pageY: number) {
  const { FLIGHT_TIME, launch } = await import('./dragon.ts');
  await launch(pageX, pageY, performance.now() + FLIGHT_TIME * 1000 + LEAD_MS);
}

function main() {
  // ?get-down dives at the middle of the screen right away, for trying changes without the trigger
  if (new URLSearchParams(location.search).has('get-down')) {
    addEventListener('load', () => diveAt(scrollX + innerWidth / 2, scrollY + innerHeight / 2));
  }
}

main();
