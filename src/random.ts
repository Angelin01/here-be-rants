export type Rand = () => number;

// FNV-1a. Its low bits are weak on their own, mulberry32 mixes them up
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }

  return h >>> 0;
}

// mulberry32, good enough for decoration. Same seed, same sequence of floats in [0, 1)
export function rng(seed: string): Rand {
  let state = hash(seed);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
